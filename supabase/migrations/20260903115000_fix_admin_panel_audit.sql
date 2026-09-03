-- Restore the helper privileges required by existing RLS policies while making
-- user-scoped helpers impossible to use for probing another user's data.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles
      where user_id = _user_id and role = _role
    )
$$;

create or replace function public.has_purchased(_user_id uuid, _plugin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _user_id = (select auth.uid())
    and exists (
      select 1 from public.purchases
      where user_id = _user_id and plugin_id = _plugin_id and status in ('paid', 'partially_refunded')
    )
$$;

grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.has_purchased(uuid, uuid) to authenticated;
grant execute on function public.owns_developer(uuid) to authenticated;
grant execute on function public.owns_plugin(uuid) to authenticated;
grant execute on function public.plugin_is_public(uuid) to anon, authenticated;

create or replace function public.admin_dashboard_metrics(_actor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_id and role = 'admin') then
    raise exception 'Administrator access is required';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'developers', (select count(*) from public.developer_profiles),
    'purchases', (select count(*) from public.purchases),
    'totalRevenue', coalesce((select sum(amount) from public.transactions where type = 'sale'), 0),
    'openClaims', (select count(*) from public.claims where status = 'pending'),
    'openReports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'pluginStatuses', (select coalesce(jsonb_object_agg(moderation_status, amount), '{}'::jsonb) from (select moderation_status, count(*) amount from public.plugins group by moderation_status) s),
    'analyticsByType', (select coalesce(jsonb_object_agg(event_type, amount), '{}'::jsonb) from (select event_type, count(*) amount from public.plugin_analytics_events group by event_type) s)
  );
end;
$$;

-- Server-only, atomic admin operations. The functions are deliberately exposed
-- only to service_role and repeat the role check as defence in depth.
create or replace function public.admin_moderate_plugin(
  _actor_id uuid,
  _plugin_id uuid,
  _status public.moderation_status,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _before public.plugins;
  _after public.plugins;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_id and role = 'admin') then
    raise exception 'Administrator access is required';
  end if;
  if _status = 'rejected' and nullif(btrim(_reason), '') is null then
    raise exception 'A rejection reason is required';
  end if;

  select * into _before from public.plugins where id = _plugin_id for update;
  if not found then raise exception 'Plugin not found'; end if;

  update public.plugins
  set moderation_status = _status,
      rejection_reason = case when _status = 'rejected' then btrim(_reason) else null end,
      published_at = case when _status = 'approved' then coalesce(published_at, now()) else published_at end
  where id = _plugin_id
  returning * into _after;

  insert into public.admin_audit_logs(actor_id, action, resource_type, resource_id, before_state, after_state, reason)
  values (_actor_id, 'plugin.' || _status::text, 'plugin', _plugin_id, to_jsonb(_before), to_jsonb(_after), nullif(btrim(_reason), ''));
  return to_jsonb(_after);
end;
$$;

create or replace function public.admin_update_workflow(
  _actor_id uuid,
  _kind text,
  _item_id uuid,
  _status text,
  _notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _before jsonb;
  _after jsonb;
  _claim public.claims;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_id and role = 'admin') then
    raise exception 'Administrator access is required';
  end if;

  if _kind = 'claims' then
    if _status not in ('pending', 'approved', 'rejected') then raise exception 'Invalid claim status'; end if;
    select * into _claim from public.claims where id = _item_id for update;
    if not found then raise exception 'Claim not found'; end if;
    _before := jsonb_build_object('claim', to_jsonb(_claim), 'plugin', (select to_jsonb(p) from public.plugins p where p.id = _claim.plugin_id));

    if _status = 'approved' then
      if _claim.developer_profile_id is null or not exists (
        select 1 from public.developer_profiles
        where id = _claim.developer_profile_id and owner_id = _claim.claimant_user_id
      ) then
        raise exception 'The claim needs a developer profile owned by the claimant';
      end if;
      update public.plugins
      set developer_id = _claim.developer_profile_id, is_claimable = false
      where id = _claim.plugin_id;
    end if;

    update public.claims
    set status = _status::public.claim_status, admin_notes = nullif(btrim(_notes), ''), reviewed_at = now()
    where id = _item_id;
    _after := jsonb_build_object('claim', (select to_jsonb(c) from public.claims c where c.id = _item_id), 'plugin', (select to_jsonb(p) from public.plugins p where p.id = _claim.plugin_id));
  elsif _kind = 'reports' then
    if _status not in ('open', 'reviewing', 'resolved', 'dismissed') then raise exception 'Invalid report status'; end if;
    select to_jsonb(r) into _before from public.reports r where id = _item_id for update;
    if not found then raise exception 'Report not found'; end if;
    update public.reports
    set status = _status::public.report_status, admin_notes = nullif(btrim(_notes), ''), reviewed_at = now()
    where id = _item_id
    returning to_jsonb(reports) into _after;
  else
    raise exception 'Invalid workflow type';
  end if;

  insert into public.admin_audit_logs(actor_id, action, resource_type, resource_id, before_state, after_state, reason)
  values (_actor_id, _kind || '.' || _status, rtrim(_kind, 's'), _item_id, _before, _after, nullif(btrim(_notes), ''));
  return _after;
end;
$$;

create or replace function public.admin_save_catalog_item(
  _actor_id uuid,
  _kind text,
  _id uuid,
  _name text,
  _slug text,
  _description text default null,
  _active boolean default true,
  _sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare _before jsonb; _after jsonb; _resource_id uuid;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_id and role = 'admin') then raise exception 'Administrator access is required'; end if;
  if nullif(btrim(_name), '') is null or nullif(btrim(_slug), '') is null then raise exception 'Name and slug are required'; end if;

  if _kind = 'platforms' then
    select to_jsonb(x) into _before from public.platforms x where id = _id for update;
    insert into public.platforms(id, name, slug, description, active, sort_order)
    values (coalesce(_id, gen_random_uuid()), btrim(_name), btrim(_slug), nullif(btrim(_description), ''), _active, _sort_order)
    on conflict (id) do update set name=excluded.name, slug=excluded.slug, description=excluded.description, active=excluded.active, sort_order=excluded.sort_order
    returning id, to_jsonb(platforms) into _resource_id, _after;
  elsif _kind = 'categories' then
    select to_jsonb(x) into _before from public.categories x where id = _id for update;
    insert into public.categories(id, name, slug, description, active, sort_order)
    values (coalesce(_id, gen_random_uuid()), btrim(_name), btrim(_slug), nullif(btrim(_description), ''), _active, _sort_order)
    on conflict (id) do update set name=excluded.name, slug=excluded.slug, description=excluded.description, active=excluded.active, sort_order=excluded.sort_order
    returning id, to_jsonb(categories) into _resource_id, _after;
  elsif _kind = 'tags' then
    select to_jsonb(x) into _before from public.tags x where id = _id for update;
    insert into public.tags(id, name, slug)
    values (coalesce(_id, gen_random_uuid()), btrim(_name), btrim(_slug))
    on conflict (id) do update set name=excluded.name, slug=excluded.slug
    returning id, to_jsonb(tags) into _resource_id, _after;
  else raise exception 'Invalid catalog type'; end if;

  insert into public.admin_audit_logs(actor_id, action, resource_type, resource_id, before_state, after_state)
  values (_actor_id, case when _id is null then 'catalog.created' else 'catalog.updated' end, rtrim(_kind, 's'), _resource_id, _before, _after);
  return _after;
end;
$$;

create or replace function public.admin_delete_catalog_item(_actor_id uuid, _kind text, _id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare _before jsonb;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_id and role = 'admin') then raise exception 'Administrator access is required'; end if;
  if _kind = 'platforms' then delete from public.platforms where id=_id returning to_jsonb(platforms) into _before;
  elsif _kind = 'categories' then delete from public.categories where id=_id returning to_jsonb(categories) into _before;
  elsif _kind = 'tags' then delete from public.tags where id=_id returning to_jsonb(tags) into _before;
  else raise exception 'Invalid catalog type'; end if;
  if _before is null then raise exception 'Catalog item not found'; end if;
  insert into public.admin_audit_logs(actor_id, action, resource_type, resource_id, before_state)
  values (_actor_id, 'catalog.deleted', rtrim(_kind, 's'), _id, _before);
  return _id;
end;
$$;

revoke all on function public.admin_moderate_plugin(uuid, uuid, public.moderation_status, text) from public, anon, authenticated;
revoke all on function public.admin_dashboard_metrics(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_workflow(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_save_catalog_item(uuid, text, uuid, text, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.admin_delete_catalog_item(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_moderate_plugin(uuid, uuid, public.moderation_status, text) to service_role;
grant execute on function public.admin_dashboard_metrics(uuid) to service_role;
grant execute on function public.admin_update_workflow(uuid, text, uuid, text, text) to service_role;
grant execute on function public.admin_save_catalog_item(uuid, text, uuid, text, text, text, boolean, integer) to service_role;
grant execute on function public.admin_delete_catalog_item(uuid, text, uuid) to service_role;

-- Audit rows are append-only even for the service role used by the application.
revoke update, delete, truncate on public.admin_audit_logs from service_role;

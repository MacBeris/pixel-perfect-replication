-- Developer lifecycle is intentionally separate from moderation. An approved plugin can be
-- hidden/removed by its owner without pretending that an administrator suspended it.
alter table public.plugins
  add column developer_unpublished_at timestamptz,
  add column developer_removed_at timestamptz,
  add column developer_removed_by uuid references auth.users(id) on delete set null;

create index plugins_visible_catalog_idx on public.plugins(updated_at desc)
where moderation_status = 'approved' and developer_unpublished_at is null and developer_removed_at is null;

drop policy if exists "plugins_public_read" on public.plugins;
create policy "plugins_public_read" on public.plugins for select using (
  (moderation_status = 'approved' and developer_unpublished_at is null and developer_removed_at is null)
  or (developer_removed_at is null and private.owns_developer(developer_id))
  or private.has_role(auth.uid(),'admin')
);

-- Keep the original publishing function as the tightly-scoped draft/release implementation.
alter function public.publishing_action(uuid,text,jsonb) rename to publishing_action_legacy;
revoke all on function public.publishing_action_legacy(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publishing_action_legacy(uuid,text,jsonb) to service_role;

create or replace function public.publishing_action(_actor uuid, _action text, _input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  p public.plugins; before_row public.plugins; u public.plugin_uploads;
  pid uuid; uid uuid; k text; path text; changed jsonb := '{}'::jsonb; result jsonb;
begin
  if private.publishing_account_created_at(_actor) is null then raise exception 'Authentication required'; end if;
  pid:=(_input->>'id')::uuid;
  select * into p from public.plugins where id=pid for update;

  if _action='create' then
    return public.publishing_action_legacy(_actor,_action,_input);
  end if;
  if not found or not exists(select 1 from public.developer_profiles d where d.id=p.developer_id and d.owner_id=_actor) then
    raise exception 'Plugin unavailable';
  end if;
  before_row:=p;

  if _action='save' and p.moderation_status='approved' and p.developer_removed_at is null then
    if length(btrim(coalesce(_input->>'name','')))<2 or length(_input->>'name')>120 then raise exception 'Name must contain 2–120 characters'; end if;
    if coalesce(_input->>'slug','') !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Slug must contain 3–80 lowercase letters, numbers or hyphens'; end if;
    if length(btrim(coalesce(_input->>'short_description','')))<10 or length(_input->>'short_description')>300 then raise exception 'Short description must contain 10–300 characters'; end if;
    if length(coalesce(_input->>'full_description',''))>20000 then raise exception 'Description is too long'; end if;
    if nullif(_input->>'website_url','') is not null and _input->>'website_url' !~ '^https://[^ /]+' then raise exception 'Website URL must use HTTPS'; end if;
    if nullif(_input->>'github_url','') is not null and _input->>'github_url' !~ '^https://[^ /]+' then raise exception 'GitHub URL must use HTTPS'; end if;

    update public.plugins set
      short_description=btrim(_input->>'short_description'), full_description=_input->>'full_description',
      license=left(_input->>'license',200), website_url=nullif(_input->>'website_url',''),
      github_url=nullif(_input->>'github_url','')
    where id=pid;

    -- Identity/distribution/security-sensitive fields are proposed, never applied directly.
    if p.name is distinct from btrim(_input->>'name') then changed:=changed||jsonb_build_object('name',btrim(_input->>'name')); end if;
    if p.slug is distinct from (_input->>'slug') then changed:=changed||jsonb_build_object('slug',_input->>'slug'); end if;
    if p.platform_id is distinct from (_input->>'platform_id')::uuid then changed:=changed||jsonb_build_object('platform_id',_input->>'platform_id'); end if;
    if p.listing_type::text is distinct from (_input->>'listing_type') then changed:=changed||jsonb_build_object('listing_type',_input->>'listing_type'); end if;
    if coalesce(p.compatibility,'') is distinct from coalesce(_input->>'compatibility','') then changed:=changed||jsonb_build_object('compatibility',_input->>'compatibility'); end if;
    if coalesce(p.external_purchase_url,'') is distinct from coalesce(_input->>'external_purchase_url','') then changed:=changed||jsonb_build_object('external_purchase_url',nullif(_input->>'external_purchase_url','')); end if;

    delete from public.plugin_categories where plugin_id=pid;
    insert into public.plugin_categories(plugin_id,category_id)
      select pid,value::uuid from jsonb_array_elements_text(coalesce(_input->'categories','[]'))
      where exists(select 1 from public.categories c where c.id=value::uuid and c.active) on conflict do nothing;
    delete from public.plugin_tags where plugin_id=pid;
    insert into public.plugin_tags(plugin_id,tag_id)
      select pid,value::uuid from jsonb_array_elements_text(coalesce(_input->'tags','[]')) on conflict do nothing;

    if changed<>'{}'::jsonb then
      delete from public.plugin_change_requests where plugin_id=pid and status='pending';
      insert into public.plugin_change_requests(plugin_id,requested_by,changed_fields) values(pid,_actor,changed);
    end if;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,case when changed='{}'::jsonb then 'plugin.metadata_updated' else 'plugin.metadata_updated_with_change_request' end,
        'plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid)||jsonb_build_object('requested_changes',changed));
  elsif _action='reserve_upload' and p.moderation_status='approved' and p.developer_removed_at is null then
    k:=_input->>'kind';
    if k not in ('logo','screenshot','banner','cover') then raise exception 'Published ZIP files are immutable. Create a new release'; end if;
    if (_input->>'size')::bigint<1 or (_input->>'size')::bigint>5242880 then raise exception 'File exceeds the size limit'; end if;
    if _input->>'mime' not in ('image/jpeg','image/png','image/webp') then raise exception 'Choose JPEG, PNG or WebP'; end if;
    uid:=gen_random_uuid(); path:=p.developer_id::text||'/'||pid::text||'/media/'||uid::text;
    insert into public.plugin_uploads(id,plugin_id,actor_id,kind,bucket,staging_path,final_path,original_name,mime,size)
      values(uid,pid,_actor,k,'plugin-assets','staging/'||path,'verified/'||path,left(_input->>'name',200),_input->>'mime',(_input->>'size')::bigint)
      returning * into u;
    return to_jsonb(u);
  elsif _action='finish_upload' and p.moderation_status='approved' and p.developer_removed_at is null then
    select * into u from public.plugin_uploads where id=(_input->>'upload_id')::uuid and actor_id=_actor and plugin_id=pid for update;
    if not found or u.kind='zip' then raise exception 'Upload unavailable'; end if;
    if u.completed_at is not null then return to_jsonb(p); end if;
    if u.kind='screenshot' and (select count(*) from public.plugin_assets where plugin_id=pid and asset_type='screenshot')>=10 then raise exception 'Maximum 10 screenshots'; end if;
    if u.kind in ('logo','banner','cover') then delete from public.plugin_assets where plugin_id=pid and asset_type=u.kind::public.asset_type; end if;
    insert into public.plugin_assets(plugin_id,asset_type,storage_path,public_url,sort_order)
      values(pid,u.kind::public.asset_type,u.final_path,_input->>'public_url',(select count(*) from public.plugin_assets where plugin_id=pid));
    if u.kind='logo' then update public.plugins set logo_url=_input->>'public_url' where id=pid; end if;
    update public.plugin_uploads set completed_at=now() where id=u.id;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.media_added','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
  elsif _action='remove_asset' and p.moderation_status='approved' and p.developer_removed_at is null then
    delete from public.plugin_assets where id=(_input->>'asset_id')::uuid and plugin_id=pid returning asset_type into k;
    if k is null then raise exception 'Asset unavailable'; end if;
    if k='logo' then update public.plugins set logo_url=null where id=pid; end if;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.media_removed','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
  elsif _action='unpublish' then
    if p.moderation_status<>'approved' or p.developer_removed_at is not null then raise exception 'Only a published plugin can be unpublished'; end if;
    update public.plugins set developer_unpublished_at=coalesce(developer_unpublished_at,now()) where id=pid;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.unpublished','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
  elsif _action='republish' then
    if p.moderation_status<>'approved' or p.developer_removed_at is not null then raise exception 'Plugin requires administrator review'; end if;
    if exists(select 1 from public.plugin_change_requests where plugin_id=pid and status='pending') then raise exception 'Critical changes are awaiting review'; end if;
    update public.plugins set developer_unpublished_at=null where id=pid;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.republished','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
  elsif _action='delete' then
    if p.developer_removed_at is null then
      update public.plugins set developer_removed_at=now(),developer_removed_by=_actor where id=pid;
      insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
        values(_actor,'plugin.removed_by_developer','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
    end if;
  elsif _action='restore' then
    if p.developer_removed_at is null then return to_jsonb(p); end if;
    if p.developer_removed_by is distinct from _actor or p.moderation_status='suspended' then raise exception 'This plugin cannot be restored by the developer'; end if;
    update public.plugins set developer_removed_at=null,developer_removed_by=null where id=pid;
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.restored_by_developer','plugin',pid,to_jsonb(before_row),(select to_jsonb(x) from public.plugins x where x.id=pid));
  elsif _action='revise' or _action='submit' then
    result:=public.publishing_action_legacy(_actor,_action,_input);
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor,'plugin.'||_action,'plugin',pid,to_jsonb(before_row),result);
    return result;
  else
    if p.developer_removed_at is not null then raise exception 'Plugin has been removed'; end if;
    return public.publishing_action_legacy(_actor,_action,_input);
  end if;
  select to_jsonb(x) into result from public.plugins x where id=pid;
  return result;
end; $$;
revoke all on function public.publishing_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publishing_action(uuid,text,jsonb) to service_role;

-- Dashboard keeps removed entries for their owner, while catalog RLS never exposes them.
create or replace function private.developer_dashboard(_developer_id uuid, _plugin_id uuid, _range text, _page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; bucket text;
begin
  if auth.uid() is null or not exists(select 1 from public.developer_profiles where id=_developer_id and owner_id=auth.uid()) then raise exception 'Developer profile unavailable' using errcode='42501'; end if;
  if _plugin_id is not null and not exists(select 1 from public.plugins where id=_plugin_id and developer_id=_developer_id) then raise exception 'Plugin unavailable' using errcode='42501'; end if;
  if _range not in ('7','30','90','365','all') or _page not between 1 and 100000 then raise exception 'Invalid analytics range or page'; end if;
  bucket:=case when _range in ('365','all') then 'month' else 'day' end;
  start_at:=case when _range='all' then '-infinity'::timestamptz else date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-((_range::integer-1)*interval '1 day') end;
  with owned as materialized (select p.* from public.plugins p where p.developer_id=_developer_id and (_plugin_id is null or p.id=_plugin_id)),
  events as materialized (select e.* from public.plugin_analytics_events e join owned p on p.id=e.plugin_id),
  page_rows as (select p.id,p.name,p.slug,p.logo_url,p.moderation_status,p.listing_type,p.current_version,p.downloads_count,p.views_count,p.rating_average,p.reviews_count,p.updated_at,p.rejection_reason,p.developer_unpublished_at,p.developer_removed_at,p.developer_removed_by,pl.name platform from owned p left join public.platforms pl on pl.id=p.platform_id order by p.updated_at desc,p.id limit 20 offset ((_page-1)*20)),
  series as (select to_char(date_trunc(bucket,e.created_at at time zone 'UTC'),'YYYY-MM-DD') date,count(*) filter(where event_type='page_view') views,count(*) filter(where event_type='download') downloads,count(*) filter(where event_type='outbound_click') outbound_clicks from events e where e.created_at>=start_at and e.created_at<=now() group by 1 order by 1),
  recent as (select r.id,r.plugin_id,p.name plugin_name,r.title,r.body,r.rating,r.created_at from public.reviews r join owned p on p.id=r.plugin_id where r.status='active' and r.created_at>=now()-interval '30 days' order by r.created_at desc,r.id limit 20)
  select jsonb_build_object(
    'totals',(select jsonb_build_object('plugins',count(*),'published',count(*) filter(where moderation_status='approved' and developer_unpublished_at is null and developer_removed_at is null),'drafts',count(*) filter(where moderation_status='draft' and developer_removed_at is null),'pending',count(*) filter(where moderation_status='pending_review' and developer_removed_at is null),'rejected',count(*) filter(where moderation_status='rejected' and developer_removed_at is null),'downloads',coalesce(sum(downloads_count) filter(where developer_removed_at is null),0),'views',coalesce(sum(views_count) filter(where developer_removed_at is null),0),'reviews',coalesce(sum(reviews_count) filter(where developer_removed_at is null),0),'favorites',coalesce(sum(favorites_count) filter(where developer_removed_at is null),0),'wishlist',coalesce(sum(wishlist_count) filter(where developer_removed_at is null),0),'rating',case when sum(reviews_count) filter(where developer_removed_at is null)>0 then round((sum(rating_average*reviews_count) filter(where developer_removed_at is null))/(sum(reviews_count) filter(where developer_removed_at is null)),2) else null end) from owned),
    'history',jsonb_build_object('available',exists(select 1 from events),'coverage','unknown','bucket',bucket,'downloads_last_30_days',(select count(*) from events where event_type='download' and created_at>=now()-interval '30 days'),'outbound_clicks',(select count(*) from events where event_type='outbound_click'),'series',coalesce((select jsonb_agg(to_jsonb(s)) from series s),'[]'::jsonb)),
    'plugins',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),'recent_reviews',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),
    'versions',case when _plugin_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'status',v.status,'is_current',v.is_current,'released_at',v.released_at,'created_at',v.created_at,'changelog',v.changelog) order by v.created_at desc) from public.plugin_versions v where v.plugin_id=_plugin_id),'[]'::jsonb) end) into result;
  return result;
end; $$;

-- Direct table writes remain available for legacy reads, but lifecycle fields can only be
-- changed by server-only functions.
create or replace function private.guard_plugin_lifecycle_fields() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and (new.developer_unpublished_at is distinct from old.developer_unpublished_at or new.developer_removed_at is distinct from old.developer_removed_at or new.developer_removed_by is distinct from old.developer_removed_by or new.moderation_status is distinct from old.moderation_status or new.developer_id is distinct from old.developer_id) then
    raise exception 'Protected plugin fields can only be changed by the server';
  end if;
  return new;
end; $$;
create trigger plugins_guard_lifecycle before update on public.plugins for each row execute function private.guard_plugin_lifecycle_fields();

-- Publishing mutations are server-only. This closes the historical gap where an owner could
-- bypass the publishing RPC with a hand-written PostgREST UPDATE.
revoke insert,update,delete on public.plugins from authenticated;
revoke insert,update,delete on public.plugin_versions from authenticated;
revoke insert,update,delete on public.plugin_assets from authenticated;
revoke insert,update,delete on public.plugin_categories from authenticated;
revoke insert,update,delete on public.plugin_tags from authenticated;
revoke insert on public.plugin_change_requests from authenticated;

-- Reset the overly broad Data API privileges inherited from the project's original
-- default ACL. RLS does not protect TRUNCATE, REFERENCES or TRIGGER privileges.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Public catalogue data. Row visibility remains constrained by the existing RLS
-- policies; column grants keep internal storage paths and Stripe identifiers private.
grant select on table public.categories, public.platforms, public.tags,
  public.plugins, public.plugin_categories, public.plugin_tags, public.reviews,
  public.profiles to anon, authenticated;

grant select (id, owner_id, name, slug, account_type, description, avatar_url,
  website_url, github_url, twitter_url, is_public, created_at, updated_at)
on table public.developer_profiles to anon, authenticated;

grant select (id, plugin_id, asset_type, public_url, alt_text, sort_order, created_at)
on table public.plugin_assets to anon, authenticated;

grant select (id, plugin_id, version_number, changelog, release_notes, compatibility,
  file_size, is_current, status, released_at, created_at, updated_at)
on table public.plugin_versions to anon, authenticated;

-- Authenticated account features. Column-level write grants prevent callers from
-- reassigning ownership, lifecycle fields or moderation state even before RLS runs.
grant update (username, display_name, avatar_url, bio) on table public.profiles to authenticated;

grant select on table public.user_roles, public.developer_members,
  public.developer_profile_evidence, public.favorites, public.collections,
  public.collection_plugins, public.claims, public.reports, public.purchases,
  public.developer_balances, public.transactions, public.payouts,
  public.plugin_change_requests to authenticated;

grant insert (developer_id, user_id, role) on table public.developer_members to authenticated;
grant delete on table public.developer_members to authenticated;

grant insert (user_id, plugin_id) on table public.favorites to authenticated;
grant delete on table public.favorites to authenticated;

grant insert (owner_id, name, slug, description, is_public) on table public.collections to authenticated;
grant update (name, slug, description, is_public) on table public.collections to authenticated;
grant delete on table public.collections to authenticated;

grant insert (collection_id, plugin_id, sort_order) on table public.collection_plugins to authenticated;
grant update (sort_order) on table public.collection_plugins to authenticated;
grant delete on table public.collection_plugins to authenticated;

grant insert (plugin_id, claimant_user_id, developer_profile_id, evidence, proof_url, message)
on table public.claims to authenticated;
grant insert (target_type, plugin_id, review_id, reporter_user_id, reason, details)
on table public.reports to authenticated;

-- Only these client-callable RPCs and RLS helpers are required. Mutating publishing,
-- moderation, analytics and ingestion RPCs remain service-role only.
grant execute on function private.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function private.owns_developer(uuid) to anon, authenticated;
grant execute on function private.owns_plugin(uuid) to anon, authenticated;
grant execute on function private.plugin_is_public(uuid) to anon, authenticated;
grant execute on function private.has_purchased(uuid, uuid) to authenticated;
grant execute on function private.save_developer_profile(uuid, jsonb) to authenticated;
grant execute on function private.developer_dashboard(uuid, uuid, text, integer) to authenticated;
grant execute on function private.developer_plugin_detail(uuid, uuid) to authenticated;
grant execute on function public.save_developer_profile(jsonb, uuid) to authenticated;
grant execute on function public.developer_dashboard(uuid, uuid, text, integer) to authenticated;
grant execute on function public.developer_plugin_detail(uuid, uuid) to authenticated;

alter function private.owns_developer(uuid) set search_path='';
alter function public.recalc_plugin_counters() set search_path='';

-- A public plugin must also pass every lifecycle visibility gate. This prevents
-- metadata for hidden/import-missing listings from leaking through related tables.
create or replace function private.plugin_is_public(_plugin_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.plugins p
    where p.id = _plugin_id
      and p.moderation_status = 'approved'
      and p.developer_unpublished_at is null
      and p.developer_removed_at is null
      and p.source_hidden_at is null
  )
$$;
revoke all on function private.plugin_is_public(uuid) from public, anon, authenticated;
grant execute on function private.plugin_is_public(uuid) to anon, authenticated;

drop policy if exists "plugins_public_read" on public.plugins;
create policy "plugins_public_read" on public.plugins for select to public using (
  (
    moderation_status = 'approved'
    and developer_unpublished_at is null
    and developer_removed_at is null
    and source_hidden_at is null
  )
  or (developer_removed_at is null and private.owns_developer(developer_id))
  or private.has_role((select auth.uid()), 'admin')
);

-- Bound direct user-controlled text and URLs at the database boundary. Existing
-- rows were checked before this migration was produced.
alter table public.profiles
  add constraint profiles_display_name_length check (length(coalesce(display_name, '')) <= 100),
  add constraint profiles_bio_length check (length(coalesce(bio, '')) <= 3000),
  add constraint profiles_avatar_https check (
    avatar_url is null or (length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$')
  );

alter table public.collections
  add constraint collections_name_length check (length(btrim(name)) between 1 and 120),
  add constraint collections_slug_length check (length(btrim(slug)) between 1 and 160),
  add constraint collections_description_length check (length(coalesce(description, '')) <= 3000);

alter table public.claims
  add constraint claims_text_length check (
    length(coalesce(evidence, '')) <= 5000 and length(coalesce(message, '')) <= 5000
  ),
  add constraint claims_proof_https check (
    proof_url is null or (length(proof_url) <= 2048 and proof_url ~ '^https://[^[:space:]]+$')
  );

alter table public.reports
  add constraint reports_text_length check (
    length(reason) between 1 and 500 and length(coalesce(details, '')) <= 5000
  );

alter table public.plugins
  add constraint plugins_web_urls_safe check (
    (logo_url is null or (length(logo_url) <= 2048 and logo_url ~ '^https?://[^[:space:]]+$')) and
    (video_url is null or (length(video_url) <= 2048 and video_url ~ '^https?://[^[:space:]]+$')) and
    (website_url is null or (length(website_url) <= 2048 and website_url ~ '^https?://[^[:space:]]+$')) and
    (external_purchase_url is null or (length(external_purchase_url) <= 2048 and external_purchase_url ~ '^https?://[^[:space:]]+$')) and
    (github_url is null or (length(github_url) <= 2048 and github_url ~ '^https?://[^[:space:]]+$')) and
    (source_url is null or (length(source_url) <= 2048 and source_url ~ '^https?://[^[:space:]]+$')) and
    (source_author_url is null or (length(source_author_url) <= 2048 and source_author_url ~ '^https?://[^[:space:]]+$'))
  );

alter table public.plugin_assets
  add constraint plugin_assets_public_url_safe check (
    public_url is null or (length(public_url) <= 2048 and public_url ~ '^https?://[^[:space:]]+$')
  );

-- Direct claims/reports are deliberately low-volume. The checks run with the caller's
-- identity and count only rows that caller can already read through RLS.
create or replace function private.limit_claim_submission()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if (select auth.uid()) is null or new.claimant_user_id <> (select auth.uid()) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if (select count(*) from public.claims c
      where c.claimant_user_id=(select auth.uid()) and c.created_at >= now()-interval '1 hour') >= 5 then
    raise exception 'Too many claim submissions. Try again later.' using errcode='54000';
  end if;
  return new;
end $$;

create or replace function private.limit_report_submission()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if (select auth.uid()) is null or new.reporter_user_id <> (select auth.uid()) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if (select count(*) from public.reports r
      where r.reporter_user_id=(select auth.uid()) and r.created_at >= now()-interval '1 hour') >= 10 then
    raise exception 'Too many report submissions. Try again later.' using errcode='54000';
  end if;
  return new;
end $$;

drop trigger if exists claims_submission_rate_limit on public.claims;
create trigger claims_submission_rate_limit before insert on public.claims
for each row execute function private.limit_claim_submission();
drop trigger if exists reports_submission_rate_limit on public.reports;
create trigger reports_submission_rate_limit before insert on public.reports
for each row execute function private.limit_report_submission();
revoke all on function private.limit_claim_submission() from public, anon, authenticated;
revoke all on function private.limit_report_submission() from public, anon, authenticated;

-- The site analytics sequence is server-only.
revoke all on sequence public.site_analytics_events_id_seq from anon, authenticated;

-- This RPC is service-only. The application authenticates the caller first and passes
-- that verified user id; checking auth.uid() here would always fail for service_role.
create or replace function public.admin_site_analytics(
  _actor_id uuid,
  _range text default '24h'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _since timestamptz;
  _page_views bigint;
  _sessions bigint;
  _visitors bigint;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = _actor_id and ur.role = 'admin'::public.app_role
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  _since := case _range
    when '5m' then now() - interval '5 minutes'
    when '30m' then now() - interval '30 minutes'
    when '24h' then now() - interval '24 hours'
    when '7d' then now() - interval '7 days'
    when '30d' then now() - interval '30 days'
    else null
  end;
  if _since is null then raise exception 'Unsupported analytics range.'; end if;

  select count(*), count(distinct visitor_hash), count(distinct session_hash)
    into _page_views, _visitors, _sessions
  from public.site_analytics_events
  where created_at >= _since and event_kind = 'page_view';

  return jsonb_build_object(
    'range', _range,
    'generatedAt', now(),
    'uniqueVisitors', _visitors,
    'pageViews', _page_views,
    'sessions', _sessions,
    'pagesPerSession', case when _sessions = 0 then 0 else round(_page_views::numeric / _sessions, 2) end,
    'excludedBotTraffic', (
      select count(*) from public.site_analytics_events
      where created_at >= _since and event_kind = 'excluded_bot'
    ),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', views) order by views desc, path)
      from (
        select path, count(*)::bigint as views
        from public.site_analytics_events
        where created_at >= _since and event_kind = 'page_view'
        group by path order by views desc, path limit 10
      ) q
    ), '[]'::jsonb),
    'topPlugins', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug, 'views', views) order by views desc, name)
      from (
        select p.id, p.name, p.slug, count(*)::bigint as views
        from public.site_analytics_events e
        join public.plugins p on p.id = e.plugin_id
        where e.created_at >= _since and e.event_kind = 'page_view'
        group by p.id, p.name, p.slug order by views desc, p.name limit 10
      ) q
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'views', views) order by views desc, source)
      from (
        select coalesce(referrer_host, 'Direct') as source, count(*)::bigint as views
        from public.site_analytics_events
        where created_at >= _since and event_kind = 'page_view'
        group by coalesce(referrer_host, 'Direct') order by views desc, source limit 10
      ) q
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_site_analytics(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_site_analytics(uuid, text) to service_role;

-- Analytics coverage starts here for plugins that had no recorded events. Existing event
-- history remains valid and moves the coverage boundary back to the first real event.
alter table public.plugins
  add column analytics_tracking_started_at timestamptz not null default now();

update public.plugins p
set analytics_tracking_started_at = e.first_event_at
from (
  select plugin_id, min(created_at) first_event_at
  from public.plugin_analytics_events
  group by plugin_id
) e
where e.plugin_id = p.id
  and e.first_event_at < p.analytics_tracking_started_at;

create index analytics_event_dedup_idx
  on public.plugin_analytics_events(plugin_id,event_type,session_hash,created_at desc);

-- Event rows are an internal write model. RLS already blocks direct writes, and these
-- revokes make that boundary explicit even if a permissive policy is added later.
revoke insert,update,delete,truncate,references,trigger
  on public.plugin_analytics_events from anon,authenticated;

-- Called only by the server with a service-role client. The caller may select only the
-- interaction; plugin state, developer identity and counters are derived here.
create or replace function public.record_plugin_interaction(
  _plugin_id uuid,
  _event_type text,
  _actor uuid,
  _session_hash text
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare p public.plugins; counted boolean := false;
begin
  if _event_type not in ('page_view','outbound_click')
    or _session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid analytics interaction';
  end if;

  -- Serializes identical interactions and prevents concurrent requests bypassing the window.
  perform pg_advisory_xact_lock(hashtextextended(_plugin_id::text||':'||_event_type||':'||_session_hash, 19));
  select * into p from public.plugins where id=_plugin_id for update;
  if not found or p.moderation_status<>'approved'
    or p.developer_unpublished_at is not null or p.developer_removed_at is not null then
    raise exception 'Plugin unavailable';
  end if;
  if _event_type='outbound_click'
    and (p.listing_type<>'external_listing' or p.external_purchase_url is null) then
    raise exception 'External listing unavailable';
  end if;

  -- Owner/admin previews are operational traffic and never contribute to public analytics.
  if _actor is not null and (
    exists(select 1 from public.developer_profiles d where d.id=p.developer_id and d.owner_id=_actor)
    or exists(select 1 from public.user_roles ur where ur.user_id=_actor and ur.role='admin')
  ) then
    return jsonb_build_object('counted',false,'url',case when _event_type='outbound_click' then p.external_purchase_url else null end);
  end if;

  if not exists(
    select 1 from public.plugin_analytics_events e
    where e.plugin_id=p.id and e.event_type=_event_type::public.analytics_event_type
      and e.session_hash=_session_hash and e.created_at>now()-interval '30 minutes'
  ) then
    insert into public.plugin_analytics_events(plugin_id,developer_id,event_type,session_hash)
      values(p.id,p.developer_id,_event_type::public.analytics_event_type,_session_hash);
    if _event_type='page_view' then
      update public.plugins set views_count=views_count+1 where id=p.id;
    end if;
    counted:=true;
  end if;
  return jsonb_build_object('counted',counted,'url',case when _event_type='outbound_click' then p.external_purchase_url else null end);
end $$;
revoke all on function public.record_plugin_interaction(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_plugin_interaction(uuid,text,uuid,text) to service_role;

-- Review aggregates always derive from active reviews. Recalculate both sides if a trusted
-- administrative operation ever moves a review between plugins.
create or replace function public.recalc_plugin_rating() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_pid uuid; new_pid uuid;
begin
  old_pid:=case when tg_op in ('UPDATE','DELETE') then old.plugin_id end;
  new_pid:=case when tg_op in ('INSERT','UPDATE') then new.plugin_id end;
  if old_pid is not null then
    update public.plugins p set
      rating_average=coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.plugin_id=old_pid and r.status='active'),0),
      reviews_count=(select count(*) from public.reviews r where r.plugin_id=old_pid and r.status='active')
    where p.id=old_pid;
  end if;
  if new_pid is not null and new_pid is distinct from old_pid then
    update public.plugins p set
      rating_average=coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.plugin_id=new_pid and r.status='active'),0),
      reviews_count=(select count(*) from public.reviews r where r.plugin_id=new_pid and r.status='active')
    where p.id=new_pid;
  end if;
  return null;
end $$;
revoke all on function public.recalc_plugin_rating() from public,anon,authenticated;

-- Reviews are saved through the server-only validated RPC, never by a direct table update.
revoke insert,update,delete on public.reviews from authenticated;

create or replace function private.developer_dashboard(_developer_id uuid, _plugin_id uuid, _range text, _page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; coverage_start timestamptz; effective_start timestamptz; bucket text;
begin
  if auth.uid() is null or not exists(select 1 from public.developer_profiles where id=_developer_id and owner_id=auth.uid()) then raise exception 'Developer profile unavailable' using errcode='42501'; end if;
  if _plugin_id is not null and not exists(select 1 from public.plugins where id=_plugin_id and developer_id=_developer_id) then raise exception 'Plugin unavailable' using errcode='42501'; end if;
  if _range not in ('7','30','90','365','all') or _page not between 1 and 100000 then raise exception 'Invalid analytics range or page'; end if;
  bucket:=case when _range in ('365','all') then 'month' else 'day' end;
  start_at:=case when _range='all' then '-infinity'::timestamptz else (date_trunc('day',now() at time zone 'UTC')-((_range::integer-1)*interval '1 day')) at time zone 'UTC' end;

  select min(p.analytics_tracking_started_at) into coverage_start
  from public.plugins p where p.developer_id=_developer_id and (_plugin_id is null or p.id=_plugin_id);
  effective_start:=case when coverage_start is null then null when _range='all' then coverage_start else greatest(coverage_start,start_at) end;

  with owned as materialized (select p.* from public.plugins p where p.developer_id=_developer_id and (_plugin_id is null or p.id=_plugin_id)),
  events as materialized (select e.* from public.plugin_analytics_events e join owned p on p.id=e.plugin_id),
  page_rows as (select p.id,p.name,p.slug,p.logo_url,p.moderation_status,p.listing_type,p.current_version,p.downloads_count,p.views_count,p.rating_average,p.reviews_count,p.updated_at,p.rejection_reason,p.developer_unpublished_at,p.developer_removed_at,p.developer_removed_by,p.source,p.source_installs_count,p.source_downloads_count,p.source_rating_average,p.source_ratings_count,pl.name platform from owned p left join public.platforms pl on pl.id=p.platform_id order by p.updated_at desc,p.id limit 20 offset ((_page-1)*20)),
  buckets as (
    select generate_series(
      date_trunc(bucket,effective_start at time zone 'UTC'),
      date_trunc(bucket,now() at time zone 'UTC'),
      case when bucket='day' then interval '1 day' else interval '1 month' end
    ) bucket_at where effective_start is not null
  ),
  series as (
    select to_char(b.bucket_at,'YYYY-MM-DD') date,
      count(e.id) filter(where e.event_type='page_view')::int views,
      count(e.id) filter(where e.event_type='download')::int downloads,
      count(e.id) filter(where e.event_type='outbound_click')::int outbound_clicks
    from buckets b left join events e on date_trunc(bucket,e.created_at at time zone 'UTC')=b.bucket_at
    group by b.bucket_at order by b.bucket_at
  ),
  recent as (select r.id,r.plugin_id,p.name plugin_name,r.title,r.body,r.rating,r.created_at from public.reviews r join owned p on p.id=r.plugin_id where r.status='active' and r.created_at>=now()-interval '30 days' order by r.created_at desc,r.id limit 20)
  select jsonb_build_object(
    'totals',(select jsonb_build_object('plugins',count(*),'published',count(*) filter(where moderation_status='approved' and developer_unpublished_at is null and developer_removed_at is null),'drafts',count(*) filter(where moderation_status='draft' and developer_removed_at is null),'pending',count(*) filter(where moderation_status='pending_review' and developer_removed_at is null),'rejected',count(*) filter(where moderation_status='rejected' and developer_removed_at is null),'downloads',coalesce(sum(downloads_count) filter(where developer_removed_at is null),0),'views',coalesce(sum(views_count) filter(where developer_removed_at is null),0),'reviews',coalesce(sum(reviews_count) filter(where developer_removed_at is null),0),'favorites',coalesce(sum(favorites_count) filter(where developer_removed_at is null),0),'wishlist',coalesce(sum(wishlist_count) filter(where developer_removed_at is null),0),'rating',case when sum(reviews_count) filter(where developer_removed_at is null)>0 then round((sum(rating_average*reviews_count) filter(where developer_removed_at is null))/(sum(reviews_count) filter(where developer_removed_at is null)),2) else null end) from owned),
    'history',jsonb_build_object('available',coverage_start is not null,'coverage','tracked','started_at',coverage_start,'bucket',bucket,'downloads_last_30_days',(select count(*) from events where event_type='download' and created_at>=now()-interval '30 days'),'outbound_clicks',(select count(*) from events where event_type='outbound_click'),'series',coalesce((select jsonb_agg(to_jsonb(s)) from series s),'[]'::jsonb)),
    'plugins',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),'recent_reviews',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),
    'versions',case when _plugin_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'status',v.status,'is_current',v.is_current,'released_at',v.released_at,'created_at',v.created_at,'changelog',v.changelog) order by v.created_at desc) from public.plugin_versions v where v.plugin_id=_plugin_id),'[]'::jsonb) end) into result;
  return result;
end $$;

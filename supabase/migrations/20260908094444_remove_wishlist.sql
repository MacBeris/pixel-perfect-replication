begin;

create or replace function public.recalc_plugin_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.plugin_id, old.plugin_id);
  update public.plugins p set
    favorites_count = (select count(*) from public.favorites f where f.plugin_id = pid)
  where p.id = pid;
  return null;
end; $$;
revoke all on function public.recalc_plugin_counters() from public, anon, authenticated;

create or replace function private.developer_dashboard_analytics_base(_developer_id uuid, _plugin_id uuid, _range text, _page integer)
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
    'totals',(select jsonb_build_object('plugins',count(*),'published',count(*) filter(where moderation_status='approved' and developer_unpublished_at is null and developer_removed_at is null),'drafts',count(*) filter(where moderation_status='draft' and developer_removed_at is null),'pending',count(*) filter(where moderation_status='pending_review' and developer_removed_at is null),'rejected',count(*) filter(where moderation_status='rejected' and developer_removed_at is null),'downloads',coalesce(sum(downloads_count) filter(where developer_removed_at is null),0),'views',coalesce(sum(views_count) filter(where developer_removed_at is null),0),'reviews',coalesce(sum(reviews_count) filter(where developer_removed_at is null),0),'favorites',coalesce(sum(favorites_count) filter(where developer_removed_at is null),0),'rating',case when sum(reviews_count) filter(where developer_removed_at is null)>0 then round((sum(rating_average*reviews_count) filter(where developer_removed_at is null))/(sum(reviews_count) filter(where developer_removed_at is null)),2) else null end) from owned),
    'history',jsonb_build_object('available',coverage_start is not null,'coverage','tracked','started_at',coverage_start,'bucket',bucket,'downloads_last_30_days',(select count(*) from events where event_type='download' and created_at>=now()-interval '30 days'),'outbound_clicks',(select count(*) from events where event_type='outbound_click'),'series',coalesce((select jsonb_agg(to_jsonb(s)) from series s),'[]'::jsonb)),
    'plugins',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),'recent_reviews',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),
    'versions',case when _plugin_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'status',v.status,'is_current',v.is_current,'released_at',v.released_at,'created_at',v.created_at,'changelog',v.changelog) order by v.created_at desc) from public.plugin_versions v where v.plugin_id=_plugin_id),'[]'::jsonb) end) into result;
  return result;
end $$;
revoke all on function private.developer_dashboard_analytics_base(uuid,uuid,text,integer) from public, anon, authenticated;

drop table public.wishlists;
alter table public.plugins drop column wishlist_count;

commit;

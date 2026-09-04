-- Account dashboard: session-authorized operations, no server service key required.
-- Filename matches the version recorded by Supabase when this migration was applied.
create table public.developer_profile_evidence (
  developer_id uuid primary key references public.developer_profiles(id) on delete cascade,
  links text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.developer_profile_evidence enable row level security;
grant select on public.developer_profile_evidence to authenticated;
grant all on public.developer_profile_evidence to service_role;
create policy evidence_read on public.developer_profile_evidence for select to authenticated
using (exists (select 1 from public.developer_profiles d where d.id=developer_id and d.owner_id=(select auth.uid())) or private.has_role((select auth.uid()),'admin'));

revoke insert, update on public.developer_profiles from authenticated;
-- Review edits cannot alter purchase verification, author, target or moderation status.
revoke update on public.reviews from authenticated;
grant update (rating,title,body) on public.reviews to authenticated;

create function private.save_developer_profile(_profile_id uuid, _input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; link text; links text[]; field text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if _profile_id is not null then
    select id into pid from public.developer_profiles where id=_profile_id and owner_id=uid for update;
    if pid is null then raise exception 'Developer profile unavailable' using errcode='42501'; end if;
  else
    select id into pid from public.developer_profiles where owner_id=uid order by created_at,id limit 1;
    if pid is not null then return pid; end if;
  end if;
  if length(trim(coalesce(_input->>'name',''))) not between 2 and 100 then raise exception 'Name must contain 2–100 characters'; end if;
  if coalesce(_input->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(_input->>'slug') not between 3 and 80 then raise exception 'Use a slug of 3–80 lowercase letters, numbers and hyphens'; end if;
  if coalesce(_input->>'account_type','') not in ('individual','company','organization') then raise exception 'Invalid account type'; end if;
  if length(coalesce(_input->>'description','')) > 3000 then raise exception 'Description is too long'; end if;
  foreach field in array array['website_url','github_url','twitter_url','avatar_url'] loop
    link := nullif(trim(_input->>field),'');
    if link is not null and (link !~ '^https://[^[:space:]]+$' or length(link)>2048) then raise exception 'Links must be valid HTTPS URLs'; end if;
  end loop;
  select coalesce(array_agg(value),'{}') into links from jsonb_array_elements_text(coalesce(_input->'evidence_links','[]'::jsonb));
  if cardinality(links)>10 then raise exception 'At most 10 evidence links are allowed'; end if;
  foreach link in array links loop
    if link !~ '^https://[^[:space:]]+$' or length(link)>2048 then raise exception 'Evidence links must be HTTPS URLs'; end if;
  end loop;
  if pid is null then
    insert into public.developer_profiles(owner_id,name,slug,account_type) values(uid,trim(_input->>'name'),_input->>'slug',(_input->>'account_type')::public.developer_account_type) returning id into pid;
  end if;
  update public.developer_profiles set name=trim(_input->>'name'), slug=_input->>'slug',
    account_type=(_input->>'account_type')::public.developer_account_type, description=nullif(trim(_input->>'description'),''),
    website_url=nullif(trim(_input->>'website_url'),''), github_url=nullif(trim(_input->>'github_url'),''),
    twitter_url=nullif(trim(_input->>'twitter_url'),''), avatar_url=nullif(trim(_input->>'avatar_url'),''),
    is_public=coalesce((_input->>'is_public')::boolean,true)
  where id=pid and owner_id=uid;
  insert into public.developer_profile_evidence(developer_id,links) values(pid,links)
  on conflict(developer_id) do update set links=excluded.links,updated_at=now();
  return pid;
end; $$;
revoke all on function private.save_developer_profile(uuid,jsonb) from public,anon;
grant execute on function private.save_developer_profile(uuid,jsonb) to authenticated;
create function public.save_developer_profile(_input jsonb,_profile_id uuid default null)
returns uuid language sql security invoker set search_path='' as $$ select private.save_developer_profile(_profile_id,_input); $$;
revoke all on function public.save_developer_profile(jsonb,uuid) from public,anon;
grant execute on function public.save_developer_profile(jsonb,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_read_owner on storage.objects for select to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete_owner on storage.objects for delete to authenticated
using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create function private.developer_dashboard(_developer_id uuid,_plugin_id uuid,_range text,_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; bucket text;
begin
  if auth.uid() is null or not exists(select 1 from public.developer_profiles where id=_developer_id and owner_id=auth.uid()) then
    raise exception 'Developer profile unavailable' using errcode='42501';
  end if;
  if _plugin_id is not null and not exists(select 1 from public.plugins where id=_plugin_id and developer_id=_developer_id) then
    raise exception 'Plugin unavailable' using errcode='42501';
  end if;
  if _range not in ('7','30','90','365','all') or _page not between 1 and 100000 then raise exception 'Invalid analytics range or page'; end if;
  bucket := case when _range in ('365','all') then 'month' else 'day' end;
  start_at := case when _range='all' then '-infinity'::timestamptz else date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' - ((_range::integer-1)*interval '1 day') end;
  with owned as materialized (
    select p.* from public.plugins p where p.developer_id=_developer_id and (_plugin_id is null or p.id=_plugin_id)
  ), events as materialized (
    select e.* from public.plugin_analytics_events e join owned p on p.id=e.plugin_id
  ), page_rows as (
    select p.id,p.name,p.slug,p.logo_url,p.moderation_status,p.listing_type,p.current_version,p.downloads_count,p.views_count,p.rating_average,p.reviews_count,p.updated_at,
      p.rejection_reason,pl.name as platform
    from owned p left join public.platforms pl on pl.id=p.platform_id order by p.updated_at desc,p.id limit 20 offset ((_page-1)*20)
  ), series as (
    select to_char(date_trunc(bucket,e.created_at at time zone 'UTC'),'YYYY-MM-DD') as date,
      count(*) filter(where event_type='page_view') as views,
      count(*) filter(where event_type='download') as downloads,
      count(*) filter(where event_type='outbound_click') as outbound_clicks
    from events e where e.created_at>=start_at and e.created_at<=now() group by 1 order by 1
  ), recent as (
    select r.id,r.plugin_id,p.name as plugin_name,r.title,r.body,r.rating,r.created_at
    from public.reviews r join owned p on p.id=r.plugin_id where r.status='active' and r.created_at>=now()-interval '30 days'
    order by r.created_at desc,r.id limit 20
  )
  select jsonb_build_object(
    'totals',(select jsonb_build_object('plugins',count(*),'published',count(*) filter(where moderation_status='approved'),
      'drafts',count(*) filter(where moderation_status='draft'),'pending',count(*) filter(where moderation_status='pending_review'),
      'rejected',count(*) filter(where moderation_status='rejected'),'downloads',coalesce(sum(downloads_count),0),'views',coalesce(sum(views_count),0),
      'reviews',coalesce(sum(reviews_count),0),'favorites',coalesce(sum(favorites_count),0),'wishlist',coalesce(sum(wishlist_count),0),
      'rating',case when sum(reviews_count)>0 then round(sum(rating_average*reviews_count)/sum(reviews_count),2) else null end) from owned),
    'history',jsonb_build_object('available',exists(select 1 from events),'coverage','unknown','bucket',bucket,
      'downloads_last_30_days',(select count(*) from events where event_type='download' and created_at>=now()-interval '30 days'),
      'outbound_clicks',(select count(*) from events where event_type='outbound_click'),
      'series',coalesce((select jsonb_agg(to_jsonb(s)) from series s),'[]'::jsonb)),
    'plugins',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),
    'recent_reviews',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb),
    'versions',case when _plugin_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'status',v.status,'is_current',v.is_current,'released_at',v.released_at,'created_at',v.created_at,'changelog',v.changelog) order by v.created_at desc) from public.plugin_versions v where v.plugin_id=_plugin_id),'[]'::jsonb) end
  ) into result;
  return result;
end; $$;
revoke all on function private.developer_dashboard(uuid,uuid,text,integer) from public,anon;
grant execute on function private.developer_dashboard(uuid,uuid,text,integer) to authenticated;
create function public.developer_dashboard(_developer_id uuid,_plugin_id uuid default null,_range text default '30',_page integer default 1)
returns jsonb language sql security invoker set search_path='' as $$ select private.developer_dashboard(_developer_id,_plugin_id,_range,_page); $$;
revoke all on function public.developer_dashboard(uuid,uuid,text,integer) from public,anon;
grant execute on function public.developer_dashboard(uuid,uuid,text,integer) to authenticated;

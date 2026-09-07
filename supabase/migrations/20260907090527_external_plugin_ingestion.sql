-- External marketplace ingestion. All write paths are service-role only.
create type public.source_item_status as enum (
  'discovered', 'normalized', 'needs_review', 'published', 'rejected', 'error'
);

create type public.import_run_status as enum ('running', 'completed', 'partial', 'failed');

alter table public.plugins
  add column source text,
  add column external_id text,
  add column source_url text,
  add column source_author_name text,
  add column source_author_url text,
  add column source_updated_at timestamptz,
  add column source_published_at timestamptz,
  add column last_imported_at timestamptz,
  add column source_data_hash text,
  add column source_rating_average numeric(3,2) check (source_rating_average between 0 and 5),
  add column source_ratings_count integer check (source_ratings_count >= 0),
  add column source_installs_count bigint check (source_installs_count >= 0),
  add column source_downloads_count bigint check (source_downloads_count >= 0),
  add column source_managed boolean not null default false,
  add column source_missing_count integer not null default 0 check (source_missing_count >= 0),
  add column source_last_checked_at timestamptz,
  add column source_available boolean,
  add column source_hidden_at timestamptz,
  add constraint plugins_source_identity_check check (
    (source is null and external_id is null and not source_managed)
    or (nullif(btrim(source), '') is not null and nullif(btrim(external_id), '') is not null)
  );

create unique index plugins_source_external_id_key
  on public.plugins (source, external_id)
  where source is not null and external_id is not null;
create index plugins_source_managed_idx on public.plugins (source, source_managed)
  where source_managed;

alter table public.plugin_assets alter column storage_path drop not null;
alter table public.plugin_assets add constraint plugin_assets_location_check
  check (nullif(btrim(storage_path), '') is not null or nullif(btrim(public_url), '') is not null);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status public.import_run_status not null default 'running',
  parameters jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer not null default 0,
  created integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  failed integer not null default 0,
  error_message text
);

create table public.raw_source_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  plugin_id uuid references public.plugins(id) on delete set null,
  last_run_id uuid references public.import_runs(id) on delete set null,
  status public.source_item_status not null default 'discovered',
  raw_payload jsonb not null,
  raw_hash text not null,
  normalized_hash text,
  error_message text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  normalized_at timestamptz,
  unique (source, external_id)
);

create index raw_source_items_plugin_idx on public.raw_source_items(plugin_id);
create index raw_source_items_status_idx on public.raw_source_items(source,status);

alter table public.import_runs enable row level security;
alter table public.raw_source_items enable row level security;
revoke all on public.import_runs, public.raw_source_items from public, anon, authenticated;
grant all on public.import_runs, public.raw_source_items to service_role;

-- Atomic normalized upsert. The caller supplies only source-derived data and taxonomy slugs.
create or replace function public.ingest_source_item(
  _run_id uuid,
  _source text,
  _platform_slug text,
  _external_id text,
  _raw jsonb,
  _raw_hash text,
  _normalized jsonb,
  _normalized_hash text,
  _force boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _platform_id uuid;
  _plugin public.plugins;
  _raw_item public.raw_source_items;
  _desired_slug text;
  _result text;
  _is_valid boolean;
  _category_slug text;
  _tag jsonb;
  _tag_id uuid;
  _asset jsonb;
begin
  if nullif(btrim(_source),'') is null or nullif(btrim(_external_id),'') is null then
    raise exception 'Source and external ID are required';
  end if;
  select id into _platform_id from public.platforms where slug=_platform_slug and active;
  if _platform_id is null then raise exception 'Active platform % not found', _platform_slug; end if;

  insert into public.raw_source_items(source,external_id,last_run_id,status,raw_payload,raw_hash,normalized_hash,last_seen_at)
  values(_source,_external_id,_run_id,'normalized',_raw,_raw_hash,_normalized_hash,now())
  on conflict(source,external_id) do update set
    last_run_id=excluded.last_run_id, raw_payload=excluded.raw_payload, raw_hash=excluded.raw_hash,
    normalized_hash=excluded.normalized_hash, last_seen_at=now(), error_message=null
  returning * into _raw_item;

  select * into _plugin from public.plugins where source=_source and external_id=_external_id for update;
  if found and _plugin.source_data_hash=_normalized_hash and not _force then
    update public.plugins set last_imported_at=now(),source_last_checked_at=now(),source_available=true,
      source_missing_count=0 where id=_plugin.id;
    update public.raw_source_items set plugin_id=_plugin.id,status=case when _plugin.moderation_status='approved' then 'published'::public.source_item_status else 'needs_review'::public.source_item_status end,
      normalized_at=now() where id=_raw_item.id;
    return jsonb_build_object('outcome','unchanged','plugin_id',_plugin.id,'slug',_plugin.slug);
  end if;

  _is_valid := length(btrim(coalesce(_normalized->>'name',''))) between 2 and 120
    and length(btrim(coalesce(_normalized->>'short_description',''))) between 10 and 300
    and coalesce(_normalized->>'source_url','') ~ '^https://[^ /]+';

  if not found then
    _desired_slug := left(regexp_replace(lower(coalesce(_normalized->>'slug',_external_id)),'[^a-z0-9]+','-','g'),80);
    _desired_slug := trim(both '-' from _desired_slug);
    if length(_desired_slug)<3 then _desired_slug := left(_source||'-'||md5(_external_id),80); end if;
    if exists(select 1 from public.plugins where slug=_desired_slug) then
      _desired_slug := left(_source||'-'||_desired_slug,71)||'-'||left(md5(_external_id),8);
    end if;
    insert into public.plugins(
      name,slug,short_description,full_description,platform_id,developer_id,price,currency,pricing_model,
      current_version,compatibility,license,is_open_source,website_url,external_purchase_url,listing_type,
      is_claimable,moderation_status,published_at,logo_url,source,external_id,source_url,source_author_name,
      source_author_url,source_updated_at,source_published_at,last_imported_at,source_data_hash,
      source_rating_average,source_ratings_count,source_installs_count,source_downloads_count,source_managed,
      source_missing_count,source_last_checked_at,source_available
    ) values (
      left(btrim(_normalized->>'name'),120),_desired_slug,left(btrim(coalesce(_normalized->>'short_description','Description unavailable')),300),
      left(nullif(_normalized->>'description',''),20000),_platform_id,null,0,coalesce(nullif(_normalized->>'currency',''),'USD'),'free',
      nullif(_normalized->>'version',''),left(nullif(_normalized->>'compatibility',''),2000),left(nullif(_normalized->>'license',''),200),
      coalesce((_normalized->>'is_open_source')::boolean,false),nullif(_normalized->>'homepage_url',''),_normalized->>'source_url','external_listing',
      true,case when _is_valid then 'approved'::public.moderation_status else 'pending_review'::public.moderation_status end,
      case when _is_valid then now() else null end,nullif(_normalized->>'icon_url',''),_source,_external_id,_normalized->>'source_url',
      nullif(_normalized->>'author_name',''),nullif(_normalized->>'author_url',''),nullif(_normalized->>'source_updated_at','')::timestamptz,
      nullif(_normalized->>'published_at','')::timestamptz,now(),_normalized_hash,nullif(_normalized->>'rating','')::numeric,
      nullif(_normalized->>'ratings_count','')::integer,nullif(_normalized->>'installs_count','')::bigint,
      nullif(_normalized->>'downloads_count','')::bigint,true,0,now(),true
    ) returning * into _plugin;
    _result := 'created';
  elsif _plugin.source_managed and _plugin.developer_id is null and _plugin.is_claimable then
    update public.plugins set
      name=left(btrim(_normalized->>'name'),120),short_description=left(btrim(coalesce(_normalized->>'short_description','Description unavailable')),300),
      full_description=left(nullif(_normalized->>'description',''),20000),platform_id=_platform_id,current_version=nullif(_normalized->>'version',''),
      compatibility=left(nullif(_normalized->>'compatibility',''),2000),license=left(nullif(_normalized->>'license',''),200),
      is_open_source=coalesce((_normalized->>'is_open_source')::boolean,false),website_url=nullif(_normalized->>'homepage_url',''),
      external_purchase_url=_normalized->>'source_url',logo_url=nullif(_normalized->>'icon_url',''),source_url=_normalized->>'source_url',
      source_author_name=nullif(_normalized->>'author_name',''),source_author_url=nullif(_normalized->>'author_url',''),
      source_updated_at=nullif(_normalized->>'source_updated_at','')::timestamptz,source_published_at=nullif(_normalized->>'published_at','')::timestamptz,
      last_imported_at=now(),source_data_hash=_normalized_hash,source_rating_average=nullif(_normalized->>'rating','')::numeric,
      source_ratings_count=nullif(_normalized->>'ratings_count','')::integer,source_installs_count=nullif(_normalized->>'installs_count','')::bigint,
      source_downloads_count=nullif(_normalized->>'downloads_count','')::bigint,source_missing_count=0,source_last_checked_at=now(),source_available=true,
      moderation_status=case when source_hidden_at is not null and _is_valid then 'approved'::public.moderation_status else moderation_status end,
      published_at=case when source_hidden_at is not null and _is_valid then now() else published_at end,source_hidden_at=null
    where id=_plugin.id returning * into _plugin;
    _result := 'updated';
  else
    update public.plugins set last_imported_at=now(),source_last_checked_at=now(),source_available=true,source_missing_count=0 where id=_plugin.id returning * into _plugin;
    _result := 'unchanged';
  end if;

  if _plugin.source_managed and _plugin.developer_id is null then
    delete from public.plugin_categories where plugin_id=_plugin.id;
    for _category_slug in select jsonb_array_elements_text(coalesce(_normalized->'category_slugs','[]'::jsonb)) loop
      insert into public.plugin_categories(plugin_id,category_id)
      select _plugin.id,id from public.categories where slug=_category_slug and active on conflict do nothing;
    end loop;
    delete from public.plugin_tags where plugin_id=_plugin.id;
    for _tag in select value from jsonb_array_elements(coalesce(_normalized->'tags','[]'::jsonb)) loop
      insert into public.tags(name,slug) values(left(_tag->>'name',80),left(_tag->>'slug',80))
      on conflict(slug) do update set name=excluded.name returning id into _tag_id;
      insert into public.plugin_tags(plugin_id,tag_id) values(_plugin.id,_tag_id) on conflict do nothing;
    end loop;
    delete from public.plugin_assets where plugin_id=_plugin.id and storage_path is null;
    for _asset in select value from jsonb_array_elements(coalesce(_normalized->'assets','[]'::jsonb)) loop
      if coalesce(_asset->>'url','') ~ '^https://[^ /]+' then
        insert into public.plugin_assets(plugin_id,asset_type,storage_path,public_url,alt_text,sort_order)
        values(_plugin.id,(_asset->>'type')::public.asset_type,null,_asset->>'url',left(_asset->>'alt',200),coalesce((_asset->>'sort_order')::integer,0));
      end if;
    end loop;
  end if;
  update public.raw_source_items set plugin_id=_plugin.id,status=case when _plugin.moderation_status='approved' then 'published'::public.source_item_status else 'needs_review'::public.source_item_status end,
    normalized_at=now(),error_message=null where id=_raw_item.id;
  return jsonb_build_object('outcome',_result,'plugin_id',_plugin.id,'slug',_plugin.slug);
exception when others then
  update public.raw_source_items set status='error',error_message=left(sqlerrm,2000) where source=_source and external_id=_external_id;
  raise;
end $$;

revoke all on function public.ingest_source_item(uuid,text,text,text,jsonb,text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.ingest_source_item(uuid,text,text,text,jsonb,text,jsonb,text,boolean) to service_role;

create or replace function public.record_source_presence(_source text,_external_id text,_exists boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare _p public.plugins;
begin
  select * into _p from public.plugins where source=_source and external_id=_external_id and source_managed for update;
  if not found then return jsonb_build_object('outcome','ignored'); end if;
  if _exists then
    update public.plugins set source_available=true,source_missing_count=0,source_last_checked_at=now(),
      moderation_status=case when source_hidden_at is not null then 'approved'::public.moderation_status else moderation_status end,
      published_at=case when source_hidden_at is not null then now() else published_at end,source_hidden_at=null where id=_p.id returning * into _p;
    return jsonb_build_object('outcome','present','plugin_id',_p.id);
  end if;
  update public.plugins set source_available=false,source_missing_count=source_missing_count+1,source_last_checked_at=now(),
    moderation_status=case when source_missing_count+1>=3 then 'suspended'::public.moderation_status else moderation_status end,
    source_hidden_at=case when source_missing_count+1>=3 then coalesce(source_hidden_at,now()) else source_hidden_at end
  where id=_p.id returning * into _p;
  update public.raw_source_items set status=case when _p.source_missing_count>=3 then 'needs_review'::public.source_item_status else status end,
    error_message=case when _p.source_missing_count>=3 then 'Listing absent from the official source in three consecutive successful checks' else error_message end
  where source=_source and external_id=_external_id;
  return jsonb_build_object('outcome',case when _p.source_missing_count>=3 then 'hidden' else 'missing' end,'missing_count',_p.source_missing_count,'plugin_id',_p.id);
end $$;

revoke all on function public.record_source_presence(text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_source_presence(text,text,boolean) to service_role;

alter type public.asset_type add value if not exists 'cover';
create or replace function public.publishing_action(_actor uuid, _action text, _input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 p public.plugins; v public.plugin_versions; u public.plugin_uploads;
 pid uuid; did uuid; vid uuid; uid uuid; item uuid; k text; path text; result jsonb;
begin
 if private.publishing_account_created_at(_actor) is null then raise exception 'Authentication required'; end if;
 if _action='create' then
  did:=(_input->>'developer_id')::uuid;
  if not exists(select 1 from public.developer_profiles where id=did and owner_id=_actor) then raise exception 'Developer profile unavailable'; end if;
  if private.publishing_account_created_at(_actor)>now()-interval '5 minutes' then raise exception 'Your account must be at least 5 minutes old before creating a plugin'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_actor::text,1));
  pid:=(_input->>'id')::uuid;
  select * into p from public.plugins where id=pid;
  if found then
   if p.developer_id<>did then raise exception 'Plugin unavailable'; end if;
   return to_jsonb(p);
  end if;
  if (select count(*) from public.plugins where developer_id=did and created_at>now()-interval '1 hour')>=20 then raise exception 'Creation limit reached. Please try again later'; end if;
 else
  pid:=(_input->>'id')::uuid;
  select * into p from public.plugins where id=pid for update;
  if not found then raise exception 'Plugin unavailable'; end if;
  if _action not in ('download','record_download','outbound') and not exists(select 1 from public.developer_profiles where id=p.developer_id and owner_id=_actor) then raise exception 'Plugin unavailable'; end if;
 end if;

 if _action in ('create','save') then
  if _action='save' and p.moderation_status<>'draft' then raise exception 'Only drafts can be edited'; end if;
  if length(btrim(coalesce(_input->>'name','')))<2 or length(_input->>'name')>120 then raise exception 'Name must contain 2–120 characters'; end if;
  if coalesce(_input->>'slug','') !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Slug must contain 3–80 lowercase letters, numbers or hyphens'; end if;
  if length(btrim(coalesce(_input->>'short_description','')))<10 or length(_input->>'short_description')>300 then raise exception 'Short description must contain 10–300 characters'; end if;
  if length(coalesce(_input->>'full_description',''))>20000 or length(coalesce(_input->>'compatibility',''))>2000 then raise exception 'Description is too long'; end if;
  if not exists(select 1 from public.platforms where id=(_input->>'platform_id')::uuid and active) then raise exception 'Choose an active platform'; end if;
  if coalesce(_input->>'listing_type','') not in ('direct_sale','external_listing') then raise exception 'Invalid distribution model'; end if;
  if nullif(_input->>'external_purchase_url','') is not null and (_input->>'external_purchase_url' !~ '^https://[^ /]+' or length(_input->>'external_purchase_url')>2048) then raise exception 'External URL must use HTTPS'; end if;
  if _action='create' then
   insert into public.plugins(id,developer_id,name,slug,short_description,platform_id,listing_type,moderation_status,pricing_model,price)
   values(pid,did,btrim(_input->>'name'),_input->>'slug',btrim(_input->>'short_description'),(_input->>'platform_id')::uuid,(_input->>'listing_type')::public.listing_type,'draft','free',0);
  end if;
  update public.plugins set name=btrim(_input->>'name'),slug=_input->>'slug',short_description=btrim(_input->>'short_description'),
   platform_id=(_input->>'platform_id')::uuid, full_description=_input->>'full_description',compatibility=_input->>'compatibility',
   license=left(_input->>'license',200),listing_type=(_input->>'listing_type')::public.listing_type,
   external_purchase_url=nullif(_input->>'external_purchase_url','') where id=pid;
  if jsonb_array_length(coalesce(_input->'categories','[]'))>10 or jsonb_array_length(coalesce(_input->'tags','[]'))>20 then raise exception 'Too many categories or tags'; end if;
  delete from public.plugin_categories where plugin_id=pid;
  for item in select value::uuid from jsonb_array_elements_text(coalesce(_input->'categories','[]')) loop
   if not exists(select 1 from public.categories where id=item and active) then raise exception 'Invalid category'; end if;
   insert into public.plugin_categories values(pid,item) on conflict do nothing;
  end loop;
  delete from public.plugin_tags where plugin_id=pid;
  for item in select value::uuid from jsonb_array_elements_text(coalesce(_input->'tags','[]')) loop
   insert into public.plugin_tags values(pid,item) on conflict do nothing;
  end loop;
  if jsonb_array_length(coalesce(_input->'tag_names','[]'))>5 then raise exception 'Add up to five new tags at a time'; end if;
  for k in select lower(btrim(value)) from jsonb_array_elements_text(coalesce(_input->'tag_names','[]')) loop
   if k !~ '^[a-z0-9][a-z0-9 -]{1,38}[a-z0-9]$' then raise exception 'Tags need 3–40 letters, numbers, spaces or hyphens'; end if;
   path:=regexp_replace(k,' +','-','g');
   insert into public.tags(name,slug) values(k,path) on conflict do nothing;
   select id into item from public.tags where slug=path or name=k order by created_at limit 1;
   if item is not null then insert into public.plugin_tags values(pid,item) on conflict do nothing; end if;
  end loop;
 elsif _action='version' then
  if p.moderation_status<>'draft' or p.listing_type<>'direct_sale' then raise exception 'Only hosted drafts can edit versions'; end if;
  if coalesce(_input->>'version_number','') !~ '^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$' then raise exception 'Invalid version number'; end if;
  if length(coalesce(_input->>'changelog',''))>10000 or length(coalesce(_input->>'compatibility',''))>2000 then raise exception 'Version text is too long'; end if;
  select * into v from public.plugin_versions where plugin_id=pid order by created_at limit 1 for update;
  if found then
   if v.status not in ('draft','pending_review') then raise exception 'Published versions are immutable'; end if;
   update public.plugin_versions set version_number=_input->>'version_number',changelog=_input->>'changelog',compatibility=_input->>'compatibility' where id=v.id;
  else
   insert into public.plugin_versions(plugin_id,version_number,changelog,compatibility) values(pid,_input->>'version_number',_input->>'changelog',_input->>'compatibility');
  end if;
 elsif _action='reserve_upload' then
  if p.moderation_status<>'draft' then raise exception 'Uploads are only available for drafts'; end if;
  if (select count(*) from public.plugin_uploads where actor_id=_actor and created_at>now()-interval '1 hour')>=60 then raise exception 'Upload limit reached. Try again later'; end if;
  k:=_input->>'kind'; uid:=gen_random_uuid();
  if k not in ('zip','logo','screenshot','banner','cover') then raise exception 'Invalid upload kind'; end if;
  if k='zip' then
   select * into v from public.plugin_versions where plugin_id=pid and status='draft' order by created_at limit 1;
   if not found or p.listing_type<>'direct_sale' then raise exception 'Save a draft version first'; end if;
   vid:=v.id;
  end if;
  if (_input->>'size')::bigint<1 or (_input->>'size')::bigint>(case when k='zip' then 52428800 else 5242880 end) then raise exception 'File exceeds the size limit'; end if;
  if k='zip' and (_input->>'mime' not in ('application/zip','application/x-zip-compressed','application/octet-stream') or lower(_input->>'name') not like '%.zip') then raise exception 'Choose a ZIP file'; end if;
  if k<>'zip' and _input->>'mime' not in ('image/jpeg','image/png','image/webp') then raise exception 'Choose JPEG, PNG or WebP'; end if;
  path:=p.developer_id::text||'/'||pid::text||'/'||coalesce(vid::text,'media')||'/'||uid::text;
  insert into public.plugin_uploads(id,plugin_id,actor_id,version_id,kind,bucket,staging_path,final_path,original_name,mime,size)
  values(uid,pid,_actor,vid,k,case when k='zip' then 'plugin-files' else 'plugin-assets' end,'staging/'||path,'verified/'||path,left(_input->>'name',200),_input->>'mime',(_input->>'size')::bigint) returning * into u;
  return to_jsonb(u);
 elsif _action='finish_upload' then
  select * into u from public.plugin_uploads where id=(_input->>'upload_id')::uuid and actor_id=_actor and plugin_id=pid for update;
  if not found then raise exception 'Upload unavailable'; end if;
  if u.completed_at is not null then return to_jsonb(p); end if;
  if p.moderation_status<>'draft' then raise exception 'Draft has already been submitted'; end if;
  if u.kind='zip' then
   update public.plugin_versions set file_path=u.final_path,file_size=u.size,file_verified_at=now() where id=u.version_id and plugin_id=pid and status='draft';
   if not found then raise exception 'Version unavailable'; end if;
  else
   if u.kind='screenshot' and (select count(*) from public.plugin_assets where plugin_id=pid and asset_type='screenshot')>=10 then raise exception 'Maximum 10 screenshots'; end if;
   if u.kind in ('logo','banner') then delete from public.plugin_assets where plugin_id=pid and asset_type=u.kind::public.asset_type; end if;
   insert into public.plugin_assets(plugin_id,asset_type,storage_path,public_url,sort_order) values(pid,u.kind::public.asset_type,u.final_path,_input->>'public_url',(select count(*) from public.plugin_assets where plugin_id=pid));
   if u.kind='logo' then update public.plugins set logo_url=_input->>'public_url' where id=pid; end if;
  end if;
  update public.plugin_uploads set completed_at=now() where id=u.id;
 elsif _action='remove_asset' then
  if p.moderation_status<>'draft' then raise exception 'Only drafts can be edited'; end if;
  delete from public.plugin_assets where id=(_input->>'asset_id')::uuid and plugin_id=pid returning asset_type into k;
  if k='logo' then update public.plugins set logo_url=null where id=pid; end if;
 elsif _action='revise' then
  if p.moderation_status<>'rejected' then raise exception 'Only rejected submissions can be revised'; end if;
  update public.plugins set moderation_status='draft' where id=pid;
  update public.plugin_versions set status='draft' where plugin_id=pid and status='pending_review';
 elsif _action='submit' then
  if p.moderation_status='pending_review' then return to_jsonb(p); end if;
  if p.moderation_status<>'draft' then raise exception 'Only drafts can be submitted'; end if;
  if length(btrim(coalesce(p.full_description,'')))<30 or nullif(btrim(p.compatibility),'') is null or p.logo_url is null
    or not exists(select 1 from public.plugin_categories where plugin_id=pid)
    or not exists(select 1 from public.plugin_tags where plugin_id=pid)
    or not exists(select 1 from public.plugin_assets where plugin_id=pid and asset_type='screenshot') then raise exception 'Complete description, compatibility, categories, tags, logo and screenshots'; end if;
  if p.listing_type='direct_sale' then
   select * into v from public.plugin_versions where plugin_id=pid and status='draft' order by created_at limit 1 for update;
   if not found or v.file_verified_at is null or v.file_path is null or nullif(btrim(v.changelog),'') is null or nullif(btrim(v.compatibility),'') is null then raise exception 'A verified ZIP, changelog and version compatibility are required'; end if;
   update public.plugin_versions set status='pending_review' where id=v.id;
  elsif nullif(p.external_purchase_url,'') is null then raise exception 'External URL is required'; end if;
  update public.plugins set moderation_status='pending_review',rejection_reason=null where id=pid;
 elsif _action in ('download','record_download') then
  if p.listing_type<>'direct_sale' then raise exception 'This plugin is distributed externally'; end if;
  if exists(select 1 from public.developer_profiles where id=p.developer_id and owner_id=_actor) or exists(select 1 from public.user_roles where user_id=_actor and role='admin') then
   select * into v from public.plugin_versions where plugin_id=pid and file_verified_at is not null order by is_current desc,created_at desc limit 1;
   k:='test';
  else
   if p.moderation_status<>'approved' then raise exception 'Plugin is not available for download'; end if;
   if p.pricing_model<>'free' and not exists(select 1 from public.purchases where user_id=_actor and plugin_id=pid and status in ('paid','partially_refunded')) then raise exception 'Purchase unavailable'; end if;
   select * into v from public.plugin_versions where plugin_id=pid and status='published' and is_current and file_verified_at is not null;
  end if;
  if v.id is null or v.file_path is null then raise exception 'No verified ZIP is available'; end if;
  if _action='record_download' and k is distinct from 'test' then
   if not exists(select 1 from public.plugin_analytics_events where plugin_id=pid and event_type='download' and session_hash=md5(_actor::text||pid::text) and created_at>now()-interval '10 minutes') then
    insert into public.plugin_analytics_events(plugin_id,developer_id,event_type,session_hash) values(pid,p.developer_id,'download',md5(_actor::text||pid::text));
    update public.plugins set downloads_count=downloads_count+1 where id=pid;
   end if;
  end if;
  return jsonb_build_object('file_path',v.file_path,'filename',p.slug||'-'||v.version_number||'.zip','test',k='test');
 elsif _action='outbound' then
  if p.moderation_status<>'approved' or p.listing_type<>'external_listing' or p.external_purchase_url is null then raise exception 'External listing unavailable'; end if;
  if not exists(select 1 from public.plugin_analytics_events where plugin_id=pid and event_type='outbound_click' and session_hash=md5(_actor::text||pid::text) and created_at>now()-interval '10 minutes') then
   insert into public.plugin_analytics_events(plugin_id,developer_id,event_type,session_hash) values(pid,p.developer_id,'outbound_click',md5(_actor::text||pid::text));
  end if;
  return jsonb_build_object('url',p.external_purchase_url);
 else raise exception 'Unknown publishing action'; end if;
 select to_jsonb(x) into result from public.plugins x where id=pid;
 return result;
end; $$;
revoke all on function public.publishing_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publishing_action(uuid,text,jsonb) to service_role;



drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated
with check (
 user_id=(select auth.uid()) and status='active' and exists (
   select 1 from public.plugin_analytics_events e
   join public.plugins p on p.id=e.plugin_id
   where e.plugin_id=reviews.plugin_id and e.event_type='download'
     and e.session_hash=md5((select auth.uid())::text||e.plugin_id::text)
     and p.moderation_status='approved' and p.listing_type='direct_sale'
     and p.developer_id not in (select d.id from public.developer_profiles d where d.owner_id=(select auth.uid()))
 )
);

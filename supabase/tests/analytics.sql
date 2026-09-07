-- Analytics integrity/security regression checks. Fixtures are always rolled back.
begin;
create temp table analytics_fixture(owner_id uuid,viewer_id uuid,admin_id uuid,developer_id uuid,hosted_id uuid,external_id uuid,platform_id uuid);
insert into analytics_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),(select id from public.platforms where active limit 1));
grant select on analytics_fixture to authenticated,anon,service_role;
insert into auth.users(id,email,created_at,raw_user_meta_data)
select owner_id,owner_id||'@analytics-test.invalid',now()-interval '1 day','{}'::jsonb from analytics_fixture
union all select viewer_id,viewer_id||'@analytics-test.invalid',now()-interval '1 day','{}'::jsonb from analytics_fixture
union all select admin_id,admin_id||'@analytics-test.invalid',now()-interval '1 day','{}'::jsonb from analytics_fixture;
insert into public.user_roles(user_id,role) select admin_id,'admin' from analytics_fixture;
insert into public.developer_profiles(id,owner_id,name,slug)
select developer_id,owner_id,'Analytics owner','analytics-'||developer_id from analytics_fixture;
insert into public.plugins(id,developer_id,name,slug,short_description,platform_id,listing_type,moderation_status,external_purchase_url,published_at)
select hosted_id,developer_id,'Hosted analytics','hosted-'||hosted_id,'Hosted analytics fixture',platform_id,'direct_sale'::public.listing_type,'approved'::public.moderation_status,null,now() from analytics_fixture
union all select external_id,developer_id,'External analytics','external-'||external_id,'External analytics fixture',platform_id,'external_listing'::public.listing_type,'approved'::public.moderation_status,'https://example.com/plugin',now() from analytics_fixture;

set local role service_role;
do $$ declare f record; x jsonb; begin
  select * into f from analytics_fixture;
  x:=public.record_plugin_interaction(f.hosted_id,'page_view',f.owner_id,repeat('1',64));
  if (x->>'counted')::boolean then raise exception 'Owner preview counted'; end if;
  x:=public.record_plugin_interaction(f.hosted_id,'page_view',f.admin_id,repeat('2',64));
  if (x->>'counted')::boolean then raise exception 'Admin preview counted'; end if;
  x:=public.record_plugin_interaction(f.hosted_id,'page_view',f.viewer_id,repeat('3',64));
  if not (x->>'counted')::boolean then raise exception 'Public view not counted'; end if;
  x:=public.record_plugin_interaction(f.hosted_id,'page_view',f.viewer_id,repeat('3',64));
  if (x->>'counted')::boolean then raise exception 'Refresh view was not deduplicated'; end if;
  if (select views_count from public.plugins where id=f.hosted_id)<>1 then raise exception 'View counter drift'; end if;
  begin perform public.record_plugin_interaction(f.hosted_id,'outbound_click',f.viewer_id,repeat('4',64)); raise exception 'Hosted outbound accepted'; exception when raise_exception then if SQLERRM='Hosted outbound accepted' then raise; end if; end;
  x:=public.record_plugin_interaction(f.external_id,'outbound_click',null,repeat('5',64));
  if not (x->>'counted')::boolean or x->>'url'<>'https://example.com/plugin' then raise exception 'Anonymous external click failed'; end if;
  x:=public.record_plugin_interaction(f.external_id,'outbound_click',null,repeat('5',64));
  if (x->>'counted')::boolean then raise exception 'External click was not deduplicated'; end if;
  if (select downloads_count from public.plugins where id=f.external_id)<>0 then raise exception 'External click changed downloads'; end if;
  update public.plugins set developer_unpublished_at=now() where id=f.hosted_id;
  begin perform public.record_plugin_interaction(f.hosted_id,'page_view',f.viewer_id,repeat('6',64)); raise exception 'Unpublished view accepted'; exception when raise_exception then if SQLERRM='Unpublished view accepted' then raise; end if; end;
  begin perform public.record_plugin_interaction(f.external_id,'download',f.viewer_id,repeat('7',64)); raise exception 'Arbitrary event accepted'; exception when raise_exception then if SQLERRM='Arbitrary event accepted' then raise; end if; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from analytics_fixture),true);
do $$ declare f record; d jsonb; r text; begin
  select * into f from analytics_fixture;
  foreach r in array array['7','30','90','365','all'] loop
    d:=public.developer_dashboard(f.developer_id,f.external_id,r,1);
    if not (d->'history'->>'available')::boolean then raise exception 'Tracking coverage unavailable for %',r; end if;
    if jsonb_array_length(d->'history'->'series')<1 then raise exception 'Missing buckets for %',r; end if;
  end loop;
  begin perform public.record_plugin_interaction(f.hosted_id,'page_view',f.owner_id,repeat('8',64)); raise exception 'Direct analytics RPC exposed'; exception when insufficient_privilege then null; end;
  begin update public.reviews set rating=1 where user_id=f.owner_id; raise exception 'Direct review update exposed'; exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ declare f record; begin
  select * into f from analytics_fixture;
  begin perform public.record_plugin_interaction(f.external_id,'outbound_click',null,repeat('9',64)); raise exception 'Anonymous RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Analytics tracking, deduplication, ranges and authorization checks passed.' result;

-- Integration regression checks. Fixtures and all writes are rolled back.
begin;
create temporary table dashboard_fixture(a uuid,b uuid,da uuid,db uuid,p1 uuid,p2 uuid);
insert into dashboard_fixture(a,b,p1,p2) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select,update on dashboard_fixture to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select a,a::text||'@dashboard-test.invalid','{}'::jsonb from dashboard_fixture
union all select b,b::text||'@dashboard-test.invalid','{}'::jsonb from dashboard_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select a::text from dashboard_fixture),true);
update dashboard_fixture set da=public.save_developer_profile(jsonb_build_object('name','Dashboard A','slug','dashboard-'||a,'account_type','individual','is_public',false,'evidence_links',jsonb_build_array('https://example.com/proof')));
do $$ declare f record; again uuid; begin
  select * into f from dashboard_fixture;
  again:=public.save_developer_profile(jsonb_build_object('name','Duplicate','slug','another-'||f.a,'account_type','individual'));
  if again<>f.da then raise exception 'Duplicate onboarding created another profile'; end if;
  begin
    update public.developer_profiles set stripe_charges_enabled=true where id=f.da;
    raise exception 'Stripe write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.developer_profiles set owner_id=f.b where id=f.da;
    raise exception 'Owner write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub',(select b::text from dashboard_fixture),true);
do $$ declare f record; begin
  select * into f from dashboard_fixture;
  begin
    perform public.save_developer_profile(jsonb_build_object('name','Dashboard B','slug','dashboard-'||f.a,'account_type','company'));
    raise exception 'Duplicate slug accepted';
  exception when unique_violation then null; end;
end; $$;
update dashboard_fixture set db=public.save_developer_profile(jsonb_build_object('name','Dashboard B','slug','dashboard-'||b,'account_type','company'));
do $$ declare f record; begin
  select * into f from dashboard_fixture;
  if exists(select 1 from public.developer_profiles where id=f.da) then raise exception 'Private profile leaked'; end if;
  if exists(select 1 from public.developer_profile_evidence where developer_id=f.da) then raise exception 'Evidence leaked'; end if;
  begin
    perform public.developer_dashboard(f.da);
    raise exception 'Foreign analytics allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_developer_profile('{"name":"Changed","slug":"changed-name","account_type":"individual"}',f.da);
    raise exception 'Foreign profile edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('avatars',f.a::text||'/forbidden.png');
    raise exception 'Foreign avatar upload allowed';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id,name) values('avatars',f.b::text||'/allowed.png');
  if (public.developer_dashboard(f.db)->'history'->>'available')::boolean then raise exception 'Empty profile has invented history'; end if;
end; $$;
reset role;
insert into public.plugins(id,name,slug,short_description,platform_id,developer_id,downloads_count,views_count,rating_average,reviews_count)
select p1,'Test plugin A','test-'||p1,'Fixture',(select id from public.platforms limit 1),da,10,40,4,2 from dashboard_fixture
union all select p2,'Test plugin B','test-'||p2,'Fixture',(select id from public.platforms limit 1),da,20,60,5,6 from dashboard_fixture;
insert into public.plugin_analytics_events(plugin_id,developer_id,event_type,created_at)
select p1,da,'download'::public.analytics_event_type,now() from dashboard_fixture
union all select p2,da,'page_view'::public.analytics_event_type,now()-interval '40 days' from dashboard_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select a::text from dashboard_fixture),true);
do $$ declare f record; d jsonb; r text; begin
  select * into f from dashboard_fixture;
  d:=public.developer_dashboard(f.da);
  if (d->'totals'->>'plugins')::integer<>2 or (d->'totals'->>'downloads')::integer<>30 or (d->'totals'->>'rating')::numeric<>4.75 then raise exception 'Incorrect aggregate totals: %',d; end if;
  if (d->'history'->>'downloads_last_30_days')::integer<>1 then raise exception 'Wrong 30-day download count'; end if;
  if jsonb_array_length(d->'history'->'series')<>1 then raise exception 'Wrong default range'; end if;
  foreach r in array array['7','30','90','365','all'] loop
    d:=public.developer_dashboard(f.da,null,r,1);
    if (d->'history'->>'bucket') <> (case when r in ('365','all') then 'month' else 'day' end) then raise exception 'Wrong time bucket'; end if;
  end loop;
  d:=public.developer_dashboard(f.da,f.p1);
  if (d->'totals'->>'plugins')::integer<>1 then raise exception 'Plugin filter ignored'; end if;
  begin
    perform public.developer_dashboard(f.db,f.p1);
    raise exception 'Foreign profile allowed';
  exception when insufficient_privilege then null; end;
end; $$;
set local role anon;
do $$ begin
  begin
    perform public.developer_dashboard(gen_random_uuid());
    raise exception 'Anonymous dashboard allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_developer_profile('{}');
    raise exception 'Anonymous onboarding allowed';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
select 'Account dashboard isolation and aggregation checks passed; fixtures rolled back.' as result;

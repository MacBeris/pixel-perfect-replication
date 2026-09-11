-- Security regression checks. All fixtures and mutations are rolled back.
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'admin_audit_logs','categories','claims','collection_plugins','collections',
    'developer_balances','developer_members','developer_profile_evidence',
    'developer_profiles','favorites','payouts','platforms','plugin_change_requests',
    'profiles','purchases','reports','reviews','tags','transactions','user_roles'
  ] loop
    if has_table_privilege('anon', 'public.'||table_name, 'TRUNCATE')
       or has_table_privilege('authenticated', 'public.'||table_name, 'TRUNCATE') then
      raise exception 'TRUNCATE remains exposed on %', table_name;
    end if;
    if has_table_privilege('anon', 'public.'||table_name, 'TRIGGER,REFERENCES')
       or has_table_privilege('authenticated', 'public.'||table_name, 'TRIGGER,REFERENCES') then
      raise exception 'DDL-adjacent privileges remain exposed on %', table_name;
    end if;
  end loop;

  if has_table_privilege('anon','public.claims','SELECT')
     or has_table_privilege('anon','public.reports','SELECT')
     or has_table_privilege('anon','public.user_roles','SELECT')
     or has_table_privilege('anon','public.collections','INSERT') then
    raise exception 'Anonymous private-data privileges remain exposed';
  end if;
  if has_column_privilege('anon','public.developer_profiles','stripe_account_id','SELECT')
     or has_column_privilege('authenticated','public.developer_profiles','stripe_account_id','SELECT')
     or has_column_privilege('anon','public.plugin_versions','file_path','SELECT')
     or has_column_privilege('authenticated','public.plugin_assets','storage_path','SELECT') then
    raise exception 'Sensitive columns remain exposed';
  end if;
  if has_sequence_privilege('anon','public.site_analytics_events_id_seq','USAGE')
     or has_sequence_privilege('authenticated','public.site_analytics_events_id_seq','USAGE') then
    raise exception 'Analytics sequence remains exposed';
  end if;
  if has_function_privilege('authenticated','public.admin_moderate_plugin(uuid,uuid,public.moderation_status,text)','EXECUTE')
     or has_function_privilege('anon','public.publishing_action(uuid,text,jsonb)','EXECUTE') then
    raise exception 'Privileged RPC remains client-callable';
  end if;
  if not has_function_privilege('service_role','public.ingest_source_item(uuid,text,text,text,jsonb,text,jsonb,text,boolean)','EXECUTE')
     or not has_function_privilege('service_role','public.admin_moderate_plugin(uuid,uuid,public.moderation_status,text)','EXECUTE') then
    raise exception 'Required service-role RPC lost';
  end if;
end $$;

create temp table security_fixture(
  a uuid, b uuid, admin_id uuid, da uuid, db uuid, public_plugin uuid, draft_plugin uuid,
  private_collection uuid, public_collection uuid, claim_id uuid, report_id uuid
);
insert into security_fixture(a,b,admin_id,da,db,public_plugin,draft_plugin,private_collection,public_collection,claim_id,report_id)
values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
       gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select,update on security_fixture to authenticated, anon, service_role;

insert into auth.users(id,email,created_at,raw_user_meta_data)
select a,a||'@security-test.invalid',now()-interval '1 day','{}'::jsonb from security_fixture
union all select b,b||'@security-test.invalid',now()-interval '1 day','{}'::jsonb from security_fixture
union all select admin_id,admin_id||'@security-test.invalid',now()-interval '1 day','{}'::jsonb from security_fixture;
insert into public.user_roles(user_id,role) select admin_id,'admin' from security_fixture;
insert into public.developer_profiles(id,owner_id,name,slug,is_public)
select da,a,'Security A','security-a-'||da,false from security_fixture
union all select db,b,'Security B','security-b-'||db,false from security_fixture;
insert into public.developer_profile_evidence(developer_id,links)
select da,array['https://example.com/a'] from security_fixture
union all select db,array['https://example.com/b'] from security_fixture;
insert into public.plugins(id,name,slug,short_description,platform_id,developer_id,moderation_status,published_at)
select public_plugin,'Public security plugin','public-security-'||public_plugin,'Public fixture',(select id from public.platforms where active limit 1),da,'approved'::public.moderation_status,now() from security_fixture
union all select draft_plugin,'Draft security plugin','draft-security-'||draft_plugin,'Draft fixture',(select id from public.platforms where active limit 1),da,'draft'::public.moderation_status,null from security_fixture;
insert into public.plugin_versions(plugin_id,version_number,status,file_path,file_verified_at,is_current)
select public_plugin,'1.0.0','published'::public.version_status,'private/security/plugin.zip',now(),true from security_fixture;
insert into public.collections(id,owner_id,name,slug,is_public)
select private_collection,a,'Private collection','private-'||private_collection,false from security_fixture
union all select public_collection,a,'Public collection','public-'||public_collection,true from security_fixture;
insert into public.favorites(user_id,plugin_id) select a,public_plugin from security_fixture;
insert into public.claims(id,plugin_id,claimant_user_id,evidence)
select claim_id,public_plugin,a,'private proof' from security_fixture;
insert into public.reports(id,target_type,plugin_id,reporter_user_id,reason)
select report_id,'plugin'::public.report_target,public_plugin,a,'private report' from security_fixture;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
  if (select count(*) from public.plugins where slug like 'public-security-%') <> 1 then
    raise exception 'Public approved plugin is not readable';
  end if;
  if exists(select 1 from public.plugins where slug like 'draft-security-%') then
    raise exception 'Draft plugin leaked to anonymous user';
  end if;
  begin perform count(*) from public.claims; raise exception 'Claims readable by anon';
    exception when insufficient_privilege then null; end;
  begin perform count(*) from public.reports; raise exception 'Reports readable by anon';
    exception when insufficient_privilege then null; end;
  begin perform count(*) from public.user_roles; raise exception 'Roles readable by anon';
    exception when insufficient_privilege then null; end;
  begin perform file_path from public.plugin_versions limit 1; raise exception 'Private file path readable by anon';
    exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select b::text from security_fixture),true);
do $$
declare affected integer;
begin
  if exists(select 1 from public.favorites where user_id=(select a from security_fixture))
     or exists(select 1 from public.collections where id=(select private_collection from security_fixture))
     or exists(select 1 from public.developer_profile_evidence where developer_id=(select da from security_fixture))
     or exists(select 1 from public.claims where id=(select claim_id from security_fixture))
     or exists(select 1 from public.reports where id=(select report_id from security_fixture))
     or exists(select 1 from public.user_roles where user_id=(select a from security_fixture)) then
    raise exception 'User A private data leaked to user B';
  end if;

  update public.profiles set bio='tampered' where id=(select a from security_fixture);
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'User B updated user A profile'; end if;

  begin update public.plugins set name='tampered' where id=(select draft_plugin from security_fixture);
    raise exception 'Direct foreign plugin update allowed';
    exception when insufficient_privilege then null; end;
  begin insert into public.user_roles(user_id,role) values((select b from security_fixture),'admin');
    raise exception 'Self-service admin escalation allowed';
    exception when insufficient_privilege then null; end;
  begin perform public.admin_moderate_plugin((select b from security_fixture),(select draft_plugin from security_fixture),'approved',null);
    raise exception 'Admin RPC exposed to ordinary user';
    exception when insufficient_privilege then null; end;
  begin insert into public.claims(plugin_id,claimant_user_id,status)
    values((select public_plugin from security_fixture),(select b from security_fixture),'approved');
    raise exception 'User supplied claim moderation state';
    exception when insufficient_privilege then null; end;
end $$;

reset role;
-- Hidden lifecycle state must also hide child metadata from anonymous callers.
update public.plugins set developer_unpublished_at=now() where id=(select public_plugin from security_fixture);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
  if exists(select 1 from public.plugins where id=(select public_plugin from security_fixture))
     or exists(select 1 from public.plugin_versions where plugin_id=(select public_plugin from security_fixture)) then
    raise exception 'Unpublished plugin metadata leaked';
  end if;
end $$;

reset role;
set local role service_role;
do $$
begin
  perform public.admin_moderate_plugin(
    (select admin_id from security_fixture),
    (select draft_plugin from security_fixture),
    'rejected',
    'security test'
  );
  if (select moderation_status from public.plugins where id=(select draft_plugin from security_fixture)) <> 'rejected' then
    raise exception 'Admin moderation stopped working';
  end if;
end $$;

rollback;
select 'Least-privilege grants, RLS isolation, RPC authorization and public catalogue checks passed.' result;

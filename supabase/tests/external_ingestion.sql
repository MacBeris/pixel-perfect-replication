-- External ingestion regression tests; all fixture writes are rolled back.
begin;
set local role service_role;

do $$
declare
  eid text := 'ingestion-test-'||gen_random_uuid();
  normalized jsonb;
  first_result jsonb;
  second_result jsonb;
  pid uuid;
begin
  normalized := jsonb_build_object(
    'source','wordpress','external_id',eid,'slug',eid,'name','Ingestion Test',
    'short_description','A valid external ingestion test listing.','description','Test source description.',
    'source_url','https://wordpress.org/plugins/'||eid||'/','homepage_url',null,'version','1.0.0',
    'currency','USD','is_open_source',true,'category_slugs',jsonb_build_array('content'),
    'tags',jsonb_build_array(jsonb_build_object('name','Ingestion Test '||eid,'slug',eid)),
    'assets','[]'::jsonb
  );
  first_result := public.ingest_source_item(null,'wordpress','wordpress',eid,jsonb_build_object('id',eid),'raw-a',normalized,'normalized-a',false);
  second_result := public.ingest_source_item(null,'wordpress','wordpress',eid,jsonb_build_object('id',eid),'raw-a',normalized,'normalized-a',false);
  pid := (first_result->>'plugin_id')::uuid;
  if first_result->>'outcome'<>'created' or second_result->>'outcome'<>'unchanged' then raise exception 'Ingestion is not idempotent'; end if;
  if (select count(*) from public.plugins where source='wordpress' and external_id=eid)<>1 then raise exception 'Duplicate source identity'; end if;
  if (select moderation_status from public.plugins where id=pid)<>'approved' then raise exception 'Trusted valid item was not published'; end if;

  perform public.record_source_presence('wordpress',eid,false);
  perform public.record_source_presence('wordpress',eid,false);
  if (select moderation_status from public.plugins where id=pid)<>'approved' then raise exception 'Listing hidden before third confirmed miss'; end if;
  perform public.record_source_presence('wordpress',eid,false);
  if (select moderation_status from public.plugins where id=pid)<>'suspended' or (select source_hidden_at from public.plugins where id=pid) is null then raise exception 'Listing not hidden after third confirmed miss'; end if;
  perform public.record_source_presence('wordpress',eid,true);
  if (select moderation_status from public.plugins where id=pid)<>'approved' or (select source_missing_count from public.plugins where id=pid)<>0 then raise exception 'Reappearing listing was not restored'; end if;

  update public.plugins set developer_id=(select id from public.developer_profiles limit 1),is_claimable=false where id=pid;
  if (select source_managed from public.plugins where id=pid) then raise exception 'Claimed listing remained source-managed'; end if;
  normalized := jsonb_set(normalized,'{name}','"Source overwrite attempt"');
  perform public.ingest_source_item(null,'wordpress','wordpress',eid,jsonb_build_object('id',eid),'raw-b',normalized,'normalized-b',true);
  if (select name from public.plugins where id=pid)<>'Ingestion Test' then raise exception 'Claimed listing was overwritten'; end if;
end $$;

do $$ begin
  if has_table_privilege('anon','public.raw_source_items','select') or has_table_privilege('authenticated','public.import_runs','select') then
    raise exception 'Private ingestion tables are exposed';
  end if;
end $$;

rollback;

create or replace function public.admin_review_plugin_change_request(_actor_id uuid,_request_id uuid,_approve boolean,_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_row public.plugin_change_requests; before_row public.plugins; after_row public.plugins; changes jsonb;
begin
  if not exists(select 1 from public.user_roles where user_id=_actor_id and role='admin') then raise exception 'Administrator access is required'; end if;
  select * into request_row from public.plugin_change_requests where id=_request_id for update;
  if not found or request_row.status<>'pending' then raise exception 'Change request unavailable'; end if;
  select * into before_row from public.plugins where id=request_row.plugin_id for update;
  if not found then raise exception 'Plugin unavailable'; end if;
  changes:=request_row.changed_fields;
  if _approve then
    if changes?'name' and (length(btrim(changes->>'name'))<2 or length(changes->>'name')>120) then raise exception 'Invalid name'; end if;
    if changes?'slug' and changes->>'slug' !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Invalid slug'; end if;
    if changes?'platform_id' and not exists(select 1 from public.platforms where id=(changes->>'platform_id')::uuid and active) then raise exception 'Invalid platform'; end if;
    if changes?'listing_type' and changes->>'listing_type' not in ('direct_sale','external_listing') then raise exception 'Invalid distribution model'; end if;
    if changes?'compatibility' and length(coalesce(changes->>'compatibility',''))>2000 then raise exception 'Compatibility is too long'; end if;
    if changes?'external_purchase_url' and nullif(changes->>'external_purchase_url','') is not null and changes->>'external_purchase_url' !~ '^https://[^ /]+' then raise exception 'External URL must use HTTPS'; end if;
    if coalesce(changes->>'listing_type',before_row.listing_type::text)='direct_sale' and not exists(select 1 from public.plugin_versions where plugin_id=before_row.id and status='published' and file_verified_at is not null) then raise exception 'A hosted plugin requires a published verified release'; end if;
    update public.plugins set
      name=case when changes?'name' then btrim(changes->>'name') else name end,
      slug=case when changes?'slug' then changes->>'slug' else slug end,
      platform_id=case when changes?'platform_id' then (changes->>'platform_id')::uuid else platform_id end,
      listing_type=case when changes?'listing_type' then (changes->>'listing_type')::public.listing_type else listing_type end,
      compatibility=case when changes?'compatibility' then changes->>'compatibility' else compatibility end,
      external_purchase_url=case when changes?'external_purchase_url' then nullif(changes->>'external_purchase_url','') else external_purchase_url end
    where id=before_row.id returning * into after_row;
  else
    after_row:=before_row;
  end if;
  update public.plugin_change_requests set status=case when _approve then 'approved'::public.change_request_status else 'rejected'::public.change_request_status end,admin_notes=nullif(btrim(_notes),''),reviewed_at=now() where id=_request_id;
  insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state,reason)
    values(_actor_id,case when _approve then 'plugin.change_request_approved' else 'plugin.change_request_rejected' end,'plugin',before_row.id,to_jsonb(before_row)||jsonb_build_object('request',changes),to_jsonb(after_row),nullif(btrim(_notes),''));
  return jsonb_build_object('request_id',_request_id,'plugin_id',before_row.id,'approved',_approve);
end; $$;
revoke all on function public.admin_review_plugin_change_request(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_review_plugin_change_request(uuid,uuid,boolean,text) to service_role;

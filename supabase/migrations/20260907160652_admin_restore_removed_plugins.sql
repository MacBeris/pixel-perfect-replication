create or replace function public.admin_restore_removed_plugin(_actor_id uuid,_plugin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_row public.plugins; after_row public.plugins;
begin
  if not exists(select 1 from public.user_roles where user_id=_actor_id and role='admin') then raise exception 'Administrator access is required'; end if;
  select * into before_row from public.plugins where id=_plugin_id for update;
  if not found then raise exception 'Plugin not found'; end if;
  update public.plugins set developer_removed_at=null,developer_removed_by=null where id=_plugin_id returning * into after_row;
  if before_row.developer_removed_at is not null then
    insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
      values(_actor_id,'plugin.restored_by_admin','plugin',_plugin_id,to_jsonb(before_row),to_jsonb(after_row));
  end if;
  return to_jsonb(after_row);
end; $$;
revoke all on function public.admin_restore_removed_plugin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_restore_removed_plugin(uuid,uuid) to service_role;

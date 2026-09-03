create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.has_purchased(uuid, uuid) set schema private;
alter function public.owns_developer(uuid) set schema private;
alter function public.owns_plugin(uuid) set schema private;
alter function public.plugin_is_public(uuid) set schema private;

revoke all on function private.has_role(uuid, public.app_role) from public;
revoke all on function private.has_purchased(uuid, uuid) from public;
revoke all on function private.owns_developer(uuid) from public;
revoke all on function private.owns_plugin(uuid) from public;
revoke all on function private.plugin_is_public(uuid) from public;
grant execute on function private.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function private.has_purchased(uuid, uuid) to authenticated;
grant execute on function private.owns_developer(uuid) to anon, authenticated;
grant execute on function private.owns_plugin(uuid) to anon, authenticated;
grant execute on function private.plugin_is_public(uuid) to anon, authenticated;

create index if not exists admin_audit_logs_actor_id_idx on public.admin_audit_logs(actor_id);

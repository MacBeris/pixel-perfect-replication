-- Preserve ownership/member semantics; timestamp matches the applied migration.
create or replace function private.owns_plugin(_plugin_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
   select 1 from public.plugins p where p.id=_plugin_id and private.owns_developer(p.developer_id)
 )
$$;

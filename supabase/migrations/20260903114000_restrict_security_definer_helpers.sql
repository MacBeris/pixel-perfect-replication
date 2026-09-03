revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.has_purchased(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.owns_developer(uuid) from public, anon, authenticated;
revoke execute on function public.owns_plugin(uuid) from public, anon, authenticated;
revoke execute on function public.plugin_is_public(uuid) from public, anon, authenticated;

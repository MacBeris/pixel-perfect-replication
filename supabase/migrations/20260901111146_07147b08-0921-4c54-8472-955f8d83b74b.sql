revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.recalc_plugin_rating() from public, anon, authenticated;
revoke all on function public.recalc_plugin_counters() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.plugins_search_vector_trigger() from public, anon, authenticated;
revoke all on function public.has_purchased(uuid, uuid) from anon;
revoke all on function public.owns_plugin(uuid) from anon;
revoke all on function public.owns_developer(uuid) from anon;
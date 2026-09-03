-- Existing public SELECT policies include ownership branches. Anonymous users
-- need EXECUTE permission to evaluate them; auth.uid() is null, so both helpers
-- safely return false for anonymous requests.
grant execute on function public.owns_developer(uuid) to anon;
grant execute on function public.owns_plugin(uuid) to anon;

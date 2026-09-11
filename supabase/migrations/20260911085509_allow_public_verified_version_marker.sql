-- Public download UI needs to know whether an already-public version passed file
-- verification. RLS still limits anonymous callers to published versions of public
-- plugins, and the private storage path remains inaccessible.
grant select (file_verified_at) on public.plugin_versions to anon, authenticated;

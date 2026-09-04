-- Timestamp matches the applied migration.
grant usage on schema private to service_role;
-- Explicit server policy documents intentionally server-only upload reservations.
create policy plugin_uploads_service on public.plugin_uploads for all to service_role using (true) with check (true);

create policy "site_analytics_no_client_read"
on public.site_analytics_events
for select
to anon, authenticated
using (false);

create policy "site_analytics_no_client_insert"
on public.site_analytics_events
for insert
to anon, authenticated
with check (false);

-- Explicit service policies document the private access model and satisfy the RLS advisor.
create policy import_runs_service_only on public.import_runs for all to service_role using (true) with check (true);
create policy raw_source_items_service_only on public.raw_source_items for all to service_role using (true) with check (true);
create index raw_source_items_last_run_idx on public.raw_source_items(last_run_id);

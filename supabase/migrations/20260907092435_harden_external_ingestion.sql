-- Claimed listings become owner-managed and must no longer be refreshed or hidden by source checks.
create or replace function public.stop_source_management_after_claim()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.source_managed and (new.developer_id is not null or not new.is_claimable) then
    new.source_managed := false;
  end if;
  return new;
end $$;

create trigger plugins_stop_source_management_after_claim
before update of developer_id,is_claimable on public.plugins
for each row execute function public.stop_source_management_after_claim();

revoke all on function public.stop_source_management_after_claim() from public,anon,authenticated;
grant execute on function public.stop_source_management_after_claim() to service_role;

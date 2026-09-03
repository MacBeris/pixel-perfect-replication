create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
create index admin_audit_logs_resource_idx on public.admin_audit_logs(resource_type, resource_id);

grant select on public.admin_audit_logs to authenticated;
grant all on public.admin_audit_logs to service_role;

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs_admin_read"
on public.admin_audit_logs
for select
to authenticated
using ((select public.has_role(auth.uid(), 'admin')));

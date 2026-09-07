-- The developer lifecycle wrapper introduced an owner gate before delegating every action.
-- That was correct for edits, but accidentally rejected normal users before the legacy
-- download authorization could validate publication/purchase state. Keep lifecycle actions
-- in the existing wrapper and route only distribution actions through their dedicated checks.
alter function public.publishing_action(uuid,text,jsonb) rename to publishing_action_lifecycle;
revoke all on function public.publishing_action_lifecycle(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publishing_action_lifecycle(uuid,text,jsonb) to service_role;

create function public.publishing_action(_actor uuid,_action text,_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if _action in ('download','record_download','outbound') then
    return public.publishing_action_legacy(_actor,_action,_input);
  end if;
  return public.publishing_action_lifecycle(_actor,_action,_input);
end $$;
revoke all on function public.publishing_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.publishing_action(uuid,text,jsonb) to service_role;

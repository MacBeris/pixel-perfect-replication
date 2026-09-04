create or replace function public.review_download_eligibility(_user_id uuid,_plugin_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.plugin_analytics_events where plugin_id=_plugin_id and event_type='download' and session_hash=md5(_user_id::text||_plugin_id::text))
$$;
revoke all on function public.review_download_eligibility(uuid,uuid) from public,anon,authenticated;
grant execute on function public.review_download_eligibility(uuid,uuid) to service_role;

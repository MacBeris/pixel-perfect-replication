-- Views only became measurable with the public-page tracker. Keep their coverage boundary
-- separate from older download/outbound event history.
alter table public.plugins
  add column view_tracking_started_at timestamptz not null default now();

update public.plugins p
set view_tracking_started_at=e.first_view_at
from (
  select plugin_id,min(created_at) first_view_at
  from public.plugin_analytics_events where event_type='page_view'
  group by plugin_id
) e
where e.plugin_id=p.id and e.first_view_at<p.view_tracking_started_at;

alter function private.developer_dashboard(uuid,uuid,text,integer)
  rename to developer_dashboard_analytics_base;
revoke all on function private.developer_dashboard_analytics_base(uuid,uuid,text,integer)
  from public,anon,authenticated;

create function private.developer_dashboard(_developer_id uuid,_plugin_id uuid,_range text,_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; general_start timestamptz; view_start timestamptz;
begin
  -- The base function performs the session-based ownership and plugin checks before returning.
  result:=private.developer_dashboard_analytics_base(_developer_id,_plugin_id,_range,_page);
  select min(p.analytics_tracking_started_at),min(p.view_tracking_started_at)
    into general_start,view_start
  from public.plugins p
  where p.developer_id=_developer_id and (_plugin_id is null or p.id=_plugin_id);
  return jsonb_set(result,'{history,metric_started_at}',jsonb_build_object(
    'views',view_start,
    'downloads',general_start,
    'outbound_clicks',general_start
  ),true);
end $$;
revoke all on function private.developer_dashboard(uuid,uuid,text,integer) from public,anon;
grant execute on function private.developer_dashboard(uuid,uuid,text,integer) to authenticated;

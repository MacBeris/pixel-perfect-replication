create or replace function private.developer_plugin_detail(_developer_id uuid,_plugin_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.developer_profiles d where d.id=_developer_id and d.owner_id=auth.uid()) then raise exception 'Developer profile unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.plugins p where p.id=_plugin_id and p.developer_id=_developer_id) then raise exception 'Plugin unavailable' using errcode='42501'; end if;
  select jsonb_build_object(
    'cover_url',(select a.public_url from public.plugin_assets a where a.plugin_id=_plugin_id and a.asset_type='cover' order by a.sort_order,a.created_at limit 1),
    'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version_number',v.version_number,'status',v.status,'is_current',v.is_current,'compatibility',v.compatibility,'released_at',v.released_at,'created_at',v.created_at,'changelog',v.changelog) order by v.created_at desc) from public.plugin_versions v where v.plugin_id=_plugin_id),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'rating',r.rating,'title',r.title,'body',r.body,'created_at',r.created_at,'username',coalesce(pr.username,'Extendly user')) order by r.created_at desc) from (select * from public.reviews where plugin_id=_plugin_id and status='active' order by created_at desc limit 20) r left join public.profiles pr on pr.id=r.user_id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(jsonb_build_object('action',x.action,'created_at',x.created_at) order by x.created_at desc) from (
      select event.action,event.created_at from (
        select l.action,l.created_at from public.admin_audit_logs l where l.resource_type='plugin' and l.resource_id=_plugin_id
        union all select 'review.created',r.created_at from public.reviews r where r.plugin_id=_plugin_id and r.status='active'
        union all select 'plugin.created',p.created_at from public.plugins p where p.id=_plugin_id
        union all select 'plugin.published',p.published_at from public.plugins p where p.id=_plugin_id and p.published_at is not null
      ) event order by event.created_at desc limit 30
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

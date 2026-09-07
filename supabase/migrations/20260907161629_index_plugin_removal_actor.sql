create index plugins_developer_removed_by_idx on public.plugins(developer_removed_by)
where developer_removed_by is not null;

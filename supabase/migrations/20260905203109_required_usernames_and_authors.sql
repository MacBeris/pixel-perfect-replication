-- Give every account one canonical public username and expose safe author joins.
update public.profiles
set username = 'user-' || substr(replace(id::text, '-', ''), 1, 12)
where username is null
   or btrim(username) = ''
   or lower(btrim(username)) !~ '^[a-z0-9][a-z0-9_-]{2,29}$';

update public.profiles set username = lower(btrim(username));

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format
    check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

create unique index profiles_username_lower_key on public.profiles(lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if requested !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
    requested := 'user-' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  insert into public.profiles(id, username, display_name, avatar_url)
  values (
    new.id,
    requested,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), requested),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_roles(user_id, role)
  values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$$;

alter table public.reviews
  add constraint reviews_user_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

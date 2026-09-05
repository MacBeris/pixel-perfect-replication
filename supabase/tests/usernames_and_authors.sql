begin;

do $$
declare first_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data)
  values(first_id,first_id||'@username-test.invalid','{"username":"unique_test_user"}');
  if not exists(select 1 from public.profiles where id=first_id and username='unique_test_user') then
    raise exception 'Signup username was not created';
  end if;
  begin
    insert into auth.users(id,email,raw_user_meta_data)
    values(second_id,second_id||'@username-test.invalid','{"username":"unique_test_user"}');
    raise exception 'Duplicate username allowed';
  exception when unique_violation then null;
  end;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from public.profiles where username is null) then
    raise exception 'Public profile without username';
  end if;
end $$;

rollback;

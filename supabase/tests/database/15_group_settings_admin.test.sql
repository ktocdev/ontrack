-- An admin renames the group and turns profile photos off or on. Only an admin, and
-- always logged. Off is enforced here, not only by hiding buttons. Maya (…01) owns a
-- photo below; Ari (…02) is the other person.
begin;
select plan(24);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into storage.objects (bucket_id, name, owner_id)
values ('avatars', '22222222-2222-4222-8222-000000000001/one.jpg', '22222222-2222-4222-8222-000000000001');
update public.profiles set avatar_path = '22222222-2222-4222-8222-000000000001/one.jpg'
where id = '22222222-2222-4222-8222-000000000001';

-- ---------------------------------------------------------------------------
-- The group's name
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.save_group_name('Mine', 'M') $$, '42501', null, 'a manager cannot rename the group');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.save_group_name('  Hog Salt  ', '  HS ') $$, 'an admin can');
select throws_ok($$ select public.save_group_name('   ', 'HS') $$, '23514', null, 'but not to nothing');
select throws_ok($$ select public.save_group_name('Hog Salt', 'much too long a name') $$, '23514', null, 'or too long a short name');
select pg_temp.logout();
select is((select name from public.group_settings), 'Hog Salt', 'the name is trimmed');
select is((select short_name from public.group_settings), 'HS', 'the short name too');
select is((select meta -> 'from' ->> 'name' from public.audit_log where action = 'group.rename' and created_at = now()),
  'Four Corners', 'and the log says what it was');

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.save_group_name('Hog Salt', '  ') $$, 'a blank short name means none');
select pg_temp.logout();
select is((select short_name from public.group_settings), null, 'so there is none');

-- ---------------------------------------------------------------------------
-- Photos on: as before
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from storage.objects where name like '22222222-2222-4222-8222-000000000001/%'), 1,
  'with photos on, others can see a photo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.set_profile_photos(false) $$, '42501', null, 'a manager cannot turn photos off');
select pg_temp.logout();
select pg_temp.login('admin@example.com');
select lives_ok($$ select public.set_profile_photos(false) $$, 'an admin can');
select pg_temp.logout();
select is((select (meta ->> 'on')::boolean from public.audit_log where action = 'group.profile_photos' and created_at = now()),
  false, 'and it is logged');

-- ---------------------------------------------------------------------------
-- Photos off
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from storage.objects where name like '22222222-2222-4222-8222-000000000001/%'), 0,
  'nobody can read someone else''s photo');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', '22222222-2222-4222-8222-000000000002/new.jpg', '22222222-2222-4222-8222-000000000002') $$,
  '42501', null, 'or upload one');
select throws_ok(
  $$ update public.profiles set avatar_path = '22222222-2222-4222-8222-000000000002/new.jpg'
     where id = '22222222-2222-4222-8222-000000000002' $$,
  '42501', 'profile photos are turned off', 'or point their profile at one');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select is((select count(*)::int from storage.objects where name like '22222222-2222-4222-8222-000000000001/%'), 0,
  'not even an admin can read it');
select pg_temp.logout();

select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from storage.objects where name like '22222222-2222-4222-8222-000000000001/%'), 1,
  'the owner still can, since Storage reads a file to remove it');
select lives_ok(
  $$ update public.profiles set full_name = 'Maya Reyes', phone = '(312) 555-0100'
     where id = '22222222-2222-4222-8222-000000000001' $$,
  'other profile edits still work');
select is((select avatar_path from public.profiles where id = '22222222-2222-4222-8222-000000000001'),
  '22222222-2222-4222-8222-000000000001/one.jpg', 'and the path is kept');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Back on, then a person removing their own while off
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select public.set_profile_photos(true);
select pg_temp.logout();
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from storage.objects where name like '22222222-2222-4222-8222-000000000001/%'), 1,
  'on again restores it');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select public.set_profile_photos(false);
select pg_temp.logout();
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$ update public.profiles set avatar_path = null where id = '22222222-2222-4222-8222-000000000001' $$,
  'someone can clear their own photo while off');
select is((select avatar_path from public.profiles where id = '22222222-2222-4222-8222-000000000001'), null, 'and it clears');
select pg_temp.logout();
-- Removing the file itself goes through Storage's API, which blocks direct deletes: e2e/stack/group-settings.spec.ts.

select pg_temp.login('admin@example.com');
update public.group_settings set profile_photos = true;
select pg_temp.logout();
select is((select profile_photos from public.group_settings), false, 'the table still cannot be written directly');

select * from finish();
rollback;

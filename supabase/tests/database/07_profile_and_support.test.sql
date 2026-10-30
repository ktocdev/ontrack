-- Profile self-service (OT-6): people edit their own name, phone and photo but
-- nothing an admin owns; profile photos are written only by their owner; a
-- support report is the reporter's own and only admins see everyone's.
begin;
select plan(17);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  -- Back to the owner first: the lookup below reads auth.users.
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
-- Seed ids (supabase/seed.sql), so lookups never need auth.users mid-test.
\set maya '''22222222-2222-4222-8222-000000000001'''
\set ari '''22222222-2222-4222-8222-000000000002'''

-- ---------------------------------------------------------------------------
-- Own profile
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');

select lives_ok($$
  update public.profiles set full_name = 'Maya R. Reyes', phone = '312-555-0101', avatar_path = auth.uid()::text || '/photo.jpg'
  where id = auth.uid()
$$, 'a manager can change their own name, phone and photo');
select throws_ok(format($$
  update public.profiles set avatar_path = '%s/photo.jpg' where id = auth.uid()
$$, (:ari)), '23514', null, 'but the photo must sit in their own folder');
select is(
  (select full_name from public.profiles where id = auth.uid()),
  'Maya R. Reyes', 'and the change is saved');
select throws_ok($$
  update public.profiles set role = 'admin' where id = auth.uid()
$$, '42501', null, 'a manager cannot make themselves an admin');
select throws_ok($$
  update public.profiles set home_restaurant_id = null where id = auth.uid()
$$, '42501', null, 'or move themselves to another restaurant');

update public.profiles set full_name = 'Not Ari' where email = 'ari.kim@example.com';
select pg_temp.logout();
select is(
  (select full_name from public.profiles where email = 'ari.kim@example.com'),
  'Ari Kim', 'a manager cannot rename someone else');

-- ---------------------------------------------------------------------------
-- Profile photos
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', '%s/photo.jpg', auth.uid()::text)
$$, (:maya)), 'a person can upload a photo to their own folder');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', '%s/photo.jpg', auth.uid()::text)
$$, (:ari)), '42501', null, 'but not into someone else''s folder');

select pg_temp.login('ari.kim@example.com');
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'avatars' and name = (:maya)::text || '/photo.jpg'),
  1, 'colleagues can see a profile photo');
-- Storage refuses direct deletes from SQL, so the owner-only rule is checked
-- on update, which the same policy shape guards.
update storage.objects set name = (:ari)::text || '/stolen.jpg'
  where bucket_id = 'avatars' and name = (:maya)::text || '/photo.jpg';
select pg_temp.logout();
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'avatars' and name = (:maya)::text || '/photo.jpg'),
  1, 'but cannot move or replace it');

-- ---------------------------------------------------------------------------
-- Support reports
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$
  insert into public.support_reports (body, page, app_version) values ('The camera will not open.', '/tickets/new', '0.0.0')
$$, 'a signed-in person can send a report');
select ok(
  (select case_no >= 4800 from public.support_reports where user_id = auth.uid()),
  'and it gets a case number');
select throws_ok(format($$
  insert into public.support_reports (user_id, body) values ('%s', 'Spoofed')
$$, (:ari)), '42501', null, 'a report cannot be filed as someone else');
select throws_ok($$
  insert into public.support_reports (body, emailed_at) values ('Skip the inbox', now())
$$, '42501', null, 'a report cannot claim it was already emailed');

update public.support_reports set body = 'Edited' where user_id = auth.uid();
select is(
  (select body from public.support_reports where user_id = auth.uid()),
  'The camera will not open.', 'a report cannot be edited after it is sent');

select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.support_reports), 0, 'another manager cannot see it');

select pg_temp.login('admin@example.com');
select is((select count(*)::int from public.support_reports), 1, 'an admin can');

select * from finish();
rollback;

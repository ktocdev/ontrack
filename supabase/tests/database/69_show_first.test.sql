-- OT-174: Show first. A job title names the area its people start on (IT's is IT, the rest
-- Front of House); a person's own choice is their own row, read and written by them and read
-- by admins for View as; giving a title clears it; the Job titles sheet sets a title's, logged.
begin;
select plan(20);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

\set maya '''22222222-2222-4222-8222-000000000001'''
\set theo '''22222222-2222-4222-8222-000000000008'''
\set logan '''11111111-1111-4111-8111-000000000001'''
\set gm '''eeeeeeee-eeee-4eee-8eee-000000000001'''
\set chef '''eeeeeeee-eeee-4eee-8eee-000000000002'''
\set it '''eeeeeeee-eeee-4eee-8eee-000000000004'''

-- 1. Each title's first area.
select is((select first_area::text from public.job_titles where id = :it), 'it', 'the IT title starts on IT');
select is((select first_area::text from public.job_titles where id = :chef), 'foh', 'Chef starts on Front of House');
select is((select count(*)::int from public.job_titles where first_area is null), 0, 'every title names one');

-- 2. A person's own: theirs to read and write, nobody else's.
select pg_temp.login('theo.grant@example.com');
select lives_ok($$ insert into public.first_area_prefs (user_id, area) values (auth.uid(), 'boh') $$,
  'Theo picks Back of House for himself');
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$ insert into public.first_area_prefs (user_id, area) values (auth.uid(), 'it') $$,
  'Maya picks IT for herself');
select lives_ok($$ update public.first_area_prefs set area = 'boh' where user_id = auth.uid() $$, 'and changes it');
select is((select area::text from public.first_area_prefs where user_id = auth.uid()), 'boh', 'and reads it back');
select is((select count(*)::int from public.first_area_prefs), 1, 'Maya reads only her own');
select throws_ok(format($$ insert into public.first_area_prefs (user_id, area) values (%L, 'foh') $$, :gm), '42501', null,
  'nobody writes a row for someone else');
update public.first_area_prefs set area = 'foh' where user_id = :theo;
select pg_temp.login('theo.grant@example.com');
select is((select area::text from public.first_area_prefs where user_id = auth.uid()), 'boh', 'nor changes theirs');
select lives_ok($$ delete from public.first_area_prefs where user_id = auth.uid() $$,
  'Theo goes back to his title’s by deleting his row');
select lives_ok($$ insert into public.first_area_prefs (user_id, area) values (auth.uid(), 'boh') $$, 'and picks again');

select pg_temp.login('admin@example.com');
select is((select count(*)::int from public.first_area_prefs where user_id in (:maya, :theo)), 2,
  'an admin reads anyone’s, for View as');

set local role anon;
select throws_ok($$ select * from public.first_area_prefs $$, '42501', null, 'signed out reads nothing');

-- 3. Giving a title starts the person from it.
select pg_temp.login('admin@example.com');
select public.set_person_access((:maya)::uuid, 'manager', array[(:logan)::uuid], (:chef)::uuid);
select pg_temp.su();
select is((select count(*)::int from public.first_area_prefs where user_id = :maya), 0,
  'a new title clears the person’s own first area');

-- 4. The Job titles sheet.
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.save_job_title('eeeeeeee-eeee-4eee-8eee-000000000002', 'Chef', '{}', 'boh') $$,
  '42501', null, 'only an admin changes a title’s first area');

select pg_temp.login('admin@example.com');
select public.add_job_title('Barback', '{}', 'boh');
select pg_temp.su();
select is((select first_area::text from public.job_titles where name = 'Barback'), 'boh', 'a new title takes the one picked');
select is((select meta ->> 'first_area' from public.audit_log where action = 'job_title.add' order by created_at desc, id desc limit 1),
  'boh', 'and the log says so');

select pg_temp.login('admin@example.com');
select public.save_job_title((:chef)::uuid, 'Chef', '{"foh": {"notify": "off", "shown": false}}', null);
select is((select first_area::text from public.job_titles where id = :chef), 'foh', 'saving with none leaves it');
select public.save_job_title((:chef)::uuid, 'Chef', '{"foh": {"notify": "off", "shown": false}}', 'boh');
select pg_temp.su();
select is((select meta ->> 'first_area_to' from public.audit_log where action = 'job_title.save' order by created_at desc, id desc limit 1),
  'boh', 'changing it is logged');

select * from finish();
rollback;

-- OT-179: the security pass over OT-155 to OT-178 found nothing to fix in the database. These
-- keep what it probed and no other test covered: Show first's own rows for an admin who owes
-- a second step and for someone deactivated, and leadership's Overview and Spend with See
-- costs turned off.
begin;
select plan(7);

create function pg_temp.login(p_email text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

\set maya '''22222222-2222-4222-8222-000000000001'''
\set lee '''22222222-2222-4222-8222-000000000005'''

-- Maya picks her own first area.
select pg_temp.login('maya.reyes@example.com');
insert into public.first_area_prefs (user_id, area) values (auth.uid(), 'it');

-- An admin who hasn't given their code yet reads nobody's, nor changes a title's.
select pg_temp.login('admin@example.com', 'aal1');
select is((select count(*)::int from public.first_area_prefs), 0,
  'an admin owing a second step reads no one''s first area');
select throws_ok($$ select public.save_job_title('eeeeeeee-eeee-4eee-8eee-000000000002', 'Chef', '{}', 'it') $$,
  '42501', null, 'nor changes a title''s');
select pg_temp.login('admin@example.com');
select is((select count(*)::int from public.first_area_prefs), 1, 'with the code, the admin reads it for View as');

-- Deactivated, Maya reads and changes nothing of hers.
select pg_temp.login('postgres');
reset role;
update public.profiles set deactivated_at = now() where id = :maya;
select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.first_area_prefs), 0, 'deactivated, Maya reads no first area');
update public.first_area_prefs set area = 'boh';
select pg_temp.login('postgres');
reset role;
select is((select area::text from public.first_area_prefs where user_id = :maya), 'it', 'nor changes hers');

-- Lee with See costs turned off: the Overview's rows say so and carry no spend, and Spend's
-- records are not there to read.
select pg_temp.login('admin@example.com');
select public.set_person_rights(:lee, '[{"key":"see_costs","allowed":false}]');
select pg_temp.login('lee.chen@example.com');
select is((select count(*)::int from public.v_overview_by_month where sees_costs or spend_cents <> 0 or visits <> 0), 0,
  'with See costs off, the Overview carries no spend');
select is((select count(*)::int from public.service_records), 0, 'and Spend has no visits to read');

select * from finish();
rollback;

-- 2-step verification: a session that owes its second step gets nothing back, and
-- the ways of paying it. Admin (…06) has a verified factor from the seed. Lee (…05,
-- leadership) gets one below. Maya (…01) has none and is the control.
begin;
select plan(38);

create function pg_temp.login(p_email text, p_aal text, p_session uuid default null) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated',
      'aal', p_aal, 'session_id', p_session)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000005', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());

-- ---------------------------------------------------------------------------
-- Who is held back
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com', 'aal1');
select ok(public.my_role() = 'manager', 'a manager with no factor needs no second step');
select ok((select count(*) from public.tickets) > 0, 'and still reads their tickets');
select is(public.two_step_status() ->> 'gate', null, 'and is not stopped');
select is((public.two_step_status() ->> 'on')::boolean, false, 'and shows as not on');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal1');
select is(public.my_role(), null, 'a factor at aal1 has no role');
select ok(not public.has_scope('11111111-1111-4111-8111-000000000001'), 'no scope');
select ok(not public.can('see_all_tickets'), 'and no rights');
select is((select count(*)::int from public.tickets), 0, 'so no tickets');
select is((select count(*)::int from public.profiles), 0, 'not even their own profile');
select is((select count(*)::int from public.support_reports), 0, 'no support reports');
select is(public.two_step_status() ->> 'gate', 'challenge', 'and the status says a code is owed');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal2');
select ok(public.my_role() = 'leadership', 'aal2 is enough');
select is(public.two_step_status() ->> 'gate', null, 'and nothing is owed');
select pg_temp.logout();

select pg_temp.login('admin@example.com', 'aal1');
select ok(not coalesce(public.is_admin(), false), 'an admin with a factor at aal1 is not an admin');
select pg_temp.logout();
select pg_temp.login('admin@example.com', 'aal2');
select ok(public.is_admin(), 'until the code');
select pg_temp.logout();

-- Without a factor, an admin is held back all the same: this is the requirement.
delete from auth.mfa_factors where user_id = '22222222-2222-4222-8222-000000000006';
select pg_temp.login('admin@example.com', 'aal1');
select ok(not coalesce(public.is_admin(), false), 'an admin with no factor is not an admin either');
select is(public.two_step_status() ->> 'gate', 'setup', 'and must set it up');
select is((public.two_step_status() ->> 'required')::boolean, true, 'it is required');
select pg_temp.logout();
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000006', '22222222-2222-4222-8222-000000000006', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());

-- ---------------------------------------------------------------------------
-- Backup codes
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000001');
select throws_ok($$ select public.new_backup_codes() $$, '42501', null, 'codes need a real aal2');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal2');
create temp table codes on commit drop as select unnest(public.new_backup_codes()) as code;
select pg_temp.logout();
select is((select count(*)::int from codes), 8, 'eight codes');
select ok((select bool_and(code ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$') from codes), 'in the board''s shape');
select is((select count(*)::int from public.two_step_codes where user_id = '22222222-2222-4222-8222-000000000005'
  and code_hash in (select code from codes)), 0, 'and only hashes are stored');

select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000001');
select is(public.use_backup_code('AAAA-AAAA'), 'wrong', 'a wrong code is refused');
select is(public.my_role(), null, 'and gets nothing');
select pg_temp.logout();

create temp table first_code on commit drop as select code from codes limit 1;
grant select on first_code, codes to authenticated;

select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000001');
select is(public.use_backup_code(lower(replace((select code from first_code), '-', ''))), 'ok', 'a right code passes, typed any way');
select ok(public.my_role() = 'leadership', 'for this session');
select is((public.two_step_status() ->> 'codes_left')::int, 7, 'and one is gone');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000002');
select is(public.my_role(), null, 'another session has not passed');
select is(public.use_backup_code((select code from first_code)), 'wrong', 'and a used code works only once');
select pg_temp.logout();

-- Ten wrong tries in 15 minutes stop the guessing, even with a right code.
insert into public.audit_log (actor_id, action)
select '22222222-2222-4222-8222-000000000005', 'two_step.code_failed' from generate_series(1, 10);
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000002');
select is(public.use_backup_code((select code from codes offset 1 limit 1)), 'locked', 'guessing is stopped');
select pg_temp.logout();
delete from public.audit_log where action = 'two_step.code_failed';

-- ---------------------------------------------------------------------------
-- Don't ask again
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com', 'aal1', '44444444-4444-4444-8444-000000000003');
select throws_ok($$ select public.remember_device() $$, '42501', null, 'no factor, nothing to remember');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal2', '44444444-4444-4444-8444-000000000004');
create temp table device on commit drop as select public.remember_device() as token;
grant select on device to authenticated;
select pg_temp.logout();

select pg_temp.login('maya.reyes@example.com', 'aal1', '44444444-4444-4444-8444-000000000005');
select ok(not public.use_remembered_device((select token from device)), 'someone else''s token does nothing');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000006');
select ok(public.use_remembered_device((select token from device)), 'the remembered phone passes');
select ok(public.my_role() = 'leadership', 'for this session');
select throws_ok($$ select public.new_backup_codes() $$, '42501', null, 'but cannot mint new codes');
select pg_temp.logout();

update public.two_step_devices set expires_at = now() - interval '1 second';
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000007');
select ok(not public.use_remembered_device((select token from device)), 'after 30 days it stops');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Reset, and what an admin sees
-- ---------------------------------------------------------------------------
insert into public.two_step_resets (user_id) values ('22222222-2222-4222-8222-000000000001');
select pg_temp.login('maya.reyes@example.com', 'aal1');
select is(public.two_step_status() ->> 'gate', 'setup', 'a reset person sets it up again');
select throws_ok($$ select public.person_two_step('22222222-2222-4222-8222-000000000005') $$, '42501', null, 'only an admin sees someone''s');
select pg_temp.logout();

select * from finish();
rollback;

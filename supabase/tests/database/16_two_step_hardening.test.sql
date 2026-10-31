-- The audit's findings on 2-step: a token from before a reset is dead, the aal2 claim
-- alone proves nothing, removing your own authenticator doesn't turn it off, and a
-- remembered phone doesn't stand in for a password. Lee (…05) has a factor below;
-- Maya (…01) has none; admin (…06) has one from the seed.
begin;
select plan(32);

create function pg_temp.login(p_email text, p_aal text, p_iat bigint default null, p_amr text default 'password',
  p_session uuid default null) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated',
      'aal', p_aal, 'session_id', p_session, 'iat', p_iat,
      'amr', json_build_array(json_build_object('method', p_amr)))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.mins(p_minutes int) returns bigint language sql as $$
  select extract(epoch from now())::bigint + p_minutes * 60;
$$;

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000005', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());

-- ---------------------------------------------------------------------------
-- The aal2 claim alone proves nothing
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com', 'aal2', pg_temp.mins(0));
select throws_ok($$ select public.new_backup_codes() $$, '42501', null, 'no factor, no codes, whatever the token says');
select throws_ok($$ select public.remember_device() $$, '42501', null, 'and nothing to remember');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- A reset ends everything from before it
-- ---------------------------------------------------------------------------
insert into public.two_step_resets (user_id, reset_at) values ('22222222-2222-4222-8222-000000000006', now());
delete from auth.mfa_factors where user_id = '22222222-2222-4222-8222-000000000006';

select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(-5));
select ok(not coalesce(public.is_admin(), false), 'a token from before the reset is not an admin');
select is((select count(*)::int from public.profiles), 0, 'and reads nothing');
select throws_ok($$ select public.new_backup_codes() $$, '42501', null, 'and cannot mint codes');
select is(public.two_step_status() ->> 'gate', 'setup', 'the status agrees with the database');
select is(public.is_admin(), false, 'is_admin says no, rather than null');
select throws_ok($$ select public.person_two_step('22222222-2222-4222-8222-000000000005') $$, '42501', null,
  'so a blocked admin cannot read someone''s 2-step state');
select pg_temp.logout();

select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(5));
select ok(not coalesce(public.is_admin(), false), 'a newer token with no factor is not one either');
select pg_temp.logout();
select is((select count(*)::int from public.two_step_resets where user_id = '22222222-2222-4222-8222-000000000006'
  and answered_at is null), 1, 'and the reset still stands');

-- Set up again: the new token works, and the one from before stays dead.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000006', '22222222-2222-4222-8222-000000000006', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());
select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(5));
select ok(public.is_admin(), 'a token from after the reset, with the new factor, is an admin');
select is(cardinality(public.new_backup_codes()), 8, 'and can get codes');
select pg_temp.logout();
select isnt((select answered_at from public.two_step_resets where user_id = '22222222-2222-4222-8222-000000000006'), null,
  'which answers the reset');

select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(-5));
select ok(not coalesce(public.is_admin(), false), 'the old token stays dead after the new setup');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- A reset is required at the database, for everyone
-- ---------------------------------------------------------------------------
insert into public.two_step_resets (user_id) values ('22222222-2222-4222-8222-000000000001');
select pg_temp.login('maya.reyes@example.com', 'aal1', pg_temp.mins(5));
select is(public.my_role(), null, 'a manager who was reset gets nothing until set up again');
select is(public.two_step_status() ->> 'gate', 'setup', 'and is told so');
select pg_temp.logout();
delete from public.two_step_resets where user_id = '22222222-2222-4222-8222-000000000001';

-- ---------------------------------------------------------------------------
-- Removing your own authenticator does not turn it off
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com', 'aal2', pg_temp.mins(0));
select is(cardinality(public.new_backup_codes()), 8, 'Lee has set it up');
select pg_temp.logout();
delete from auth.mfa_factors where user_id = '22222222-2222-4222-8222-000000000005';

select pg_temp.login('lee.chen@example.com', 'aal2', pg_temp.mins(0));
select is(public.my_role(), null, 'with the factor gone, the aal2 token gets nothing');
select pg_temp.logout();
select pg_temp.login('lee.chen@example.com', 'aal1', pg_temp.mins(1));
select is(public.my_role(), null, 'nor does a password alone');
select is(public.two_step_status() ->> 'gate', 'setup', 'they must set it up again');
select is((public.two_step_status() ->> 'required')::boolean, true, 'it is required now');
select pg_temp.logout();

select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(5));
select is((public.person_two_step('22222222-2222-4222-8222-000000000005') ->> 'required')::boolean, true,
  'and an admin sees that');
select pg_temp.logout();

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000005', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());

-- ---------------------------------------------------------------------------
-- Remembering a phone
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com', 'aal1', pg_temp.mins(1), 'password', '44444444-4444-4444-8444-000000000011');
select is(public.my_role(), null, 'set up again, a password alone owes a code');
select pg_temp.logout();

-- A pass from a backup code is not enough to remember the phone.
insert into public.two_step_passes (session_id, user_id)
values ('44444444-4444-4444-8444-000000000012', '22222222-2222-4222-8222-000000000005');
select pg_temp.login('lee.chen@example.com', 'aal1', pg_temp.mins(1), 'password', '44444444-4444-4444-8444-000000000012');
select ok(public.my_role() = 'leadership', 'a pass lets someone in');
select throws_ok($$ select public.remember_device() $$, '42501', null, 'but cannot remember the phone');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal2', pg_temp.mins(1));
create temp table device on commit drop as select public.remember_device() as token;
grant select on device to authenticated;
select pg_temp.logout();

-- A password reset link's session carries otp, not password.
select pg_temp.login('lee.chen@example.com', 'aal1', pg_temp.mins(1), 'otp', '44444444-4444-4444-8444-000000000013');
select ok(not public.use_remembered_device((select token from device)), 'a reset link cannot spend a remembered phone');
select is(public.my_role(), null, 'so it gets nothing');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com', 'aal1', pg_temp.mins(1), 'password', '44444444-4444-4444-8444-000000000014');
select ok(public.use_remembered_device((select token from device)), 'a password sign-in can');
select ok(public.my_role() = 'leadership', 'and is let in');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- New codes end what was remembered, and only the service role ends sessions
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com', 'aal2', pg_temp.mins(1));
select is(cardinality(public.new_backup_codes()), 8, 'new codes');
select ok(not public.use_remembered_device((select token from device)), 'end remembered phones');
select pg_temp.logout();

select pg_temp.login('admin@example.com', 'aal2', pg_temp.mins(5));
select throws_ok($$ select public.end_sessions('22222222-2222-4222-8222-000000000005') $$, '42501', null,
  'not even an admin can end sessions directly');
select pg_temp.logout();

select * from finish();
rollback;

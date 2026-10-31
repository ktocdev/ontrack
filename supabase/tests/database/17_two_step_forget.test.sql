-- A new password or a deactivation ends remembered phones and passes, whichever way it
-- happens. Backup codes stay. Lee (…05) has a factor below.
begin;
select plan(13);

create function pg_temp.login(p_email text, p_aal text, p_session uuid default null) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated',
      'aal', p_aal, 'session_id', p_session,
      'amr', json_build_array(json_build_object('method', 'password')))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.trust_lee() returns void language plpgsql as $$
begin
  delete from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000005';
  delete from public.two_step_passes where user_id = '22222222-2222-4222-8222-000000000005';
  insert into public.two_step_devices (token_hash, user_id) values ('hash', '22222222-2222-4222-8222-000000000005');
  insert into public.two_step_passes (session_id, user_id)
  values ('44444444-4444-4444-8444-000000000021', '22222222-2222-4222-8222-000000000005');
end $$;

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-000000000005', '22222222-2222-4222-8222-000000000005', 'test', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now(), now());
insert into public.two_step_codes (user_id, code_hash) values ('22222222-2222-4222-8222-000000000005', 'code');

select pg_temp.trust_lee();
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000021');
select ok(public.my_role() = 'leadership', 'a pass lets Lee in');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Other writes to the auth row leave it alone
-- ---------------------------------------------------------------------------
update auth.users set last_sign_in_at = now() where id = '22222222-2222-4222-8222-000000000005';
select is((select count(*)::int from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000005'), 1,
  'signing in keeps a remembered phone');
select is((select count(*)::int from public.two_step_passes where user_id = '22222222-2222-4222-8222-000000000005'), 1,
  'and a pass');

-- ---------------------------------------------------------------------------
-- A new password
-- ---------------------------------------------------------------------------
update auth.users set encrypted_password = 'new-hash' where id = '22222222-2222-4222-8222-000000000005';
select is((select count(*)::int from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000005'), 0,
  'a new password ends remembered phones');
select is((select count(*)::int from public.two_step_passes where user_id = '22222222-2222-4222-8222-000000000005'), 0,
  'and passes');
select is((select count(*)::int from public.two_step_codes where user_id = '22222222-2222-4222-8222-000000000005'), 1,
  'but keeps backup codes');
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000021');
select is(public.my_role(), null, 'so the session that held the pass owes a code again');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Someone else's trust is untouched
-- ---------------------------------------------------------------------------
insert into public.two_step_devices (token_hash, user_id) values ('other', '22222222-2222-4222-8222-000000000001');
update auth.users set encrypted_password = 'another-hash' where id = '22222222-2222-4222-8222-000000000005';
select is((select count(*)::int from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000001'), 1,
  'nobody else loses theirs');

-- ---------------------------------------------------------------------------
-- Deactivation, and reactivating brings nothing back
-- ---------------------------------------------------------------------------
select pg_temp.trust_lee();
update public.profiles set deactivated_at = now() where id = '22222222-2222-4222-8222-000000000005';
select is((select count(*)::int from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000005'), 0,
  'deactivating ends remembered phones');
select is((select count(*)::int from public.two_step_passes where user_id = '22222222-2222-4222-8222-000000000005'), 0,
  'and passes');
update public.profiles set deactivated_at = null where id = '22222222-2222-4222-8222-000000000005';
select is((select count(*)::int from public.two_step_devices where user_id = '22222222-2222-4222-8222-000000000005'), 0,
  'reactivating brings nothing back');
select pg_temp.login('lee.chen@example.com', 'aal1', '44444444-4444-4444-8444-000000000021');
select is(public.my_role(), null, 'so they owe a code');
select throws_ok($$ select public.two_step_forget_trust('22222222-2222-4222-8222-000000000001') $$, '42501', null,
  'and nobody can call the clean-up on someone else');
select pg_temp.logout();

select * from finish();
rollback;

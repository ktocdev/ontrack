-- Admin on any role (OT-122). Rosa, the head ops manager, is on the Support Team and holds
-- Admin. Admin is given and taken only through set_admin, by an admin, never your own, and
-- never from the last active admin; it needs 2-step; it adds the group's two admin rights
-- and leaves every other right to the role.
begin;
select plan(34);

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

\set rosa '''22222222-2222-4222-8222-000000000009'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set dana '''22222222-2222-4222-8222-000000000007'''
\set admin '''22222222-2222-4222-8222-000000000006'''
\set logan '''11111111-1111-4111-8111-000000000001'''
\set porter '''11111111-1111-4111-8111-000000000003'''

-- ---------------------------------------------------------------------------
-- The head ops manager: Support Team, holding Admin
-- ---------------------------------------------------------------------------

select pg_temp.login('rosa.delgado@example.com');
select is(public.my_role(), 'ops'::public.app_role, 'Rosa''s role is the Support Team''s');
select ok(public.is_admin(), 'and she is an admin');
select ok(public.can('invite_users') and public.can('manage_rights'), 'she holds the two admin rights');
select ok(public.can('update_status', :porter), 'and works tickets as the Support Team does');
select ok(public.can('create_tickets', :porter), 'her other rights are her role''s');
select lives_ok($$ select public.log_view_as('22222222-2222-4222-8222-000000000003') $$,
  'she views as someone who isn''t an admin');
select pg_temp.logout();

select pg_temp.login('bert.velilla@example.com');
select ok(not public.is_admin() and not public.can('invite_users'), 'the rest of the Support Team is not');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Who may give and take it
-- ---------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000004', true) $$,
  '42501', null, 'someone who isn''t an admin can''t give it');
select pg_temp.logout();

select pg_temp.login('rosa.delgado@example.com');
select throws_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000009', false) $$,
  '42501', null, 'nobody takes their own away');
select throws_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000006', false) $$,
  '22023', null, 'nor takes it from someone whose role is Admin');
select throws_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000003', null) $$,
  '22004', null, 'it needs a yes or a no');
select throws_ok($$ select public.set_admin('00000000-0000-4000-8000-000000000000', true) $$,
  'P0002', null, 'and someone who exists');
select throws_ok($$ update public.profiles set is_admin = true where id = '22222222-2222-4222-8222-000000000003' $$,
  '42501', null, 'an admin can''t give it by writing the profile');
select throws_ok($$ select public.log_view_as('22222222-2222-4222-8222-000000000006') $$,
  '22023', null, 'nobody holding Admin is viewed as');

-- Rosa gives Maya, a Reporter at one restaurant, Admin.
select lives_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000001', true) $$,
  'an admin gives someone Admin');
select is(
  (select meta from public.audit_log where action = 'user.admin' and target_user_id = :maya order by created_at desc limit 1),
  '{"on": true}'::jsonb, 'which is logged');
select throws_ok($$ select public.log_view_as('22222222-2222-4222-8222-000000000001') $$,
  '22023', null, 'and from then on she isn''t viewed as either');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Admin needs 2-step
-- ---------------------------------------------------------------------------

select ok(public.two_step_required(:maya), 'holding Admin makes 2-step required');
select pg_temp.login('maya.reyes@example.com');
select is(public.two_step_status() ->> 'gate', 'setup', 'so without an authenticator she is asked to set one up');
select ok(not public.is_admin() and public.my_role() is null, 'and reads nothing until she does');
select pg_temp.logout();

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('33333333-3333-4333-8333-0000000000a1', :maya, 'OnTrack', 'totp', 'verified', 'JBSWY3DPEHPK3PXP', now(), now());

select pg_temp.login('maya.reyes@example.com');
select ok(public.is_admin(), 'with it set up, she is an admin');
select ok(public.can('invite_users', :porter), 'whose admin rights reach every restaurant');
select ok(not public.can('create_tickets', :porter), 'while her work stays at her own');
select ok(public.can('create_tickets', :logan), 'where she still files tickets');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Rights: an admin with a working role still can't change their own
-- ---------------------------------------------------------------------------

select pg_temp.login('rosa.delgado@example.com');
select throws_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000009', '[{"key":"see_costs","allowed":false}]') $$,
  '42501', null, 'an admin can''t change their own overrides');
select lives_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000003', '[{"key":"see_costs","allowed":false}]') $$,
  'but changes someone else''s');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000009', '[{"key":"see_costs","allowed":false}]') $$,
  'and another admin may change Rosa''s, since her role isn''t Admin');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- There is always an active admin
-- ---------------------------------------------------------------------------

select pg_temp.login('rosa.delgado@example.com');
select lives_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000001', false) $$,
  'Admin is taken away');
select pg_temp.logout();
select ok(not (select is_admin from public.profiles where id = :maya), 'and she no longer holds it');

-- With admin@ deactivated, Rosa is the last active admin.
update public.profiles set deactivated_at = now() where id = :admin;
select throws_ok($$ update public.profiles set deactivated_at = now() where id = '22222222-2222-4222-8222-000000000009' $$,
  '23514', null, 'the last admin can''t be deactivated, even by the service role');
select throws_ok($$ update public.profiles set is_admin = false where id = '22222222-2222-4222-8222-000000000009' $$,
  '23514', null, 'nor lose Admin');
select throws_ok($$ delete from public.profiles where id = '22222222-2222-4222-8222-000000000009' $$,
  '23514', null, 'nor be deleted');

select pg_temp.login('rosa.delgado@example.com');
select throws_ok($$ select public.set_admin('22222222-2222-4222-8222-000000000006', true) $$,
  '22023', null, 'a deactivated person isn''t given Admin');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- An invite carries Admin
-- ---------------------------------------------------------------------------

insert into public.invites (id, email, full_name, role, restaurant_ids, token_hash, is_admin)
values ('88888888-8888-4888-8888-0000000000d1', 'new.head@example.com', 'New Head', 'ops', '{}', 'admin-invite', true);
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user)
values ('00000000-0000-0000-0000-000000000000', 'deadbeef-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated',
  'new.head@example.com', 'x', now(), '{"provider":"email","invite_id":"88888888-8888-4888-8888-0000000000d1"}', '{}',
  now(), now(), '', '', '', '', false);
select is(
  (select role::text || ':' || is_admin::text from public.profiles where id = 'deadbeef-0000-4000-8000-0000000000d1'),
  'ops:true', 'someone invited with Admin holds it on top of their role');

select * from finish();
rollback;

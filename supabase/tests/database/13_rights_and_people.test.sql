-- Roles & rights and User profile: who may change what, the locks, and the log.
begin;
select plan(32);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select throws_ok($$ select public.save_role_defaults('[{"role":"manager","key":"see_costs","allowed":true}]') $$,
  '42501', null, 'a manager cannot change defaults');
select throws_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000002', '[{"key":"see_costs","allowed":true}]') $$,
  '42501', null, 'or anyone''s rights');
select ok(not public.can('see_costs', '11111111-1111-4111-8111-000000000004'), 'Ari starts without see_costs');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.save_role_defaults('[{"role":"manager","key":"see_costs","allowed":true}]') $$,
  'an admin changes a default');
select pg_temp.logout();
-- created_at = now() is this test's own transaction, whatever a local stack already holds.
select is((select count(*)::int from public.audit_log where action = 'rights.defaults' and created_at = now()), 1, 'and it is logged');
select is((select updated_by from public.rights where role = 'manager' and key = 'see_costs'),
  '22222222-2222-4222-8222-000000000006'::uuid, 'with who did it');

select pg_temp.login('ari.kim@example.com');
select ok(public.can('see_costs', '11111111-1111-4111-8111-000000000004'), 'the change reaches can() at once');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select throws_ok($$ select public.save_role_defaults('[{"role":"admin","key":"manage_rights","allowed":false}]') $$,
  '42501', 'admin rights cannot be changed', 'the admin column is locked, even for an admin');
select throws_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000006', '[{"key":"see_costs","allowed":false}]') $$,
  '42501', 'admin rights cannot be changed', 'and so is overriding an admin');
select lives_ok($$ select public.save_role_defaults('[{"role":"manager","key":"see_costs","allowed":false}]') $$, 'back again');

-- ---------------------------------------------------------------------------
-- Overrides
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000002', '[{"key":"see_costs","allowed":true}]') $$,
  'an admin grants one person a right');
select pg_temp.logout();
select pg_temp.login('ari.kim@example.com');
select ok(public.can('see_costs', '11111111-1111-4111-8111-000000000004'), 'which wins over the default');
select pg_temp.logout();
select pg_temp.login('admin@example.com');
select lives_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000002', '[{"key":"see_costs","allowed":null}]') $$,
  'null goes back to the default');
select pg_temp.logout();
select pg_temp.login('ari.kim@example.com');
select ok(not public.can('see_costs', '11111111-1111-4111-8111-000000000004'), 'and it does');
select pg_temp.logout();
select is((select count(*)::int from public.audit_log where action = 'rights.override' and created_at = now()), 2, 'each override is logged');

-- ---------------------------------------------------------------------------
-- Someone with manage_rights who is not an admin cannot raise themselves
-- ---------------------------------------------------------------------------
insert into public.rights (user_id, key, allowed)
values ('22222222-2222-4222-8222-000000000002', 'manage_rights', true);
select pg_temp.login('ari.kim@example.com');
select throws_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000002', '[{"key":"see_costs","allowed":true}]') $$,
  '42501', 'nobody can change their own rights', 'not through their own overrides');
select throws_ok($$ select public.save_role_defaults('[{"role":"manager","key":"see_costs","allowed":true}]') $$,
  '42501', 'nobody can change their own rights', 'nor their own role''s defaults');
select throws_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000001', '[{"key":"invite_users","allowed":true}]') $$,
  '42501', 'only an admin can change invite_users', 'nor hand out invite_users');
select lives_ok($$ select public.set_person_rights('22222222-2222-4222-8222-000000000001', '[{"key":"log_cost","allowed":true}]') $$,
  'an ordinary right for someone else is what the right is for');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Role and restaurants
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select throws_ok($$ select public.set_person_access('22222222-2222-4222-8222-000000000001', 'ops', '{}') $$,
  '42501', null, 'only an admin changes a role');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select throws_ok($$ select public.set_person_access('22222222-2222-4222-8222-000000000006', 'ops', '{}') $$,
  '42501', null, 'not even their own');
select throws_ok($$ select public.set_person_access('22222222-2222-4222-8222-000000000004', 'manager', '{}') $$,
  '23514', null, 'a manager needs a restaurant');

-- Chris (ops) becomes the manager of Porter, which has none, then goes back.
select lives_ok($$ select public.set_person_access('22222222-2222-4222-8222-000000000004', 'manager', '{11111111-1111-4111-8111-000000000003}') $$,
  'an admin moves someone');
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000003'),
  '22222222-2222-4222-8222-000000000004'::uuid, 'who takes a restaurant with no manager');
select lives_ok($$ select public.set_person_access('22222222-2222-4222-8222-000000000004', 'ops', '{}') $$, 'and back');
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000003'), null,
  'which frees it again');
select pg_temp.logout();
select is(
  (select count(*)::int from public.memberships where user_id = '22222222-2222-4222-8222-000000000004' and restaurant_id is null),
  1, 'and scope is all restaurants again');

-- Ari holds an override from above, which could not be removed once an admin.
select pg_temp.login('admin@example.com');
select public.set_person_access('22222222-2222-4222-8222-000000000002', 'admin', '{}');
select pg_temp.logout();
select is((select count(*)::int from public.rights where user_id = '22222222-2222-4222-8222-000000000002'), 0,
  'becoming an admin clears personal overrides');
update public.profiles set role = 'manager' where id = '22222222-2222-4222-8222-000000000002';

-- ---------------------------------------------------------------------------
-- A deactivated manager lets go of their restaurant
-- ---------------------------------------------------------------------------
update public.profiles set deactivated_at = now() where id = '22222222-2222-4222-8222-000000000001';
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000001'), null,
  'deactivating a manager frees their restaurant');

-- ---------------------------------------------------------------------------
-- View as, and history
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select lives_ok($$ select public.log_view_as('22222222-2222-4222-8222-000000000002') $$, 'an admin views as someone');
select throws_ok($$ select public.log_view_as('22222222-2222-4222-8222-000000000006') $$,
  '22023', null, 'but not as an admin');
select ok((select records from public.v_person_history where user_id = '22222222-2222-4222-8222-000000000003') > 0,
  'someone who has worked tickets has history');
select pg_temp.logout();

select * from finish();
rollback;

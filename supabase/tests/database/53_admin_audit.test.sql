-- Security pass over Admin on any role (OT-124). An admin changes role, restaurants and
-- status only through the checked, logged paths, never by writing the rows, and only an
-- admin changes the rights of someone who holds Admin.
begin;
select plan(14);

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
\set bert '''22222222-2222-4222-8222-000000000003'''
\set logan '''11111111-1111-4111-8111-000000000001'''

-- ---------------------------------------------------------------------------
-- No direct writes to role, restaurants or status, by an admin either
-- ---------------------------------------------------------------------------

select pg_temp.login('rosa.delgado@example.com');
select throws_ok(format($$ update public.profiles set role = 'leadership' where id = %L $$, :rosa),
  '42501', null, 'Rosa cannot change her own role by writing her row');
select throws_ok(format($$ update public.profiles set role = 'manager', home_restaurant_id = %L where id = %L $$, :logan, :bert),
  '42501', null, 'nor anyone else''s, which only set_person_access does, logged');
select throws_ok(format($$ update public.profiles set deactivated_at = now() where id = %L $$, :bert),
  '42501', null, 'nor deactivate anyone, which only revoke-user does, with the ban');
select throws_ok(format($$ insert into public.memberships (user_id, restaurant_id) values (%L, %L) $$, :bert, :logan),
  '42501', null, 'nor add restaurants to anyone');
select is_empty(format($$ delete from public.memberships where user_id = %L returning 1 $$, :rosa),
  'nor take her own away');
select lives_ok(format($$ update public.profiles set phone = '555-0100' where id = %L $$, :rosa),
  'her own name and phone are still hers to write');

-- The checked path still works, and is logged.
select lives_ok(format($$ select public.set_person_access(%L, 'ops', '{}', null) $$, :bert),
  'set_person_access still changes someone''s access');
select is(
  (select count(*)::int from public.audit_log where action = 'user.access' and target_user_id = (:bert)::uuid and actor_id = (:rosa)::uuid),
  1, 'and logs it');
select throws_ok(format($$ select public.set_person_access(%L, null, '{}', null) $$, :bert),
  '22004', null, 'with a role named');
select pg_temp.logout();

-- The service role, as revoke-user, still deactivates.
select lives_ok(format($$ update public.profiles set deactivated_at = now() where id = %L $$, :bert),
  'revoke-user, as the service role, still deactivates');
update public.profiles set deactivated_at = null where id = (:bert)::uuid;

-- ---------------------------------------------------------------------------
-- An admin's rights are for an admin to change
-- ---------------------------------------------------------------------------

insert into public.rights (user_id, key, allowed)
  values ((select id from public.profiles where email = 'maya.reyes@example.com'), 'manage_rights', true);

select pg_temp.login('maya.reyes@example.com');
select ok(public.can('manage_rights'), 'Maya holds Manage rights, without Admin');
select throws_ok(format($$ select public.set_person_rights(%L, '[{"key":"update_status","allowed":false}]') $$, :rosa),
  '42501', null, 'so she cannot change the rights of Rosa, who holds Admin');
select lives_ok(format($$ select public.set_person_rights(%L, '[{"key":"see_costs","allowed":false}]') $$, :bert),
  'while she still can for Bert, who does not');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.set_person_rights(%L, '[{"key":"update_status","allowed":false}]') $$, :rosa),
  'another admin can');
select pg_temp.logout();

select * from finish();
rollback;

-- Rules the invite-user function relies on: one live invite per address, and a
-- manager who accepts takes over their restaurants that have no manager.
begin;
select plan(6);

create function pg_temp.signup(p_id uuid, p_email text, p_app jsonb) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    'x', now(), p_app, '{}', now(), now(), '', '', '', '', false);
$$;

select throws_ok($$
  insert into public.invites (email, full_name, role, restaurant_ids, token_hash)
  values ('SAM.PATEL@example.com', 'Sam Again', 'manager', '{11111111-1111-4111-8111-000000000002}', 'second-sam')
$$, '23505', null, 'a second pending invite to an address is refused, whatever its case');

update public.invites set status = 'revoked', revoked_at = now() where email = 'jordan.blake@example.com';
select lives_ok($$
  insert into public.invites (email, full_name, role, restaurant_ids, token_hash)
  values ('jordan.blake@example.com', 'Jordan Blake', 'manager', '{11111111-1111-4111-8111-000000000003}', 'jordan-again')
$$, 'once the old one is revoked, a new one can be made');

-- Sam accepts: West Loop has no manager, so Sam becomes it.
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000002'), null,
  'West Loop starts with no manager');
select pg_temp.signup('deadbeef-0000-4000-8000-0000000000a1', 'sam.patel@example.com',
  '{"invite_id":"88888888-8888-4888-8888-000000000001"}');
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000002'),
  'deadbeef-0000-4000-8000-0000000000a1'::uuid, 'the manager who accepts takes over a restaurant with none');

-- A restaurant that already has a manager keeps them.
insert into public.invites (id, email, full_name, role, restaurant_ids, token_hash)
values ('88888888-8888-4888-8888-0000000000b1', 'second.manager@example.com', 'Second Manager', 'manager',
  '{11111111-1111-4111-8111-000000000001}', 'second-manager');
select pg_temp.signup('deadbeef-0000-4000-8000-0000000000a2', 'second.manager@example.com',
  '{"invite_id":"88888888-8888-4888-8888-0000000000b1"}');
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000001'),
  '22222222-2222-4222-8222-000000000001'::uuid, 'a restaurant with a manager keeps them');

-- An ops invite naming a restaurant does not make anyone its manager.
insert into public.invites (id, email, full_name, role, restaurant_ids, token_hash)
values ('88888888-8888-4888-8888-0000000000b2', 'scoped.ops@example.com', 'Scoped Ops', 'ops',
  '{11111111-1111-4111-8111-000000000003}', 'scoped-ops');
select pg_temp.signup('deadbeef-0000-4000-8000-0000000000a3', 'scoped.ops@example.com',
  '{"invite_id":"88888888-8888-4888-8888-0000000000b2"}');
select is((select manager_id from public.restaurants where id = '11111111-1111-4111-8111-000000000003'), null,
  'only a manager invite sets the manager');

select * from finish();
rollback;

-- Account creation is invite only, and deactivation closes every door.
-- Covers the two findings from the OT-2 security review and, from the OT-7
-- audit, that an invite is claimed by its id (service role) and never by
-- email alone, and that the service role can deactivate someone.
begin;
select plan(18);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- What an Edge Function's client looks like to the database.
create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Mimics what GoTrue inserts for a sign-up: user metadata is the client's,
-- app metadata is the server's (empty for a self sign-up).
create function pg_temp.signup(p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb default '{"provider":"email","providers":["email"]}')
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('ontrack-demo-2026', extensions.gen_salt('bf')), now(),
    p_app_meta, p_user_meta, now(), now(), '', '', '', '', false
  );
end $$;

-- ---------------------------------------------------------------------------
-- Self-signup with a privileged role in user metadata is refused outright.
-- ---------------------------------------------------------------------------
select throws_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000001', 'attacker@example.com', '{"role":"admin","full_name":"Mallory"}')
$$, '42501', null, 'a sign-up claiming admin in user metadata is rejected');
select is(
  (select count(*)::int from public.profiles where email = 'attacker@example.com'),
  0, 'and no profile exists for it');
select throws_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000002', 'nobody@example.com', '{}')
$$, '42501', null, 'a bare sign-up with no invite is rejected too');

-- ---------------------------------------------------------------------------
-- An invite is claimed by its id, which only the service role can put in
-- app_metadata. Sam Patel has a pending invite (8888…0001) as manager at
-- West Loop; knowing the email is not enough.
-- ---------------------------------------------------------------------------
select throws_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000005', 'sam.patel@example.com', '{"full_name":"Sam Patel"}')
$$, '42501', null, 'a sign-up with an invited email but no invite id is refused');
select is(
  (select status::text from public.invites where id = '88888888-8888-4888-8888-000000000001'),
  'pending', 'and the invite stays pending');
select throws_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000006', 'mallory@example.com', '{}',
    '{"provider":"email","providers":["email"],"invite_id":"88888888-8888-4888-8888-000000000001"}')
$$, '42501', null, 'an invite id with a different email is refused');

select lives_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000003', 'sam.patel@example.com', '{"role":"admin","full_name":"Sam Patel"}',
    '{"provider":"email","providers":["email"],"invite_id":"88888888-8888-4888-8888-000000000001"}')
$$, 'the accept step creates the user with the invite id');
select is(
  (select role::text from public.profiles where email = 'sam.patel@example.com'),
  'manager', 'the role comes from the invite, not the metadata');
select is(
  (select array_agg(restaurant_id order by restaurant_id) from public.memberships
     where user_id = 'deadbeef-0000-4000-8000-000000000003'),
  array['11111111-1111-4111-8111-000000000002']::uuid[], 'scope is the invited restaurant only');
select is(
  (select status::text from public.invites where email = 'sam.patel@example.com'),
  'accepted', 'and the invite is marked accepted');

-- Jordan Blake's invite (8888…0002) expired on Oct 10.
select throws_ok($$
  select pg_temp.signup('deadbeef-0000-4000-8000-000000000004', 'jordan.blake@example.com', '{}',
    '{"provider":"email","providers":["email"],"invite_id":"88888888-8888-4888-8888-000000000002"}')
$$, '42501', null, 'an expired invite does not admit anyone');

-- ---------------------------------------------------------------------------
-- Deactivation: an admin sets deactivated_at and every path closes, even
-- though the person still holds a valid session.
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select ok((select count(*) from public.tickets) > 0, 'before: Ari sees her tickets');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
select lives_ok($$
  update public.profiles set deactivated_at = now() where email = 'ari.kim@example.com'
$$, 'admin deactivates Ari');
select pg_temp.logout();

select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.tickets), 0, 'after: no tickets');
select is((select count(*)::int from public.restaurants), 0, 'after: no restaurants');
select throws_ok($$
  insert into public.ticket_updates (ticket_id, author_id, body)
  values ('66666666-6666-4666-8666-000000001033', '22222222-2222-4222-8222-000000000002', 'Test: still here?')
$$, '42501', null, 'after: cannot post to a thread she used to see');
select pg_temp.logout();

-- revoke-user runs with the service key: no signed-in user, so is_admin() is
-- false, and protect_profile_columns must let it through all the same.
select pg_temp.service();
select lives_ok($$
  update public.profiles set deactivated_at = now() where email = 'chris.novak@example.com'
$$, 'the service role can deactivate someone');
select pg_temp.logout();
select pg_temp.login('chris.novak@example.com');
select is((select count(*)::int from public.tickets), 0, 'and that person sees nothing either');
select pg_temp.logout();

select * from finish();
rollback;

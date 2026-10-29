-- OT-7 audit: invites are read-only for people and written by the service
-- role; the audit log is written only by those with something to log, as
-- themselves; a rights change names its author; a deactivated person cannot
-- write their own rows; profile columns have limits.
begin;
select plan(18);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
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

-- ---------------------------------------------------------------------------
-- Invites. Ari (manager) is granted invite_users as an override.
-- ---------------------------------------------------------------------------
insert into public.rights (user_id, key, allowed, updated_by)
values ('22222222-2222-4222-8222-000000000002', 'invite_users', true, '22222222-2222-4222-8222-000000000006');

select pg_temp.login('ari.kim@example.com');
select ok(public.can('invite_users'), 'Ari holds invite_users');
select is((select count(*)::int from public.invites), 2, 'and sees the invites');
select throws_ok($$
  insert into public.invites (email, full_name, role, token_hash)
  values ('ari.second@example.com', 'Ari Kim', 'admin', 'chosen-by-ari')
$$, '42501', null, 'but cannot write an invite herself, admin or otherwise');
update public.invites set role = 'admin' where email = 'sam.patel@example.com';
update public.invites set expires_at = now() + interval '1 year' where email = 'jordan.blake@example.com';
select pg_temp.logout();
select is(
  (select role::text from public.invites where email = 'sam.patel@example.com'),
  'manager', 'cannot re-point a pending invite at another role');
select ok(
  (select expires_at < now() from public.invites where email = 'jordan.blake@example.com'),
  'or extend an expired one');

select pg_temp.service();
select lives_ok($$
  insert into public.invites (email, full_name, role, token_hash, invited_by)
  values ('new.ops@example.com', 'New Ops', 'ops', 'hash-new-ops', '22222222-2222-4222-8222-000000000006')
$$, 'the service role (invite-user) writes invites');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$
  insert into public.audit_log (actor_id, action) values (auth.uid(), 'view_as')
$$, '42501', null, 'a manager with nothing to log cannot write the audit log');

select pg_temp.login('ari.kim@example.com');
select lives_ok($$
  insert into public.audit_log (actor_id, action) values (auth.uid(), 'invite_sent')
$$, 'a holder of invite_users logs their own action');
select throws_ok($$
  insert into public.audit_log (actor_id, action) values ('22222222-2222-4222-8222-000000000001', 'invite_sent')
$$, '42501', null, 'but not as someone else');

select pg_temp.login('admin@example.com');
select lives_ok($$
  insert into public.audit_log (actor_id, action, target_user_id)
  values (auth.uid(), 'view_as', '22222222-2222-4222-8222-000000000001')
$$, 'an admin logs View as');

-- ---------------------------------------------------------------------------
-- Rights changes name their author
-- ---------------------------------------------------------------------------
select lives_ok($$
  insert into public.rights (user_id, key, allowed, updated_by)
  values ('22222222-2222-4222-8222-000000000002', 'see_costs', true, auth.uid())
$$, 'an admin grants a right as themselves');
select throws_ok($$
  insert into public.rights (user_id, key, allowed, updated_by)
  values ('22222222-2222-4222-8222-000000000002', 'log_cost', true, '22222222-2222-4222-8222-000000000001')
$$, '42501', null, 'a rights change cannot be recorded under another name');

-- ---------------------------------------------------------------------------
-- Deactivated: no writes either
-- ---------------------------------------------------------------------------
select lives_ok($$
  update public.profiles set deactivated_at = now() where email = 'maya.reyes@example.com'
$$, 'admin deactivates Maya');

select pg_temp.login('maya.reyes@example.com');
update public.profiles set full_name = 'Still here' where id = auth.uid();
select throws_ok($$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), 'https://push.example/1', 'k', 'a')
$$, '42501', null, 'a deactivated person cannot register a device');
select pg_temp.logout();
select is(
  (select full_name from public.profiles where email = 'maya.reyes@example.com'),
  'Maya Reyes', 'or edit their own profile');

select pg_temp.service();
select lives_ok($$
  update public.profiles set deactivated_at = null where email = 'maya.reyes@example.com'
$$, 'the service role can reactivate');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Column limits
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$
  update public.profiles set full_name = '' where id = auth.uid()
$$, '23514', null, 'a name cannot be empty');
select throws_ok($$
  update public.profiles set phone = repeat('1', 41) where id = auth.uid()
$$, '23514', null, 'a phone number is at most 40 characters');
select pg_temp.logout();

select * from finish();
rollback;

-- The ticket thread: managers and ops post messages; internal notes are ops
-- only; system events cannot be forged; photos follow the update they sit on.
begin;
select plan(11);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

\set t1042 '''66666666-6666-4666-8666-000000001042'''

-- Maya on her own ticket
select pg_temp.login('maya.reyes@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1042::uuid and internal),
  0, 'manager does not see the internal note');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1042::uuid and kind = 'message'),
  3, 'manager sees the three visible messages');
select lives_ok($$
  insert into public.ticket_updates (ticket_id, author_id, body)
  values ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000001', 'Test: tech arrived')
$$, 'manager can post a message');
select throws_ok($$
  insert into public.ticket_updates (ticket_id, author_id, body, internal)
  values ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000001', 'Test: secret', true)
$$, '42501', null, 'manager cannot post an internal note');
select throws_ok($$
  insert into public.ticket_updates (ticket_id, author_id, kind, meta)
  values ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000001', 'closed', '{}')
$$, '42501', null, 'manager cannot forge a system event');
select is(
  (select count(*)::int from public.ticket_photos where ticket_id = :t1042::uuid),
  1, 'manager sees the photo on her message');
select pg_temp.logout();

-- Ari cannot see the thread at all
select pg_temp.login('ari.kim@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1042::uuid),
  0, 'another manager sees none of the thread');
select throws_ok($$
  insert into public.ticket_updates (ticket_id, author_id, body)
  values ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000002', 'Test: intruder')
$$, '42501', null, 'and cannot post to it');
select pg_temp.logout();

-- Bert sees everything and may post internally
select pg_temp.login('bert.velilla@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1042::uuid and internal),
  1, 'ops sees the internal note');
select lives_ok($$
  insert into public.ticket_updates (ticket_id, author_id, body, internal)
  values ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'Test: ops only', true)
$$, 'ops can post an internal note');
select pg_temp.logout();

-- Leadership reads the thread but not internal notes
select pg_temp.login('lee.chen@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1042::uuid and internal),
  0, 'leadership does not see internal notes');
select pg_temp.logout();

select * from finish();
rollback;

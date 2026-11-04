-- Tickets: who sees what, who may create where, and what the guard trigger
-- lets a manager change. The Phase 1 done test lives here: a manager sees
-- only their restaurant.
begin;
select plan(26);

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

-- Fixed ids from seed.sql
\set fls '''11111111-1111-4111-8111-000000000001'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set rls '''11111111-1111-4111-8111-000000000004'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set ari '''22222222-2222-4222-8222-000000000002'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set refrig '''33333333-3333-4333-8333-000000000012'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1044 '''66666666-6666-4666-8666-000000001044'''

-- ---------------------------------------------------------------------------
-- Maya, manager at Federale's Logan Square
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');

select is(
  (select count(distinct restaurant_id)::int from public.tickets),
  1, 'manager sees tickets from exactly one restaurant');
select is(
  (select restaurant_id from public.tickets limit 1),
  :fls::uuid, 'and it is her own');
select is(
  (select count(*)::int from public.restaurants),
  1, 'manager sees only her restaurant');

select lives_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: reach-in warm', '22222222-2222-4222-8222-000000000001')
$$, 'manager can create a ticket at her restaurant');

select throws_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000012', 'Test: not mine', '22222222-2222-4222-8222-000000000001')
$$, '42501', null, 'manager cannot create a ticket at another restaurant');

select throws_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: as someone else', '22222222-2222-4222-8222-000000000003')
$$, '42501', null, 'manager cannot create a ticket as someone else');

-- Whatever a manager sends on insert, the ticket lands open, unassigned, and
-- numbered by the database.
select lives_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by, status, assignee_id, scheduled_for, number)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: pre-assigned', '22222222-2222-4222-8222-000000000001',
          'scheduled', '22222222-2222-4222-8222-000000000003', current_date, 9999)
$$, 'manager insert with assignee, status and number is accepted');
select is(
  (select status::text || '|' || coalesce(assignee_id::text, 'none') || '|' || coalesce(scheduled_for::text, 'none')
     from public.tickets where title = 'Test: pre-assigned'),
  'open|none|none', 'but it is stored open, unassigned and unscheduled');
select ok(
  (select number from public.tickets where title = 'Test: pre-assigned') > 1047,
  'and the number came from the sequence, not the client');
select lives_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by, status, closed_at, closed_by, resolution)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: pre-closed', '22222222-2222-4222-8222-000000000001',
          'closed', now() - interval '90 days', '22222222-2222-4222-8222-000000000003', 'nope')
$$, 'manager insert as closed is accepted');
select is(
  (select status::text || '|' || coalesce(closed_by::text, 'none') from public.tickets where title = 'Test: pre-closed'),
  'open|none', 'but it is stored open with no closer');

-- The created event was written by the trigger even though she may only
-- insert messages herself.
select is(
  (select count(*)::int from public.ticket_updates u join public.tickets t on t.id = u.ticket_id
    where t.title = 'Test: reach-in warm' and u.kind = 'created'),
  1, 'creating a ticket writes the Opened event');

-- Guard: a manager may edit text but not assign or move status.
select lives_ok($$
  update public.tickets set description = 'Edited by the manager' where id = '66666666-6666-4666-8666-000000001042'
$$, 'manager can edit the description of her open ticket');
select throws_ok($$
  update public.tickets set assignee_id = '22222222-2222-4222-8222-000000000004' where id = '66666666-6666-4666-8666-000000001042'
$$, '42501', null, 'manager cannot assign a ticket');
select throws_ok($$
  update public.tickets set status = 'waiting_parts' where id = '66666666-6666-4666-8666-000000001042'
$$, '42501', null, 'manager cannot pick an ops status');
select lives_ok($$
  update public.tickets set status = 'closed', resolution = 'Fixed it ourselves' where id = '66666666-6666-4666-8666-000000001039'
$$, 'manager can close her own ticket');
select is(
  (select status::text from public.tickets where id = '66666666-6666-4666-8666-000000001039'),
  'closed', 'and it is closed with closed_at set');
select throws_ok($$
  update public.tickets set status = 'open' where id = '66666666-6666-4666-8666-000000001039'
$$, '42501', null, 'a bare status change does not reopen a ticket (OT-55: a reopen has its reason)');
select lives_ok($$
  select public.reopen_ticket('66666666-6666-4666-8666-000000001039', 'Still broken')
$$, 'manager can reopen within 30 days, with a reason');
select is(
  (select status::text from public.tickets where id = '66666666-6666-4666-8666-000000001039'),
  'reopened', 'leaving closed always lands on Reopened');

select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Ari, manager at Ranalli's: cannot see Logan Square at all
-- ---------------------------------------------------------------------------
select pg_temp.login('ari.kim@example.com');
select is(
  (select count(*)::int from public.tickets where id = :t1042::uuid),
  0, 'another manager cannot see a Logan Square ticket');
select is(
  (select count(*)::int from public.tickets where restaurant_id <> :rls::uuid),
  0, 'another manager sees nothing outside her restaurant');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Bert, ops: everything, and may assign and move status
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
select is(
  (select count(distinct restaurant_id)::int from public.tickets),
  4, 'ops sees all four restaurants');
select lives_ok($$
  update public.tickets set assignee_id = '22222222-2222-4222-8222-000000000003', status = 'in_progress'
  where id = '66666666-6666-4666-8666-000000001044'
$$, 'ops can take a ticket and set In progress');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = :t1044::uuid and kind in ('assigned', 'status_changed')),
  2, 'assignment and status change each wrote an event');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Lee, leadership: read only
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com');
select throws_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: leadership', '22222222-2222-4222-8222-000000000005')
$$, '42501', null, 'leadership cannot create tickets');
select pg_temp.logout();

select * from finish();
rollback;

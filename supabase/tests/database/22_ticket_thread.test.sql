-- The ticket thread (OT-27): a message moves the ticket, an internal note and a
-- closed ticket do not, and a message has a length limit.
begin;
select plan(7);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.age_tickets() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  alter table public.tickets disable trigger tickets_updated_at;
  alter table public.tickets disable trigger tickets_guard;
  update public.tickets set updated_at = '2026-01-01' where id in (
    '66666666-6666-4666-8666-000000001042', '66666666-6666-4666-8666-000000001028');
  alter table public.tickets enable trigger tickets_updated_at;
  alter table public.tickets enable trigger tickets_guard;
end $$;

-- Seed ids (supabase/seed.sql): 1042 is open and 1028 closed, both at Maya's restaurant.
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1028 '''66666666-6666-4666-8666-000000001028'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''

select pg_temp.age_tickets();

-- An internal note from Ops leaves it alone.
select pg_temp.login('bert.velilla@example.com');
insert into public.ticket_updates (ticket_id, author_id, body, internal) values ((:t1042)::uuid, (:bert)::uuid, 'Quote is high', true);
select is((select updated_at from public.tickets where id = (:t1042)::uuid), '2026-01-01'::timestamptz, 'an internal note does not move the ticket');

-- A message from the manager moves it, though a manager cannot write the column.
select pg_temp.login('maya.reyes@example.com');
insert into public.ticket_updates (ticket_id, author_id, body) values ((:t1042)::uuid, (:maya)::uuid, 'Holding at 36');
select isnt((select updated_at from public.tickets where id = (:t1042)::uuid), '2026-01-01'::timestamptz, 'a message moves the ticket');
select is((select title from public.tickets where id = (:t1042)::uuid), 'Walk-in cooler not holding temp', 'and changes nothing else');

select throws_ok($$
  update public.tickets set updated_at = '2020-01-01', assignee_id = '22222222-2222-4222-8222-000000000001'
  where id = '66666666-6666-4666-8666-000000001042'
$$, '42501', null, 'the touch gives a manager no new way to change the ticket');

-- Closed: the trigger stays out of tickets_guard's way.
select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$
  insert into public.ticket_updates (ticket_id, author_id, body) values ('%s', '%s', 'One more thing')
$$, :t1028, :bert), 'a message from Ops on a closed ticket does not trip the read-only guard');
select is((select updated_at from public.tickets where id = (:t1028)::uuid), '2026-01-01'::timestamptz, 'and does not move it');

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$
  insert into public.ticket_updates (ticket_id, author_id, body) values ('%s', '%s', repeat('x', 4001))
$$, :t1042, :maya), '23514', null, 'a message over 4000 characters is refused');

select * from finish();
rollback;

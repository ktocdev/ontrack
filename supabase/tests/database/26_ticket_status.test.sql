-- Ticket status (OT-39): who is on a ticket follows from its status, and only people
-- with update_status change it.
begin;
select plan(19);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): 1047 is open at Porter with nobody on it, and 1028 is closed.
\set t1047 '''66666666-6666-4666-8666-000000001047'''
\set t1028 '''66666666-6666-4666-8666-000000001028'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set chris '''22222222-2222-4222-8222-000000000004'''

select pg_temp.login('bert.velilla@example.com');

select lives_ok(format($$ select public.set_ticket_status('%s', 'in_progress') $$, :t1047), 'In progress works');
select ok((select status = 'in_progress' and assignee_id = (:bert)::uuid from public.tickets where id = (:t1047)::uuid),
  'and puts you on the ticket');
select is(
  (select array_agg(kind::text order by kind::text) from public.ticket_updates where ticket_id = (:t1047)::uuid and author_id = (:bert)::uuid),
  array['assigned', 'status_changed'], 'and the thread records both');

select lives_ok(format($$ select public.set_ticket_status('%s', 'waiting_parts') $$, :t1047), 'Waiting on parts works');
select is((select assignee_id from public.tickets where id = (:t1047)::uuid), (:bert)::uuid, 'and keeps who is on it');

-- Marking it In progress takes it from whoever had it.
select pg_temp.login('chris.novak@example.com');
select lives_ok(format($$ select public.set_ticket_status('%s', 'in_progress') $$, :t1047), 'someone else marks it In progress');
select is((select assignee_id from public.tickets where id = (:t1047)::uuid), (:chris)::uuid, 'and it is theirs');

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.take_ticket('%s') $$, :t1047), 'taking it over works');
select is((select assignee_id from public.tickets where id = (:t1047)::uuid), (:bert)::uuid, 'and it moves');

-- A date goes with Scheduled, and only with Scheduled.
select throws_ok(format($$ select public.set_ticket_status('%s', 'scheduled') $$, :t1047), '22023', null,
  'Scheduled needs a date');
select throws_ok(format($$ select public.set_ticket_status('%s', 'open', '2026-12-01') $$, :t1047), '22023', null,
  'and nothing else takes one');
select lives_ok(format($$ select public.set_ticket_status('%s', 'scheduled', '2026-12-01') $$, :t1047), 'Scheduled with a date works');
select is((select scheduled_for from public.tickets where id = (:t1047)::uuid), '2026-12-01'::date, 'and keeps it');

-- Back to Open takes the person and the date off.
select lives_ok(format($$ select public.set_ticket_status('%s', 'open') $$, :t1047), 'back to Open works');
select ok((select assignee_id is null and scheduled_for is null from public.tickets where id = (:t1047)::uuid),
  'and clears who and when');

-- Closing and reopening have their own steps.
select throws_ok(format($$ select public.set_ticket_status('%s', 'closed') $$, :t1047), '22023', null,
  'closing is not a status here');
select throws_ok(format($$ select public.set_ticket_status('%s', 'in_progress') $$, :t1028), 'P0002', null,
  'a closed ticket does not change here');

-- People without update_status.
select pg_temp.login('dana.ortiz@example.com');
select throws_ok(format($$ select public.set_ticket_status('%s', 'in_progress') $$, :t1047), 'P0002', null,
  'a manager cannot, even at their own restaurant');
select throws_ok(format($$ select public.take_ticket('%s') $$, :t1047), 'P0002', null,
  'or take a ticket');

select * from finish();
rollback;

-- Start work (OT-42): from reopened or closed to In progress with a note, in one step, for
-- people with update_status only.
begin;
select plan(12);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): 0988 is reopened at Logan Square, 1028 closed there, and
-- 1022 closed at Porter, where Dana is the manager.
\set t0988 '''66666666-6666-4666-8666-000000000988'''
\set t1028 '''66666666-6666-4666-8666-000000001028'''
\set t1022 '''66666666-6666-4666-8666-000000001022'''
\set chris '''22222222-2222-4222-8222-000000000004'''

-- Bert has it, and Chris starts the work.
select pg_temp.login('chris.novak@example.com');

select throws_ok(format($$ select public.start_ticket_work('%s', '   ') $$, :t0988), '22023', null, 'a note is required');
select is((select status::text from public.tickets where id = (:t0988)::uuid), 'reopened', 'and nothing changed');

select lives_ok(format($$ select public.start_ticket_work('%s', 'Checking the fit with Coldline.') $$, :t0988),
  'Start work on a reopened ticket');
select ok((select status = 'in_progress' and assignee_id = (:chris)::uuid from public.tickets where id = (:t0988)::uuid),
  'moves it to In progress and puts you on it');
select is(
  (select internal from public.ticket_updates where ticket_id = (:t0988)::uuid and body = 'Checking the fit with Coldline.'),
  false, 'and the restaurant can read the note');

select lives_ok(format($$ select public.start_ticket_work('%s', 'It came back after all.') $$, :t1028),
  'Start work anyway on a closed ticket');
select ok(
  (select status = 'in_progress' and closed_at is null and reopen_count = 1 from public.tickets where id = (:t1028)::uuid),
  'counts as a reopen and ends In progress');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = (:t1028)::uuid and kind = 'reopened'),
  1, 'and the thread records the reopen');

select throws_ok($$ select public.start_ticket_work('00000000-0000-4000-8000-000000000000', 'Nothing') $$, 'P0002', null,
  'no ticket, no work');

-- A manager can reopen but not start work, and the failure leaves the ticket closed.
select pg_temp.login('dana.ortiz@example.com');
select throws_ok(format($$ select public.start_ticket_work('%s', 'I will do it') $$, :t1022), null, null,
  'a manager cannot start work');
select is((select status::text from public.tickets where id = (:t1022)::uuid), 'closed', 'and it stays closed');

select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.start_ticket_work('%s', 'Mine now') $$, :t1022), null, null,
  'nor can leadership');

select * from finish();
rollback;

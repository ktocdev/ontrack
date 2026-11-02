-- Reopening (OT-52): a reopened ticket acts like a new one apart from its badge, with
-- nobody on it and no date, and Ops picks it up the ordinary way.
begin;
select plan(7);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): 1031 is scheduled at Logan Square with Bert on it, and Maya
-- manages there. 1037 is Bert's there too.
\set t1031 '''66666666-6666-4666-8666-000000001031'''
\set t1037 '''66666666-6666-4666-8666-000000001037'''
\set bert '''22222222-2222-4222-8222-000000000003'''

select pg_temp.login('maya.reyes@example.com');
update public.tickets set status = 'closed' where id = (:t1031)::uuid;

select lives_ok(format($$ select public.reopen_ticket('%s', 'It is back') $$, :t1031), 'a manager reopens');
select ok(
  (select status = 'reopened' and assignee_id is null and scheduled_for is null from public.tickets where id = (:t1031)::uuid),
  'and it is Reopened with nobody on it and no date');

select throws_ok(format($$ update public.tickets set assignee_id = auth.uid() where id = %L $$, :t1037), '42501', null,
  'a manager still cannot put anyone on a ticket');
select throws_ok(format($$ update public.tickets set scheduled_for = '2030-01-01' where id = %L $$, :t1037), '42501', null,
  'or set its date');

select pg_temp.login('bert.velilla@example.com');
select is(
  (select count(*)::int from public.tickets where id = (:t1031)::uuid and status <> 'closed'), 1,
  'Ops sees it as open work');
select lives_ok(format($$ select public.set_ticket_status('%s', 'in_progress') $$, :t1031), 'and marks it In progress');
select is((select assignee_id from public.tickets where id = (:t1031)::uuid), (:bert)::uuid, 'which puts them on it');

select * from finish();
rollback;

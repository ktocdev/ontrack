-- A bad setup says why (OT-58), without stopping the ticket that found it, and tickets are
-- published so lists can change as they do.
begin;
select plan(9);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

\set fls '''11111111-1111-4111-8111-000000000001'''
\set cat '''33333333-3333-4333-8333-000000000012'''

select is((select count(*)::int from public.notify_problems), 0, 'a good setup has no problems');

-- The mistake from trying it live: a URL pg_net won't take.
select vault.update_secret((select id from vault.secrets where name = 'send_push_url'), 'https://<project-ref>.supabase.co/x');
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Bad URL', auth.uid())
$$, 'a bad URL does not stop the ticket');
select is((select count(*)::int from public.tickets where title = 'Bad URL'), 1, 'which is saved');
set local role postgres;
select ok((select count(*) from public.notify_problems where message like 'send-push was not called: %') = 1,
  'and the problem says the call failed');

-- The same problem again is the same row, counted.
select public.notify_send_push();
select is((select max(times) from public.notify_problems), 2, 'the same problem is counted, not repeated');

-- A missing secret says so too.
delete from vault.secrets where name = 'send_push_secret';
select public.notify_send_push();
select ok((select count(*) from public.notify_problems where message like '%not in the vault%') = 1,
  'a missing secret is recorded');

-- Who can read them.
select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from public.notify_problems), 0, 'Ops cannot read them');
select pg_temp.login('admin@example.com');
select ok((select count(*) from public.notify_problems) > 0, 'an admin can');

set local role postgres;
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'),
  'tickets are published for Realtime');

select * from finish();
rollback;

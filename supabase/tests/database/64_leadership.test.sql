-- Leadership (OT-142): the Overview's view adds up to the records it is built on, and
-- leadership sees the same figures Ops does; a Reporter sees only their restaurant, and
-- spend only with See costs. Leadership reads everything its screens need (tickets and
-- threads without internal notes, equipment, service records, invoices, contractors,
-- walkthroughs) and writes nothing anywhere.
begin;
select plan(33);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

\set logan '''11111111-1111-4111-8111-000000000001'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set unit '''44444444-4444-4444-8444-000000000001'''

-- What the records say, read with no policy in the way.
select pg_temp.su();
select coalesce(sum(t.total_cents), 0)::bigint as oct_spend
from public.service_records s join public.v_service_record_totals t on t.service_record_id = s.id
where s.service_date >= '2026-10-01' and s.service_date < '2026-11-01' \gset
select count(*)::int as oct_closed,
       coalesce(sum(extract(epoch from closed_at - created_at)), 0)::bigint as oct_close_seconds
from public.tickets
where status = 'closed' and closed_at is not null
  and date_trunc('month', closed_at at time zone 'America/Chicago')::date = '2026-10-01' \gset
select count(*)::int as oct_opened from public.tickets
where date_trunc('month', created_at at time zone 'America/Chicago')::date = '2026-10-01' \gset

-- ---------------------------------------------------------------------------
-- 1. The Overview adds up, and leadership sees what Ops sees
-- ---------------------------------------------------------------------------

select pg_temp.login('lee.chen@example.com');
select ok(:oct_spend > 0, 'the seed has spend in October');
select is((select sum(spend_cents)::bigint from public.v_overview_by_month where month = '2026-10-01'), :oct_spend::bigint,
  'October''s spend is every visit dated in October');
select is((select sum(closed)::int from public.v_overview_by_month where month = '2026-10-01'), :oct_closed,
  'its closed tickets are those closed in October, in the group''s time zone');
select is((select sum(close_seconds)::bigint from public.v_overview_by_month where month = '2026-10-01'), :oct_close_seconds::bigint,
  'with the time from opening to closing summed, for the average');
select is((select sum(opened)::int from public.v_overview_by_month where month = '2026-10-01'), :oct_opened,
  'and its opened tickets those opened in October');
select ok((select bool_and(sees_costs) from public.v_overview_by_month), 'leadership sees costs everywhere');
select string_agg(format('%s %s %s %s %s', restaurant_id, month, opened, closed, spend_cents), ',' order by restaurant_id, month)
  as lee_rows from public.v_overview_by_month \gset
select string_agg(format('%s %s', restaurant_id, open_count), ',' order by restaurant_id) as lee_open
  from public.v_restaurant_open_counts \gset

select pg_temp.login('bert.velilla@example.com');
select is((select string_agg(format('%s %s %s %s %s', restaurant_id, month, opened, closed, spend_cents), ',' order by restaurant_id, month)
           from public.v_overview_by_month), :'lee_rows', 'Ops sees the same figures, restaurant by restaurant and month by month');
select is((select string_agg(format('%s %s', restaurant_id, open_count), ',' order by restaurant_id)
           from public.v_restaurant_open_counts), :'lee_open', 'and the same open tickets');

-- A Reporter sees their own restaurant only; without See costs, no spend, and says so.
select pg_temp.login('maya.reyes@example.com');
select is((select array_agg(distinct restaurant_id) from public.v_overview_by_month), array[:logan::uuid],
  'a Reporter sees only their restaurant');
select pg_temp.login('dana.ortiz@example.com');
select is((select sum(spend_cents)::bigint from public.v_overview_by_month), 0::bigint, 'without See costs, no spend');
select ok(not (select bool_or(sees_costs) from public.v_overview_by_month where restaurant_id = :porter),
  'and the row says the spend is not theirs to see');

select pg_temp.su();
set local role anon;
select throws_ok('select * from public.v_overview_by_month', '42501', null, 'signed-out visitors read nothing');

-- ---------------------------------------------------------------------------
-- 2. Leadership reads what its screens need
-- ---------------------------------------------------------------------------

select pg_temp.login('lee.chen@example.com');
select is((select count(distinct restaurant_id)::int from public.tickets), 4, 'leadership reads every restaurant''s tickets');
select ok((select count(*) from public.ticket_updates where not internal) > 0, 'and their threads');
select is((select count(*)::int from public.ticket_updates where internal), 0, 'but no internal note');
select is((select count(distinct restaurant_id)::int from public.equipment), 4, 'every restaurant''s equipment');
select ok((select count(*) from public.service_records) > 0, 'the service records');
select ok((select count(*) from public.invoices) > 0, 'their invoices');
select ok((select count(*) from public.contractors) > 0, 'the contractors');
select is((select count(distinct restaurant_id)::int from public.v_walkthrough_summary), 4, 'and every restaurant''s walkthroughs');
select pg_temp.su();
insert into storage.objects (bucket_id, name) values ('invoices', '77777777-7777-4777-8777-000000000001/a1/Coldline_INV-58213.pdf');
select pg_temp.login('lee.chen@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'invoices'), 1, 'and the invoice files');
select pg_temp.login('dana.ortiz@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'invoices'), 0, 'which need See costs, as for anyone');
select pg_temp.login('lee.chen@example.com');

-- ---------------------------------------------------------------------------
-- 3. Leadership files and posts on tickets (OT-169), and writes nothing else
-- ---------------------------------------------------------------------------

select lives_ok(format('insert into public.tickets (restaurant_id, category_id, title, created_by)
  values (%L, %L, ''From leadership'', auth.uid())', :logan, '33333333-3333-4333-8333-000000000012'),
  'leadership files a ticket');
select lives_ok(format('insert into public.ticket_updates (ticket_id, author_id, kind, body) values (%L, auth.uid(), ''message'', ''Hi'')', :t1042),
  'writes in a thread directly');
select lives_ok(format('select public.post_ticket_update(%L, ''Hi'')', :t1042), 'and through post_ticket_update');
select throws_ok(format('select public.set_ticket_status(%L, ''in_progress'')', :t1042), 'P0002', null, 'changes no status');
select throws_ok(format('select public.take_ticket(%L)', :t1042), 'P0002', null, 'takes no ticket');
select throws_ok(format('select public.log_service(''in_house'', current_date, %L)', :t1042), '42501', null, 'logs no service');
select throws_ok('select public.save_contractor(null, ''Leadership Co'', array[]::uuid[], ''Lee'', ''555'', null, false, null, null)',
  '42501', null, 'saves no contractor');
select throws_ok(format('select public.set_walkthrough_good(%L, %L)', :oct, :outlets), '42501', null, 'ticks no walkthrough item');
select throws_ok(format('select public.add_inhouse_task(%L, ''From leadership'')', :logan), '42501', null, 'adds no in-house task');
select throws_ok(format('select public.send_walkthrough_reminder(%L)', :oct), 'P0002', null, 'sends no reminder');
update public.equipment set name = 'Renamed by leadership' where id = :unit;
select pg_temp.su();
select isnt((select name from public.equipment where id = :unit), 'Renamed by leadership', 'and changes no equipment');

select * from finish();
rollback;

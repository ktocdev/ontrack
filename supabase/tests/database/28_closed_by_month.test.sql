-- The Closed tickets screen's months (OT-41): counted in the viewer's time zone, and
-- limited by RLS to the tickets and costs that person can read.
begin;
select plan(9);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): Federale's Logan Square, West Loop, Porter, Ranalli's.
\set fls '''11111111-1111-4111-8111-000000000001'''
\set fwl '''11111111-1111-4111-8111-000000000002'''
\set por '''11111111-1111-4111-8111-000000000003'''
\set rls '''11111111-1111-4111-8111-000000000004'''

select pg_temp.login('bert.velilla@example.com');

select results_eq(
  format($$ select closed_count, total_cents from public.closed_by_month(array[%L, %L, %L, %L]::uuid[], 'America/Chicago')
            where month = '2026-10-01' $$, :fls, :fwl, :por, :rls),
  $$ values (9, 241860::bigint) $$,
  'October: 9 closed for $2,418.60, without the reopened ticket, which is open work');

select is(
  (select closed_count from public.closed_by_month(array[(:por)::uuid], 'America/Chicago') where month = '2026-10-01'),
  3, 'only the restaurants asked for');

select ok(
  (select bool_and(month > lead_month) from (
    select month, lead(month) over () as lead_month
    from public.closed_by_month(array[(:fls)::uuid], 'America/Chicago')
  ) m where lead_month is not null),
  'newest month first');

-- A ticket closed at 8 PM Chicago on Oct 31 is already November in UTC.
reset role;
update public.tickets set last_closed_at = '2026-10-31 20:00-05', closed_at = '2026-10-31 20:00-05'
where id = '66666666-6666-4666-8666-000000001022';
select pg_temp.login('bert.velilla@example.com');

select is(
  (select closed_count from public.closed_by_month(array[(:por)::uuid], 'America/Chicago') where month = '2026-10-01'),
  3, 'the evening of Oct 31 is still October in Chicago');
select is(
  (select closed_count from public.closed_by_month(array[(:por)::uuid], 'UTC') where month = '2026-11-01'),
  1, 'and November in UTC');

-- Ari manages Ranalli's, with no see_costs.
select pg_temp.login('ari.kim@example.com');
select is(
  (select closed_count from public.closed_by_month(array[(:rls)::uuid], 'America/Chicago') where month = '2026-10-01'),
  2, 'a manager counts their own restaurant');
select is(
  (select total_cents from public.closed_by_month(array[(:rls)::uuid], 'America/Chicago') where month = '2026-10-01'),
  null, 'with no total, without see_costs');
select is(
  (select count(*)::int from public.closed_by_month(array[(:por)::uuid], 'America/Chicago')),
  0, 'and nothing from a restaurant out of scope');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.closed_by_month('{}'::uuid[], 'UTC') $$, '42501', null,
  'signed-out visitors cannot call it');

select * from finish();
rollback;

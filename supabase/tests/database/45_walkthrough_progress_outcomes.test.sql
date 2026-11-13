-- OT-104: the progress view counts each done item once by how it ended, for the home's
-- bar: a ticket, else an in-house fix, else Good.
begin;
select plan(4);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set appliances '''dddddddd-dddd-4ddd-8ddd-000000000101'''
\set bulbs '''dddddddd-dddd-4ddd-8ddd-000000000102'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set paint '''dddddddd-dddd-4ddd-8ddd-000000000114'''
\set utility '''99999999-9999-4999-8999-000000000001'''

-- In Back of House: two Good, one with a fix, one with a fix and a ticket.
select pg_temp.login('maya.reyes@example.com');
select public.set_walkthrough_good(:oct, :appliances);
select public.set_walkthrough_good(:oct, :bulbs);
select public.add_walkthrough_fix(:oct, 'Touch up the wall', :paint);
select public.add_walkthrough_fix(:oct, 'Replace the cover plate', :outlets);
select public.create_walkthrough_ticket(:oct, 'Outlet sparks', :outlets);

select results_eq(
  format($$select done, good_items, inhouse_items, ticket_items from public.v_walkthrough_progress
           where walkthrough_id = %L and short_name = 'BOH'$$, :oct),
  $$values (4, 2, 1, 1)$$,
  'each done item counts once: a ticket first, then a fix, then Good');
select results_eq(
  format($$select done, good_items, inhouse_items, ticket_items from public.v_walkthrough_progress
           where walkthrough_id = %L and short_name = 'FOH'$$, :oct),
  $$values (0, 0, 0, 0)$$,
  'a section with nothing done counts nothing');

-- A quarterly task counts the same way.
select public.add_walkthrough_fix(:oct, 'Label the shelves', p_task_id => :utility);
select results_eq(
  format($$select done, good_items, inhouse_items, ticket_items from public.v_walkthrough_progress
           where walkthrough_id = %L and kind = 'quarterly'$$, :oct),
  $$values (1, 0, 1, 0)$$,
  'a quarterly task with a fix counts as in-house');

-- The parts always add up to what is done.
select is(
  (select count(*)::int from public.v_walkthrough_progress where done <> good_items + inhouse_items + ticket_items),
  0, 'Good, in-house and tickets add up to done everywhere');

select * from finish();
rollback;

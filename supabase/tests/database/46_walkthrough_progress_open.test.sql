-- From trying 6a: the progress view counts the fixes and tickets still open, beside the
-- totals, so the home's flags show what is still to do.
begin;
select plan(4);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.counts(p_walkthrough uuid) returns table (tickets int, fixes int, open_tickets int, open_fixes int)
language sql as $$
  select tickets, fixes, open_tickets, open_fixes from public.v_walkthrough_progress
  where walkthrough_id = p_walkthrough and short_name = 'BOH'
$$;

\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set appliances '''dddddddd-dddd-4ddd-8ddd-000000000101'''

select pg_temp.login('maya.reyes@example.com');
select public.add_walkthrough_fix(:oct, 'Replace the cover plate', :outlets) as fix \gset
select public.add_walkthrough_fix(:oct, 'Tape the cord', :appliances);
select public.create_walkthrough_ticket(:oct, 'Outlet sparks', :outlets) as ticket \gset

select results_eq(format('select * from pg_temp.counts(%L)', :oct), $$values (1, 2, 1, 2)$$,
  'everything just made is open');

select public.set_inhouse_fix_done(:'fix', true);
select results_eq(format('select * from pg_temp.counts(%L)', :oct), $$values (1, 2, 1, 1)$$,
  'a fix checked off stays in the total and leaves the open count');

update public.tickets set status = 'closed' where id = :'ticket';
select results_eq(format('select * from pg_temp.counts(%L)', :oct), $$values (1, 2, 0, 1)$$,
  'a closed ticket leaves the open count too');

select is(
  (select count(*)::int from public.v_walkthrough_progress where open_fixes > fixes or open_tickets > tickets),
  0, 'open never counts more than the total');

select * from finish();
rollback;

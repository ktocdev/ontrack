-- Restore after Remove (OT-135's fix to OT-134): a restaurant follows the group's task again
-- unless it had changed it, in which case its own wording comes back.
begin;
select plan(5);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- The title a restaurant gets for a group task, as the database works it out.
create function pg_temp.title_at(p_restaurant uuid, p_root uuid) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select title into v from public.quarter_tasks_for(p_restaurant, '2026-12-01') where root_id = p_root;
  return v;
end $$;

\set porter '''11111111-1111-4111-8111-000000000003'''
\set ranallis '''11111111-1111-4111-8111-000000000004'''
\set utility '''99999999-9999-4999-8999-000000000001'''

select pg_temp.login('bert.velilla@example.com');
select public.set_quarterly_task_removed(:utility, :porter, true);
select public.set_quarterly_task_removed(:utility, :porter, false);
select public.save_quarterly_task(:utility, null, 'Organize utility rooms', null, null);
select is(pg_temp.title_at(:porter, :utility), 'Organize utility rooms',
  'removed and restored, a restaurant follows the group''s task again');
select is((select count(*)::int from public.quarterly_tasks
           where restaurant_id = :porter and overrides_task_id = :utility and active), 0,
  'and has no version in use');

select pg_temp.login('bert.velilla@example.com');
select public.save_quarterly_task(:utility, :ranallis, 'Organize utility rooms and the dock', null, null);
select public.set_quarterly_task_removed(:utility, :ranallis, true);
select is(pg_temp.title_at(:ranallis, :utility), null, 'a changed task can be removed');
select pg_temp.login('bert.velilla@example.com');
select public.set_quarterly_task_removed(:utility, :ranallis, false);
select is(pg_temp.title_at(:ranallis, :utility), 'Organize utility rooms and the dock',
  'and restored, its own wording comes back');

select pg_temp.login('bert.velilla@example.com');
select public.reset_quarterly_task(:utility, :ranallis);
select public.set_quarterly_task_removed(:utility, :ranallis, true);
select public.set_quarterly_task_removed(:utility, :ranallis, false);
select is(pg_temp.title_at(:ranallis, :utility), 'Organize utility rooms',
  'after going back to the group''s version, a restore follows the group''s');

select * from finish();
rollback;

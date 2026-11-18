-- Quarterly tasks for Ops (OT-134): the group's list and a restaurant's changes, removals,
-- additions and restores, each checked and logged; an open walkthrough keeps its tasks.
begin;
select plan(30);

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

-- A walkthrough opened now for a restaurant in December (Q4), and its tasks' titles.
create function pg_temp.open_dec(p_restaurant uuid) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.su();
  delete from public.walkthroughs where restaurant_id = p_restaurant and period = '2026-12-01';
  insert into public.walkthroughs (restaurant_id, template_id, period, due_on)
  values (p_restaurant, '88888888-8888-4888-8888-000000000001', '2026-12-01', '2026-12-31')
  returning id into v;
  return v;
end $$;
create function pg_temp.done_of(p_walkthrough uuid, p_title text) returns boolean language sql as $$
  select done from public.walkthrough_quarter_tasks(p_walkthrough) where title = p_title;
$$;
create function pg_temp.titles(p_walkthrough uuid) returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.walkthrough_quarter_tasks(p_walkthrough);
$$;

\set logan '''11111111-1111-4111-8111-000000000001'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set ranallis '''11111111-1111-4111-8111-000000000004'''
\set logan_oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set utility '''99999999-9999-4999-8999-000000000001'''
\set floors '''99999999-9999-4999-8999-000000000002'''

-- The seed's walkthroughs each have their copy of Q4's two tasks.
select is(pg_temp.titles(:logan_oct), array['Degrease BOH floors', 'Organize utility areas'],
  'a walkthrough has its quarter''s tasks from its copy');

-- Nobody writes the tasks or a walkthrough's copy through the API.
select pg_temp.login('bert.velilla@example.com');
update public.quarterly_tasks set title = 'x';
select pg_temp.su();
select is((select title from public.quarterly_tasks where id = :utility), 'Organize utility areas',
  'tasks are not updated directly');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(
  $$insert into public.walkthrough_tasks (walkthrough_id, task_id, root_id, title)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000001', 'x')$$,
  '42501', null, 'a walkthrough''s copy is not written directly');

-- Only someone with set_walkthrough_schedule changes them.
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$select public.save_quarterly_task(null, null, 'Check gutters', null, null, '{4}')$$,
  '42501', null, 'a Reporter can''t add a group task');
select pg_temp.login('lee.chen@example.com');
select throws_ok($$select public.save_quarterly_task(null, null, 'Check gutters', null, null, '{4}')$$,
  '42501', null, 'nor can leadership');

-- Bert adds a group task for Q4; the open October walkthroughs keep theirs.
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.save_quarterly_task(null, null, 'Check gutters', 'Look up.', 'https://example.com/gutters', '{4}')$$,
  'Ops adds a group task for Q4');
select pg_temp.su();
select is((select count(*)::int from public.audit_log where action = 'quarterly_task.add'), 1, 'and it is logged');
select is(cardinality(pg_temp.titles(:logan_oct)), 2, 'an open walkthrough keeps the tasks it opened with');
select is(pg_temp.titles(pg_temp.open_dec(:logan)), array['Check gutters', 'Degrease BOH floors', 'Organize utility areas'],
  'the next walkthrough gets the new task');

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$select public.save_quarterly_task(null, null, 'No quarter', null, null, '{5}')$$,
  '22023', null, 'a quarter is 1 to 4');
select throws_ok($$select public.save_quarterly_task(null, null, 'Bad link', null, 'javascript:alert(1)', '{1}')$$,
  '23514', null, 'a video link is a web address');
select throws_ok($$select public.save_quarterly_task(null, null, '  ', null, null, '{1}')$$,
  '23514', null, 'a task has a name');

-- Changing the group's task: open walkthroughs keep the old wording.
select lives_ok($$select public.save_quarterly_task('99999999-9999-4999-8999-000000000002', null, 'Degrease kitchen floors', 'Scrub.', null)$$,
  'Ops changes a group task');
select ok('Degrease BOH floors' = any (pg_temp.titles(:logan_oct)), 'an open walkthrough keeps its wording');

-- Ranalli's own version of a group task, and its own task.
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.save_quarterly_task('99999999-9999-4999-8999-000000000001', '11111111-1111-4111-8111-000000000004',
  'Organize utility areas and the dock', 'Clear the dock door too.', null)$$, 'Ops changes a group task for one restaurant');
select lives_ok($$select public.save_quarterly_task(null, '11111111-1111-4111-8111-000000000004', 'Clean the pizza oven flue', null, null, '{4}')$$,
  'and adds one of its own');
select is(pg_temp.titles(pg_temp.open_dec(:ranallis)),
  array['Check gutters', 'Clean the pizza oven flue', 'Degrease kitchen floors', 'Organize utility areas and the dock'],
  'that restaurant gets its version and its own task');
select ok(not ('Organize utility areas and the dock' = any (pg_temp.titles(pg_temp.open_dec(:logan)))),
  'and another restaurant gets the group''s');
select is((select count(*)::int from public.audit_log where action = 'quarterly_task.change_for_restaurant'
           and target_restaurant_id = :ranallis), 1, 'the change is logged against the restaurant');

-- Done once per quarter, matched through a version: a check on the group task in October
-- counts for Ranalli's December version of it.
select pg_temp.su();
insert into public.walkthrough_checks (walkthrough_id, quarterly_task_id, result)
values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', :utility, 'good');
select ok(pg_temp.done_of(pg_temp.open_dec(:ranallis), 'Organize utility areas and the dock'),
  'done earlier in the quarter counts for the version');

-- Remove a group task for Porter, then restore it.
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.set_quarterly_task_removed('99999999-9999-4999-8999-000000000002', '11111111-1111-4111-8111-000000000003', true)$$,
  'Ops removes a group task for one restaurant');
select ok(not ('Degrease kitchen floors' = any (pg_temp.titles(pg_temp.open_dec(:porter)))), 'it goes on none of its walkthroughs');
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.set_quarterly_task_removed('99999999-9999-4999-8999-000000000002', '11111111-1111-4111-8111-000000000003', false)$$,
  'and restores it');
select ok('Degrease kitchen floors' = any (pg_temp.titles(pg_temp.open_dec(:porter))), 'and it is back');

-- Back to the group's version.
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.reset_quarterly_task('99999999-9999-4999-8999-000000000001', '11111111-1111-4111-8111-000000000004')$$,
  'Ops puts a restaurant back on the group''s version');
select ok('Organize utility areas' = any (pg_temp.titles(pg_temp.open_dec(:ranallis))), 'which it gets again');

-- Turn off, and delete only while never used.
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$select public.delete_quarterly_task('99999999-9999-4999-8999-000000000001')$$,
  '23503', null, 'a task a walkthrough has had is not deleted');
select lives_ok($$select public.set_quarterly_task_active('99999999-9999-4999-8999-000000000001', false)$$, 'but turned off');
select ok(not ('Organize utility areas' = any (pg_temp.titles(pg_temp.open_dec(:logan)))), 'and goes on no new walkthrough');
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$select public.delete_quarterly_task(public.save_quarterly_task(null, null, 'Spring clean', null, null, '{2}'))$$,
  'a task no walkthrough has had is deleted');

select * from finish();
rollback;

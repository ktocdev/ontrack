-- In-house tasks (OT-30): checked off and deleted only through their functions, by
-- people who can create tickets at that restaurant, and deleted only while open.
begin;
select plan(23);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Maya manages Logan Square, where the seed's tasks are. Ari manages Ranalli's.
\set maya '''22222222-2222-4222-8222-000000000001'''
\set logan '''11111111-1111-4111-8111-000000000001'''

select is(
  (select array_agg(area::text order by area::text) from public.inhouse_fixes where done_at is null),
  array['boh', 'boh', 'foh', 'foh', 'foh'], 'the seed has the board''s three Front and two Back');

-- Another restaurant's manager, and leadership.
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.inhouse_fixes where restaurant_id = (:logan)::uuid), 0,
  'another restaurant''s manager reads none of them');
select set_config('role', 'postgres', true);
create temp table ids on commit drop as
  select title, id from public.inhouse_fixes;
grant select on ids to authenticated;

select pg_temp.login('ari.kim@example.com');
select throws_ok(
  format($$ select public.set_inhouse_fix_done('%s', true) $$, (select id from ids where title like 'Replace 2 bulbs%')),
  '42501', null, 'another restaurant''s manager cannot check one off');
select throws_ok(
  format($$ select public.delete_inhouse_fix('%s') $$, (select id from ids where title like 'Replace 2 bulbs%')),
  '42501', null, 'or delete one');

select pg_temp.login('lee.chen@example.com');
select throws_ok(
  format($$ select public.set_inhouse_fix_done('%s', true) $$, (select id from ids where title like 'Replace 2 bulbs%')),
  '42501', null, 'leadership cannot check one off');

-- Checking off and back.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(
  format($$ select public.set_inhouse_fix_done('%s', true) $$, (select id from ids where title like 'Replace 2 bulbs%')),
  'a manager checks one off');
select ok((select done_at is not null and done_by = (:maya)::uuid from public.inhouse_fixes where title like 'Replace 2 bulbs%'),
  'and the database says who and when');
select lives_ok(
  format($$ select public.set_inhouse_fix_done('%s', false) $$, (select id from ids where title like 'Replace 2 bulbs%')),
  'and unchecks it');
select ok((select done_at is null and done_by is null from public.inhouse_fixes where title like 'Replace 2 bulbs%'),
  'which clears both');

-- The API can't go around the functions.
update public.inhouse_fixes set title = 'Changed', done_at = now() where title like 'Tighten%';
select is((select count(*)::int from public.inhouse_fixes where title like 'Tighten%' and done_at is null), 1,
  'a direct update changes nothing');
delete from public.inhouse_fixes where title like 'Tighten%';
select is((select count(*)::int from public.inhouse_fixes where title like 'Tighten%'), 1,
  'a direct delete removes nothing');
select throws_ok($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by, done_at)
  values ('11111111-1111-4111-8111-000000000001', 'Already done', auth.uid(), now())
$$, '42501', null, 'a task cannot be added already checked off');
select lives_ok($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', 'A new task', auth.uid())
$$, 'a manager can add a task at their restaurant');
select throws_ok($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '   ', auth.uid())
$$, '23514', null, 'a blank title is refused');
select throws_ok($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', repeat('x', 141), auth.uid())
$$, '23514', null, 'and so is one longer than a ticket''s');
select throws_ok($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000002', 'Not mine', auth.uid())
$$, '42501', null, 'and none at another restaurant');
select set_config('role', 'postgres', true);
-- Rows written in this transaction carry its now().
select is((select count(*)::int from public.notifications where created_at = now()), 0,
  'adding a task notifies nobody');
select pg_temp.login('maya.reyes@example.com');

-- Deleting.
select throws_ok(
  format($$ select public.delete_inhouse_fix('%s') $$, (select id from ids where title like 'Re-glue%')),
  '23514', null, 'a checked-off task cannot be deleted');
select lives_ok(
  format($$ select public.delete_inhouse_fix('%s') $$, (select id from ids where title like 'Clear boxes%')),
  'an open task can');
select is((select count(*)::int from public.inhouse_fixes where title like 'Clear boxes%'), 0, 'and it is gone');
select throws_ok(
  format($$ select public.delete_inhouse_fix('%s') $$, (select id from ids where title like 'Clear boxes%')),
  '42501', null, 'and cannot be deleted twice');

select set_config('role', 'postgres', true);
select is(
  (select meta ->> 'title' from public.audit_log
   where action = 'inhouse_fix.delete' and actor_id = (:maya)::uuid and target_restaurant_id = (:logan)::uuid),
  'Clear boxes from utility closet', 'the log keeps who deleted what');
select is(
  (select count(*)::int from public.audit_log where action = 'inhouse_fix.delete'), 1,
  'and only the delete that happened');

select * from finish();
rollback;

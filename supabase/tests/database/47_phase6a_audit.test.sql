-- OT-110: the security pass over Phase 6a. Where a ticket came from on a walkthrough is
-- written only by the walkthrough, for Ops too; a check goes with its last in-house fix;
-- and a video link, a schedule's months and its reminder days hold only what they should.
begin;
select plan(17);

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
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set paint '''dddddddd-dddd-4ddd-8ddd-000000000114'''
\set bulbs '''dddddddd-dddd-4ddd-8ddd-000000000202'''
\set utility '''99999999-9999-4999-8999-000000000001'''
-- An ordinary open ticket at Logan Square, and one the seed links to October's walkthrough.
\set plain '''66666666-6666-4666-8666-000000001037'''
\set linked '''66666666-6666-4666-8666-000000001039'''

select is(
  (select source::text || ' ' || (walkthrough_id is null)::text from public.tickets where id = :plain),
  'reported true', 'the ordinary ticket starts with no tag and no walkthrough');

-- 1. Ops changes a ticket, but not where it came from on a walkthrough.
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$update public.tickets set source = 'walkthrough' where id = %L$$, :plain),
  '42501', null, 'Ops can''t give a ticket the Walkthrough tag');
select throws_ok(format($$update public.tickets set walkthrough_id = %L where id = %L$$, :oct, :plain),
  '42501', null, 'nor link one to a walkthrough');
select throws_ok(format($$update public.tickets set source = 'reported' where id = %L$$, :linked),
  '42501', null, 'nor take the tag off a walkthrough''s ticket');
select throws_ok(format($$update public.tickets set walkthrough_id = null where id = %L$$, :linked),
  '42501', null, 'nor unlink it');
select lives_ok(format($$update public.tickets set urgency = 'urgent', source = source where id = %L$$, :linked),
  'Ops still changes the rest of a walkthrough''s ticket');

-- The walkthrough still makes its own, and a manager still edits and closes it.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$select public.create_walkthrough_ticket(%L, 'Loose cover plate', %L)$$, :oct, :outlets),
  'a ticket is still made from an item');
select lives_ok(
  format($$update public.tickets set title = 'Loose cover plate by the mop sink', status = 'closed'
           where walkthrough_id = %L and title = 'Loose cover plate'$$, :oct),
  'and its manager still edits and closes it');

-- 2. A check goes with its last fix, and stays while anything else is on it.
select public.add_walkthrough_fix(:oct, 'Touch up the scuffs', :paint);
select public.add_walkthrough_fix(:oct, 'Repaint the door frame', :paint);
select public.delete_inhouse_fix((select id from public.inhouse_fixes where title = 'Touch up the scuffs'));
select is(
  (select count(*)::int from public.walkthrough_checks where walkthrough_id = :oct and item_id = :paint), 1,
  'deleting one of two fixes keeps the item''s check');
select public.delete_inhouse_fix((select id from public.inhouse_fixes where title = 'Repaint the door frame'));
select is(
  (select count(*)::int from public.walkthrough_checks where walkthrough_id = :oct and item_id = :paint), 0,
  'deleting the last one takes the check with it');
select lives_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :paint), 'and the item can then be Good');

select public.add_walkthrough_fix(:oct, 'Swap the bulb', :bulbs);
select public.create_walkthrough_ticket(:oct, 'Fixture flickers', :bulbs);
select public.delete_inhouse_fix((select id from public.inhouse_fixes where title = 'Swap the bulb'));
select is(
  (select count(*)::int from public.walkthrough_checks where walkthrough_id = :oct and item_id = :bulbs), 1,
  'a check with a ticket stays when its fix is deleted');

select public.add_walkthrough_fix(:oct, 'Clear the panel', null, :utility);
select public.delete_inhouse_fix((select id from public.inhouse_fixes where title = 'Clear the panel'));
select is(
  (select count(*)::int from public.walkthrough_checks where walkthrough_id = :oct and quarterly_task_id = :utility), 0,
  'a quarterly task''s check goes the same way');

-- 3. What the checklist and the schedule may hold.
select pg_temp.su();
select throws_ok(format($$update public.quarterly_tasks set video_url = 'javascript:alert(1)' where id = %L$$, :utility),
  '23514', null, 'a video link is a web address');
select throws_ok(format($$update public.walkthrough_items set video_url = 'https://example.com/a b' where id = %L$$, :outlets),
  '23514', null, 'with no spaces in it');
select throws_ok($$update public.walkthrough_schedules set months = '{0,13}' where restaurant_id is null$$,
  '23514', null, 'a schedule''s months are 1 to 12');
select throws_ok($$update public.walkthrough_schedules set reminder_days = '{7,45}' where restaurant_id is null$$,
  '23514', null, 'and its reminder days 0 to 31');

select * from finish();
rollback;

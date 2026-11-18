-- The checklist editor (OT-136): checked and logged, and a change to a checklist a
-- walkthrough has had goes on a new version, so every walkthrough keeps the one it had.
begin;
select plan(26);

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

\set kitchen_ext '''88888888-8888-4888-8888-000000000002'''
\set kitchen '''cccccccc-cccc-4ccc-8ccc-000000000003'''
select id as item, title as item_title, group_name as item_group
from public.walkthrough_items where section_id = :kitchen order by sort_order limit 1 \gset
select w.id as september, (select sum(total) from public.v_walkthrough_progress p where p.walkthrough_id = w.id) as sept_total
from public.walkthroughs w where w.template_id = :kitchen_ext order by period desc limit 1 \gset

-- Only someone with set_walkthrough_schedule changes a checklist, and never directly.
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$select public.save_checklist('88888888-8888-4888-8888-000000000002', 'Mine', null, null)$$,
  '42501', null, 'a Reporter can''t change a checklist');
select pg_temp.login('bert.velilla@example.com');
update public.walkthrough_items set title = 'x';
select pg_temp.su();
select is((select title from public.walkthrough_items where id = :'item'), :'item_title'::text, 'items are not updated directly');

-- The first change to a checklist a walkthrough has had makes a new version.
select pg_temp.login('bert.velilla@example.com');
select public.save_checklist_item(:kitchen_ext, :'item', :kitchen, :'item_group', 'Outlets and cover plates',
  'Check every cover plate.', null, null) as v1 \gset
select isnt(:'v1'::uuid, :kitchen_ext::uuid, 'a change to a checklist a walkthrough has had goes on a new version');
select pg_temp.su();
select is((select replaced_by from public.walkthrough_templates where id = :kitchen_ext), :'v1'::uuid, 'which replaces the old one');
select is((select title from public.walkthrough_items where id = :'item'), :'item_title'::text, 'the old one is as it was');
select is((select title from public.walkthrough_items where id = public.checklist_item(:'v1', :'item')),
  'Outlets and cover plates', 'and the new one has the change');
select is((select sum(total) from public.v_walkthrough_progress where walkthrough_id = :'september'), :'sept_total'::bigint,
  'a walkthrough that had it keeps its checklist');
select is(public.rotation_template((select id from public.walkthrough_rotations where is_group), '2026-11-01'), :'v1'::uuid,
  'the rotation''s month moves to the new version');
select is((select count(*)::int from public.audit_log where action = 'checklist.version'), 1, 'the new version is logged');

-- Further changes go to the new version until a month opens with it.
select pg_temp.login('bert.velilla@example.com');
select is(public.save_checklist(:'v1', 'Kitchen + Exterior', 'A closer look', 'Kitchen + Ext'), :'v1'::uuid,
  'a checklist no walkthrough has had yet is changed in place');
select throws_ok($$select public.save_checklist('88888888-8888-4888-8888-000000000002', 'Old', null, null)$$,
  '40001', null, 'a version an edit has replaced is not changed');
select throws_ok(format('select public.save_rotation(id, name, array[%L]::uuid[], starts_on, due_day, reminder_days) from public.walkthrough_rotations where is_group',
  '88888888-8888-4888-8888-000000000002'), '22023', null, 'nor put on a rotation');

-- Items: add, delete one with no history, turn off one with history.
select pg_temp.login('bert.velilla@example.com');
select public.save_checklist_item(:'v1', null, :kitchen, 'Electrical', 'Breaker panel labels', null, 'https://example.com/panel', null);
select pg_temp.su();
select id as new_item from public.walkthrough_items where title = 'Breaker panel labels' \gset
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.save_checklist_item(%L, null, %L, %L, %L, null, null, null)', :'v1',
  'cccccccc-cccc-4ccc-8ccc-000000000001', 'Electrical', 'Elsewhere'),
  '22023', null, 'an item goes in a section of its own checklist');
select throws_ok(format('select public.save_checklist_item(%L, null, %L, %L, %L, null, %L, null)', :'v1', :kitchen, 'Electrical', 'Bad', 'javascript:x'),
  '23514', null, 'a video link is a web address');
select throws_ok(format('select public.delete_checklist_part(%L, %L, %L)', :'v1', 'item', :'item'),
  '23503', null, 'an item a walkthrough has had is not deleted');
select lives_ok(format('select public.set_checklist_part_active(%L, %L, %L, false)', :'v1', 'item', :'item'),
  'but turned off');
select lives_ok(format('select public.delete_checklist_part(%L, %L, %L)', :'v1', 'item', :'new_item'),
  'an item added since is deleted');

-- Groups and sections.
select lives_ok(format('select public.rename_checklist_group(%L, %L, %L, %L)', :'v1', :kitchen, :'item_group', 'Power'),
  'a group is renamed');
select pg_temp.su();
select ok(not exists (select 1 from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
                      where s.template_id = :'v1' and i.group_name = :'item_group'), 'on every item in it');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.save_checklist_section(%L, null, %L, null, null)', :'v1', 'kitchen'),
  '23505', null, 'two sections don''t share a name');
select lives_ok(format('select public.save_checklist_section(%L, null, %L, %L, null)', :'v1', 'Patio', 'Patio'),
  'a section is added');

-- Order: all of them, once.
select throws_ok(format('select public.order_checklist(%L, null, array[%L]::uuid[])', :'v1', :kitchen),
  '22023', null, 'an order names every section');
select lives_ok(format('select public.order_checklist(%L, null, (select array_agg(id order by sort_order desc) from public.walkthrough_sections where template_id = %L))', :'v1', :'v1'),
  'the sections are put in a new order');

-- A checklist: a copy stands on its own and can be deleted; one in use can't.
select public.add_checklist('Patio season', 'A closer look', 'Patio', :'v1') as copy \gset
select is((select count(*)::int from public.walkthrough_rotation_months where template_id = :'copy'), 0,
  'a copy goes on no rotation by itself');
select lives_ok(format('select public.delete_checklist(%L)', :'copy'), 'and, unused, can be deleted');
select throws_ok(format('select public.delete_checklist(%L)', :'v1'), '23503', null, 'one a rotation uses can''t');

select * from finish();
rollback;

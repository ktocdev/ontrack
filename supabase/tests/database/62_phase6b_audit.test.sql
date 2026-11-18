-- Security and code quality pass over 6b (OT-138): the group's schedule, checklists and
-- quarterly tasks are changed by Ops and admins only; a month never goes on a replaced
-- checklist; a turned-off category goes on no item new to it, and a ticket from an item or
-- a fix whose category was turned off asks for one; no reminder for an archived
-- restaurant; the log names a restaurant's task's restaurant; the helpers stay closed.
begin;
select plan(34);

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
\set west '''11111111-1111-4111-8111-000000000002'''
\set ranallis '''11111111-1111-4111-8111-000000000004'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set chris '''22222222-2222-4222-8222-000000000004'''
\set boh_foh '''88888888-8888-4888-8888-000000000001'''
\set kitchen_ext '''88888888-8888-4888-8888-000000000002'''
\set ranallis_rotation '''bbbbbbbb-bbbb-4bbb-8bbb-000000000001'''
\set group_task '''99999999-9999-4999-8999-000000000001'''
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set bulbs '''dddddddd-dddd-4ddd-8ddd-000000000102'''
\set boh_electrical '''33333333-3333-4333-8333-000000000014'''
\set boh_lighting '''33333333-3333-4333-8333-000000000015'''
\set foh_plumbing '''33333333-3333-4333-8333-000000000002'''

-- ---------------------------------------------------------------------------
-- The helpers stay closed to everyone signed in.
-- ---------------------------------------------------------------------------
select is(
  array(
    select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('checklist_log', 'copy_checklist', 'checklist_for_change', 'checklist_section', 'checklist_item',
        'quarter_tasks_for', 'quarterly_task_check', 'notify_inhouse_task', 'walkthrough_tasks_on_open',
        'rotation_template', 'restaurant_rotation', 'rotation_months_current', 'walkthrough_reminded',
        'inhouse_fixes_converted_stay', 'walkthrough_items_category_active')
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  ),
  array[]::text[], 'nobody signed in runs the helpers behind the 6b functions');

-- ---------------------------------------------------------------------------
-- 1. A Reporter given the right at one restaurant changes that restaurant's, not the group's.
-- ---------------------------------------------------------------------------
insert into public.rights (user_id, key, allowed) values (:maya, 'set_walkthrough_schedule', true);
select pg_temp.login('maya.reyes@example.com');
select ok(public.can('set_walkthrough_schedule', :logan), 'a Reporter given Set walkthrough schedule holds it at her restaurant');
select throws_ok(format('select public.save_rotation(id, name, array[%L]::uuid[], starts_on, due_day, reminder_days) from public.walkthrough_rotations where is_group', '88888888-8888-4888-8888-000000000001'),
  '42501', null, 'but can''t change the group''s rotation');
select throws_ok($$select public.save_rotation('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'Mine now', array['88888888-8888-4888-8888-000000000001']::uuid[], '2026-01-01', null, '{7}')$$,
  '42501', null, 'nor a rotation another restaurant is on');
select throws_ok($$select public.delete_rotation('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')$$, '42501', null, 'nor delete one');
select throws_ok($$select public.save_checklist('88888888-8888-4888-8888-000000000002', 'Mine', null, null)$$,
  '42501', null, 'nor change a checklist');
select throws_ok($$select public.add_checklist('Mine', null, null)$$, '42501', null, 'nor add one');
select throws_ok($$select public.set_checklist_active('88888888-8888-4888-8888-000000000002', false)$$, '42501', null, 'nor turn one off');
select throws_ok($$select public.delete_checklist('88888888-8888-4888-8888-000000000002')$$, '42501', null, 'nor delete one');
select throws_ok($$select public.import_checklist('88888888-8888-4888-8888-000000000002', '[{"section":"a","group":"b","title":"c"}]')$$,
  '42501', null, 'nor import one');
select throws_ok($$select public.save_quarterly_task(null, null, 'For everyone', null, null, '{1}')$$,
  '42501', null, 'nor add a task for every restaurant');
select throws_ok($$select public.set_quarterly_task_active('99999999-9999-4999-8999-000000000001', false)$$,
  '42501', null, 'nor turn the group''s task off');
select lives_ok(format('select public.save_quarterly_task(null, %L, ''Check the patio heaters'', null, null, ''{4}'')', '11111111-1111-4111-8111-000000000001'),
  'her own restaurant''s task she may add');
select lives_ok(format('select public.set_restaurant_rotation(%L, %L)', '11111111-1111-4111-8111-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001'),
  'and put her restaurant on another rotation');
select throws_ok(format('select public.set_restaurant_rotation(%L, null)', '11111111-1111-4111-8111-000000000004'),
  '42501', null, 'but not another restaurant');

-- Ops narrowed to one restaurant still looks after the group's, as with categories (accepted).
select pg_temp.su();
delete from public.memberships where user_id = :chris;
insert into public.memberships (user_id, restaurant_id) values (:chris, :west);
select pg_temp.login('chris.novak@example.com');
select lives_ok($$select public.add_checklist('Chris''s list', null, null)$$, 'Ops at one restaurant still adds a checklist');
select pg_temp.login('admin@example.com');
select lives_ok($$select public.save_quarterly_task(null, null, 'Admin''s task', null, null, '{1}')$$, 'and an admin changes the group''s tasks');

-- ---------------------------------------------------------------------------
-- 3. A turned-off category
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
select public.save_checklist_item(:kitchen_ext, i.id, i.section_id, i.group_name, i.title, null, null, :foh_plumbing) as v1,
       i.id as k_item, i.section_id as k_section, i.group_name as k_group
from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
where s.template_id = :kitchen_ext order by s.sort_order, i.sort_order limit 1 \gset
select pg_temp.su();
update public.categories set active = false where id in (:foh_plumbing, :boh_electrical);
select public.checklist_item(:'v1', :'k_item') as v1_item, public.checklist_section(:'v1', :'k_section') as v1_section \gset

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format('select public.save_checklist_item(%L, %L, %L, %L, ''Renamed'', null, null, %L)',
  :'v1', :'v1_item', :'v1_section', :'k_group', '33333333-3333-4333-8333-000000000002'),
  'an item keeps a category turned off since');
select throws_ok(format('select public.save_checklist_item(%L, null, %L, %L, ''New item'', null, null, %L)',
  :'v1', :'v1_section', :'k_group', '33333333-3333-4333-8333-000000000002'),
  '23514', null, 'a turned-off category goes on no new item');
select throws_ok(format('select public.import_checklist(%L, %L)', :'v1',
  '[{"section":"S","group":"G","title":"T","category_id":"33333333-3333-4333-8333-000000000002"}]'),
  '23514', null, 'nor on one by import');
-- A month opens with the version, so the next edit copies it, category and all.
select pg_temp.su();
insert into public.walkthroughs (restaurant_id, template_id, period, due_on) values (:west, :'v1', '2027-01-01', '2027-01-31');
select pg_temp.login('bert.velilla@example.com');
select public.save_checklist(:'v1', 'Kitchen + Exterior', null, null) as v2 \gset
select pg_temp.su();
select is((select category_id from public.walkthrough_items where id = public.checklist_item(:'v2', :'v1_item')), :foh_plumbing::uuid,
  'and a new version''s copy of the item keeps it');

-- 2. The new version replaced the old, which goes back on no month, by insert or update.
select throws_ok(format('update public.walkthrough_rotation_months set template_id = %L where template_id = %L', :'v1', :'v2'),
  '22023', null, 'a month is not moved onto a replaced checklist');
select is((select count(*)::int from public.walkthrough_rotation_months m join public.walkthrough_templates t on t.id = m.template_id
           where t.replaced_by is not null), 0, 'and no month is on one');

-- A ticket from an item whose category was turned off asks for one.
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('select public.create_walkthrough_ticket(%L, ''Outlet sparks'', %L)', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'dddddddd-dddd-4ddd-8ddd-000000000104'),
  '22023', 'pick a category for this ticket', 'a ticket from an item whose category was turned off asks for a category');
select lives_ok(format('select public.create_walkthrough_ticket(%L, ''Outlet sparks'', %L, p_category_id => %L)',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'dddddddd-dddd-4ddd-8ddd-000000000104', '33333333-3333-4333-8333-000000000015'),
  'and takes the one given');
select public.add_walkthrough_fix(:oct, 'Tighten the cover plate', :outlets) as fix \gset
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.convert_inhouse_fix(%L)', :'fix'),
  '22023', 'pick a category for this ticket', 'so does making a fix on that item a ticket');
select lives_ok(format('select public.convert_inhouse_fix(%L, %L)', :'fix', '33333333-3333-4333-8333-000000000015'),
  'which takes the one given');
select pg_temp.su();
select is((select category_id from public.tickets where id = (select converted_ticket_id from public.inhouse_fixes where id = :'fix')),
  :boh_lighting::uuid, 'the ticket has it');
-- An item whose category is still on needs nothing picked.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format('select public.create_walkthrough_ticket(%L, ''Bulb out'', %L)', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'dddddddd-dddd-4ddd-8ddd-000000000102'),
  'an item whose category is on still gives it');

-- ---------------------------------------------------------------------------
-- 4. No reminder for an archived restaurant
-- ---------------------------------------------------------------------------
select pg_temp.su();
select id as west_oct from public.walkthroughs where restaurant_id = :west and period = '2026-10-01' \gset
update public.restaurants set archived_at = now() where id = :west;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.send_walkthrough_reminder(%L)', :'west_oct'), '22023', 'this restaurant is archived',
  'no reminder is sent for an archived restaurant');
select pg_temp.su();
select is((select count(*)::int from public.notifications where walkthrough_id = :'west_oct' and actor_id is not null), 0,
  'and nothing was queued');
update public.restaurants set archived_at = null where id = :west;
select pg_temp.login('bert.velilla@example.com');
select lives_ok(format('select public.send_walkthrough_reminder(%L)', :'west_oct'), 'restored, it goes');

-- ---------------------------------------------------------------------------
-- 5. The log names the restaurant of a task changed by its own id
-- ---------------------------------------------------------------------------
select public.save_quarterly_task(null, :ranallis, 'Clean the hood filters', null, null, '{4}') as own \gset
select public.save_quarterly_task(:'own', null, 'Clean the hood filters well', null, null);
select pg_temp.su();
select is((select target_restaurant_id from public.audit_log where action = 'quarterly_task.save' and meta ->> 'id' = :'own'),
  :ranallis::uuid, 'a change to a restaurant''s task is logged with its restaurant');
select is((select target_restaurant_id from public.audit_log where action = 'quarterly_task.add' and meta ->> 'title' = 'Admin''s task'),
  null::uuid, 'and the group''s with none');

select * from finish();
rollback;

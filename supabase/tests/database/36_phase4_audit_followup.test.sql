-- Fixes from the independent Phase 4 audit (OT-84): categories are Ops's and admins',
-- the database picks a unit's id, a service record is about its ticket's unit and is
-- never deleted, a task once checked off stays, and a new ticket locks its unit.
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

-- Seed ids: Maya manages Logan Square (r1) with edit_equipment by override. OT-1042 is
-- open there on Walk-in Cooler 1. The Espresso Machine is at Ranalli's. Bert is Ops.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set fridge '''33333333-3333-4333-8333-000000000012'''
\set cooler '''44444444-4444-4444-8444-000000000001'''
\set espresso '''44444444-4444-4444-8444-000000000005'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set chosen '''aaaaaaaa-aaaa-4aaa-8aaa-0000000000ff'''

-- Categories ----------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ insert into public.categories (name, area) values ('Patio', 'foh') $$,
  '42501', null, 'a manager with edit_equipment can''t add a category');
update public.categories set name = 'Renamed by a manager' where id = (:fridge)::uuid;
select pg_temp.su();
select isnt((select name from public.categories where id = (:fridge)::uuid), 'Renamed by a manager',
  'or rename one');

select pg_temp.login('lee.chen@example.com');
select throws_ok($$ insert into public.categories (name, area) values ('Patio', 'foh') $$,
  '42501', null, 'nor can leadership');

select pg_temp.login('bert.velilla@example.com');
-- Since OT-86 Ops and admins change categories only through logged functions.
select lives_ok($$ select public.add_category('Patio', 'foh') $$,
  'Ops adds one');
select lives_ok(format($$ select public.rename_category(%L, 'Refrigeration & ice') $$, :fridge),
  'and renames one');
delete from public.categories where name = 'Patio';
select is((select count(*)::int from public.categories where name = 'Patio'), 1,
  'but deletes none through the API');

select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.rename_category(%L, 'Refrigeration') $$, :fridge),
  'and an admin can change one too');

-- A unit's id ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  insert into public.equipment (id, restaurant_id, category_id, name) values (%L, %L, %L, 'Test: chosen id')
$$, :chosen, :r1, :fridge), 'a unit added with an id of the client''s choosing still goes in');
select is((select count(*)::int from public.equipment where id = (:chosen)::uuid), 0,
  'under an id the database picked');
select is((select count(*)::int from public.equipment where name = 'Test: chosen id'), 1, 'and only once');

-- Service records -----------------------------------------------------------------------

-- Since OT-90 records are written only through log_service and update_service_record.
select pg_temp.login('bert.velilla@example.com');
select public.log_service(p_kind => 'in_house', p_ticket_id => (:t1042)::uuid,
  p_equipment_id => (:espresso)::uuid, p_title => 'Test: wrong unit');
select is((select equipment_id from public.service_records where title = 'Test: wrong unit'), (:cooler)::uuid,
  'a record is about its ticket''s unit, whatever the client sent');
select public.update_service_record(
  (select id from public.service_records where title = 'Test: wrong unit'), 'in_house', current_date,
  p_ticket_id => (:t1042)::uuid, p_equipment_id => (:espresso)::uuid, p_title => 'Test: wrong unit');
select is((select equipment_id from public.service_records where title = 'Test: wrong unit'), (:cooler)::uuid,
  'and an edit can''t move it to another');
delete from public.service_records where title = 'Test: wrong unit';
select is((select count(*)::int from public.service_records where title = 'Test: wrong unit'), 1,
  'and it is never deleted');

-- In-house tasks ------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select lives_ok($$ select public.set_inhouse_fix_done((select id from public.inhouse_fixes where title like 'Re-glue%'), false) $$,
  'a checked-off task can still be unchecked, for a mis-tap');
select throws_ok($$ select public.delete_inhouse_fix((select id from public.inhouse_fixes where title like 'Re-glue%')) $$,
  '23514', null, 'but then can''t be deleted, since it was checked off once');
select pg_temp.su();
select is((select count(*)::int from public.audit_log where action = 'inhouse_fix.uncheck'), 1,
  'and the uncheck is logged');

-- A ticket's unit, as a manager without edit_equipment ---------------------------------

select pg_temp.login('ari.kim@example.com');
select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000004', (select category_id from public.equipment where id = %L), %L, 'Test: lock as a manager', auth.uid())
$$, :espresso, :espresso), 'a manager without edit_equipment still creates a ticket on a unit, through the lock');

select * from finish();
rollback;

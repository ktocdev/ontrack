-- Retire, restore and delete a unit (OT-66): only with edit_equipment at its
-- restaurant, only through the functions, logged, delete only while nothing points
-- to it; a unit moves restaurants only while unused; the data plate photo bucket.
begin;
select plan(32);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- The database owner with nobody signed in, as the seed and migrations run.
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids (supabase/seed.sql): Maya manages Logan Square (r1) with edit_equipment by
-- override; Ari manages Ranalli's (r4) without it; Bert is Ops everywhere; Lee is
-- leadership. Walk-in Cooler 1 (e1) at r1 has tickets; 1033 is a ticket at r4.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set r2 '''11111111-1111-4111-8111-000000000002'''
\set r3 '''11111111-1111-4111-8111-000000000003'''
\set r4 '''11111111-1111-4111-8111-000000000004'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set e1 '''44444444-4444-4444-8444-000000000001'''
\set t1033 '''66666666-6666-4666-8666-000000001033'''
\set fridge '''33333333-3333-4333-8333-000000000012'''
-- Units made here: u1 at r1 and u3 at r1 with nothing on them, u2 at r4 with only a
-- service record.
\set u1 '''aaaaaaaa-0000-4000-8000-000000000001'''
\set u2 '''aaaaaaaa-0000-4000-8000-000000000002'''
\set u3 '''aaaaaaaa-0000-4000-8000-000000000003'''

select pg_temp.su();
insert into public.equipment (id, restaurant_id, category_id, name, created_by) values
  ((:u1)::uuid, (:r1)::uuid, (:fridge)::uuid, 'Test: prep cooler', (:bert)::uuid),
  ((:u2)::uuid, (:r4)::uuid, (:fridge)::uuid, 'Test: bar cooler', (:bert)::uuid),
  ((:u3)::uuid, (:r1)::uuid, (:fridge)::uuid, 'Test: spare cooler', (:bert)::uuid);
insert into public.service_records (ticket_id, equipment_id, kind, title)
values ((:t1033)::uuid, (:u2)::uuid, 'in_house', 'Test: cleaned coils');

-- Who may retire.
select pg_temp.login('ari.kim@example.com');
select throws_ok(format($$ select public.set_equipment_retired('%s', true) $$, :u2),
  '42501', null, 'a manager without edit_equipment cannot retire a unit at their restaurant');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.set_equipment_retired('%s', true) $$, :u1),
  '42501', null, 'leadership cannot retire a unit');
select pg_temp.login('dana.ortiz@example.com');
select throws_ok(format($$ select public.set_equipment_retired('%s', true) $$, :u1),
  '42501', null, 'another restaurant''s manager cannot either');

-- Retire and restore, logged.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$ select public.set_equipment_retired('%s', true) $$, :u1),
  'a manager with edit_equipment retires a unit at her restaurant');
select ok((select retired_at is not null and retired_by = (:maya)::uuid from public.equipment where id = (:u1)::uuid),
  'and the database says who and when');
select throws_ok(format($$ update public.equipment set retired_at = null where id = '%s' $$, :u1),
  '42501', null, 'restoring by a direct update is refused');
select throws_ok(format($$ update public.equipment set retired_by = '%s' where id = '%s' $$, :bert, :u1),
  '42501', null, 'and so is rewriting who retired it');
select lives_ok(format($$ select public.set_equipment_retired('%s', false) $$, :u1),
  'she restores it through the function');
select ok((select retired_at is null and retired_by is null from public.equipment where id = (:u1)::uuid),
  'and it is back');
select lives_ok(format($$ select public.set_equipment_retired('%s', false) $$, :u1),
  'restoring a unit that is not retired does nothing');

select pg_temp.su();
select is(
  (select array_agg(action order by id) from public.audit_log where meta->>'equipment_id' = (:u1)::text),
  array['equipment.retire', 'equipment.restore'], 'each change is logged once');
select is(
  (select actor_id from public.audit_log where meta->>'equipment_id' = (:u1)::text and action = 'equipment.retire'),
  (:maya)::uuid, 'as the person who did it');

-- What the database keeps for itself.
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$
  insert into public.equipment (id, restaurant_id, category_id, name, created_by, retired_at)
  values ('aaaaaaaa-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000001',
          '33333333-3333-4333-8333-000000000012', 'Test: new cooler', '22222222-2222-4222-8222-000000000003', now())
$$, 'a unit is added with any created_by and retired_at');
select ok((select created_by = (:maya)::uuid and retired_at is null from public.equipment
           where id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  'but is saved as hers and not retired');
update public.equipment set created_by = (:bert)::uuid where id = 'aaaaaaaa-0000-4000-8000-000000000004';
select is((select created_by from public.equipment where id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  (:maya)::uuid, 'and created_by does not change on an edit');
select throws_ok(format($$ update public.equipment set plate_photo_path = '%s/plate.jpg' where id = '%s' $$, :e1, :u1),
  '23514', null, 'a data plate photo sits under its own unit');
select throws_ok(format($$ update public.equipment set name = '  ' where id = '%s' $$, :u1),
  '23514', null, 'a unit has a name');

-- Delete.
select is((select in_use from public.v_equipment_history where equipment_id = (:e1)::uuid), true,
  'a unit with tickets is in use');
select is((select in_use from public.v_equipment_history where equipment_id = (:u1)::uuid), false,
  'a new one is not');
select throws_ok(format($$ select public.delete_equipment('%s') $$, :e1),
  '23503', null, 'a unit with tickets cannot be deleted');
delete from public.equipment where id = (:u1)::uuid;
select ok(exists (select 1 from public.equipment where id = (:u1)::uuid),
  'and no unit is deleted directly');
select lives_ok(format($$ select public.delete_equipment('%s') $$, :u1),
  'an unused unit is deleted through the function');
select ok(not exists (select 1 from public.equipment where id = (:u1)::uuid), 'and is gone');

select pg_temp.login('ari.kim@example.com');
select is((select in_use from public.v_equipment_history where equipment_id = (:u2)::uuid), true,
  'a manager without see_costs still learns a unit has a service record');
select is((select count(*)::int from public.v_equipment_history where equipment_id = (:e1)::uuid), 0,
  'but not about units outside their scope');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.delete_equipment('%s') $$, :u2),
  '23503', null, 'a unit with only a service record cannot be deleted either');

-- Moving a unit.
select lives_ok(format($$ update public.equipment set restaurant_id = '%s' where id = '%s' $$, :r3, :u3),
  'Ops moves an unused unit to another restaurant');
select throws_ok(format($$ update public.equipment set restaurant_id = '%s' where id = '%s' $$, :r3, :e1),
  '23514', null, 'but not one with tickets');
select pg_temp.su();
update public.restaurants set archived_at = now() where id = (:r2)::uuid;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ update public.equipment set restaurant_id = '%s' where id = '%s' $$, :r2, :u3),
  '42501', null, 'or to an archived restaurant');

select pg_temp.su();
select is(
  (select array_agg(action order by id) from public.audit_log
   where meta->>'equipment_id' in ((:u1)::text, (:u2)::text, (:u3)::text) and action = 'equipment.delete'),
  array['equipment.delete'], 'the delete is logged, and the refusals are not');

-- The data plate photo bucket.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('equipment-photos', '%s/plate.jpg', '%s')
$$, :e1, :maya), 'a manager with edit_equipment adds a data plate photo at her restaurant');
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'equipment-photos'), 0,
  'another restaurant''s manager cannot see it');

select * from finish();
rollback;

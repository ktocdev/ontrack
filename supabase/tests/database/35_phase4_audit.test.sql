-- Fixes from the Phase 4 security pass (OT-73): a file must belong to a unit or service
-- record the caller may touch, a person's in-house task is one added by hand and dated
-- now, and a unit keeps its id.
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

-- Seed ids: Maya manages Logan Square (r1) with edit_equipment and see_costs by override,
-- and Walk-in Cooler 1 is there. Bert is Ops everywhere. A made-up id names no unit.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set cooler '''44444444-4444-4444-8444-000000000001'''
\set nobody '''00000000-0000-4000-8000-000000000999'''

-- Files ---------------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('equipment-photos', '%s/plate.jpg', auth.uid()::text)
$$, (:cooler)), 'a manager with edit_equipment adds a photo under a unit at their restaurant');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner_id) values ('equipment-photos', 'junk/x.jpg', auth.uid()::text)
$$, '42501', null, 'but not in a folder that names no unit');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('equipment-photos', '%s/x.jpg', auth.uid()::text)
$$, (:nobody)), '42501', null, 'or a made-up unit');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('manuals', '%s/x.pdf', auth.uid()::text)
$$, (:nobody)), '42501', null, 'and the same for manuals');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('invoices', '%s/x.pdf', auth.uid()::text)
$$, (:nobody)), '42501', null, 'and invoices, which need a real service record');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('manuals', '%s/x.pdf', auth.uid()::text)
$$, (:nobody)), '42501', null, 'Ops at every restaurant is refused a made-up unit too');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner_id) values ('invoices', 'junk/x.pdf', auth.uid()::text)
$$, '42501', null, 'and an invoice that names no service record');

-- A file left in a folder of no unit (a deleted one) is nobody's but the service role's.
select pg_temp.su();
insert into storage.objects (bucket_id, name) values ('equipment-photos', (:nobody) || '/left.jpg');
select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'equipment-photos' and name like (:nobody) || '/%'),
  0, 'a file under no unit is out of reach, even for Ops everywhere');
select is((select count(*)::int from storage.objects where bucket_id = 'equipment-photos' and name like (:cooler) || '/%'),
  1, 'while a unit''s own file still shows');

-- In-house tasks ----------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by, origin_label)
  values (%L, 'Claims a walkthrough', auth.uid(), 'Oct walkthrough')
$$, (:r1)), '42501', null, 'a person can''t give a task a walkthrough origin');
select throws_ok(format($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by, walkthrough_id)
  values (%L, 'Points at a walkthrough', auth.uid(), (select id from public.walkthroughs limit 1))
$$, (:r1)), '42501', null, 'or link it to a walkthrough');
select throws_ok(format($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by, converted_ticket_id)
  values (%L, 'Points at a ticket', auth.uid(), (select id from public.tickets limit 1))
$$, (:r1)), '42501', null, 'or to a ticket');
select lives_ok(format($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by, created_at)
  values (%L, 'Backdated', auth.uid(), '2020-01-01')
$$, (:r1)), 'a task added by hand still goes in');
select ok((select created_at = now() from public.inhouse_fixes where title = 'Backdated'),
  'dated now, whatever the client sent');

-- A unit keeps its id -----------------------------------------------------------------

update public.equipment set id = (:nobody)::uuid, name = 'Walk-in Cooler 1' where id = (:cooler)::uuid;
select pg_temp.su();
select is((select count(*)::int from public.equipment where id = (:cooler)::uuid), 1, 'an update can''t change a unit''s id');
select is((select count(*)::int from public.equipment where id = (:nobody)::uuid), 0, 'so no unit takes a new one');

-- The seed's own tasks came in as the owner, with their walkthroughs.
select ok((select count(*) > 0 from public.inhouse_fixes where walkthrough_id is not null),
  'the seed still has walkthrough tasks');

select * from finish();
rollback;

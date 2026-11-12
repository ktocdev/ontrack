-- Categories (OT-86): Ops with edit_equipment and admins add, rename, turn off and on,
-- and delete one never used, each through a function that checks and logs; a
-- turned-off category takes no new ticket or unit.
begin;
select plan(22);

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

-- Seed ids: Maya manages Logan Square (r1) with edit_equipment by override; Bert is Ops.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set fridge '''33333333-3333-4333-8333-000000000012'''

-- Who ----------------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.add_category('Patio', 'foh') $$, '42501', null,
  'a manager, even with edit_equipment, can''t add a category');
select throws_ok(format($$ select public.set_category_active(%L, false) $$, :fridge), '42501', null,
  'or turn one off');
select pg_temp.login('lee.chen@example.com');
select throws_ok($$ select public.add_category('Patio', 'foh') $$, '42501', null, 'nor can leadership');

-- Add and rename ----------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select lives_ok($$ select public.add_category('  Patio ', 'foh') $$, 'Ops adds a category');
select is((select name from public.categories where name = 'Patio'), 'Patio', 'trimmed');
select ok((select sort_order > (select max(sort_order) from public.categories where area = 'foh' and name <> 'Patio')
           from public.categories where name = 'Patio'), 'at the end of its area');
select throws_ok($$ select public.add_category('patio', 'foh') $$, '23505', null,
  'the same name in that area is refused, whatever its case');
select lives_ok($$ select public.add_category('Patio', 'boh') $$, 'but the other area may have one');
select throws_ok($$ insert into public.categories (name, area) values ('Side door', 'foh') $$, '42501', null,
  'and nobody adds one around the function');
select lives_ok($$ select public.rename_category((select id from public.categories where name = 'Patio' and area = 'foh'), 'Patio & sidewalk') $$,
  'Ops renames one');
update public.categories set name = 'Sneaky' where id = (:fridge)::uuid;
select pg_temp.su();
select isnt((select name from public.categories where id = (:fridge)::uuid), 'Sneaky', 'and nobody renames one around it');

-- Turn off and on ---------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.set_category_active(%L, false) $$, :fridge),
  'Ops turns off a category in use');
select is((select count(*)::int from public.equipment where category_id = (:fridge)::uuid) > 0, true,
  'whose units keep it');
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by) values (%L, %L, 'Test: off category', auth.uid())
$$, :r1, :fridge), '23514', null, 'a turned-off category takes no new ticket');
select throws_ok(format($$
  insert into public.equipment (restaurant_id, category_id, name) values (%L, %L, 'Test: off category')
$$, :r1, :fridge), '23514', null, 'or new unit');
select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.set_category_active(%L, true) $$, :fridge), 'and turns it back on');
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by) values (%L, %L, 'Test: on again', auth.uid())
$$, :r1, :fridge), 'after which it takes tickets again');

-- Delete ------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.delete_category(%L) $$, :fridge), '23503', null,
  'a category with tickets or equipment can''t be deleted');
select is((select in_use from public.v_category_history where category_id = (:fridge)::uuid), true, 'and says it is in use');
select lives_ok($$ select public.delete_category((select id from public.categories where name = 'Patio' and area = 'boh')) $$,
  'one never used can be');

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.add_category('Rooftop', 'foh') $$, 'an admin looks after them too');

select pg_temp.su();
-- One transaction gives every row the same time, so the actions are compared sorted.
select is((select array_agg(action order by action) from public.audit_log where action like 'category.%' and actor_id is not null),
  array['category.add', 'category.add', 'category.add', 'category.delete', 'category.rename', 'category.turn_off', 'category.turn_on'],
  'every change is logged');

select * from finish();
rollback;

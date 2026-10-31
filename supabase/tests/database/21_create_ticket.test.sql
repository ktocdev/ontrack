-- Create ticket (OT-26): Low urgency, one count per unit, and equipment has to be
-- at the ticket's restaurant and not retired.
begin;
select plan(9);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): Maya manages Logan Square.
\set maya '''22222222-2222-4222-8222-000000000001'''
\set logan '''11111111-1111-4111-8111-000000000001'''
\set fridge '''33333333-3333-4333-8333-000000000012'''
\set cooler '''44444444-4444-4444-8444-000000000001'''
\set west_loop_cooler '''44444444-4444-4444-8444-000000000006'''

select pg_temp.login('maya.reyes@example.com');

select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, urgency, created_by)
  values ('%s', '%s', '%s', 'Gasket again', 'low', '%s')
$$, :logan, :fridge, :cooler, :maya), 'a manager creates a Low ticket on their own equipment');

select is((select urgency::text from public.tickets where title = 'Gasket again'), 'low', 'and it stays Low');
select is((select status::text from public.tickets where title = 'Gasket again'), 'open', 'and open');

select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('%s', '%s', 'No equipment', '%s')
$$, :logan, :fridge, :maya), 'equipment is optional');

select throws_ok(format($$
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, created_by)
  values ('%s', '%s', '%s', 'Wrong place', '%s')
$$, :logan, :fridge, :west_loop_cooler, :maya), '23514', null, 'equipment at another restaurant is refused');

select throws_ok(format($$
  update public.tickets set equipment_id = '%s' where title = 'No equipment'
$$, :west_loop_cooler), '23514', null, 'on an edit too');

-- A unit counts once, however many tickets it has.
select is(
  (select equipment_count from public.v_category_equipment_counts
   where restaurant_id = (:logan)::uuid and category_id = (:fridge)::uuid),
  (select count(*)::int from public.equipment
   where restaurant_id = (:logan)::uuid and category_id = (:fridge)::uuid and retired_at is null),
  'a category counts each unit once');

-- Retired: refused for new links, and existing ones are left alone.
select set_config('role', 'postgres', true);
update public.equipment set retired_at = now() where id = (:cooler)::uuid;
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, created_by)
  values ('%s', '%s', '%s', 'Retired unit', '%s')
$$, :logan, :fridge, :cooler, :maya), '23514', null, 'a retired unit takes no new tickets');
select lives_ok($$
  update public.tickets set title = 'Gasket once more' where title = 'Gasket again'
$$, 'but a ticket already on it can still be edited');

select * from finish();
rollback;

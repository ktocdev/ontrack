-- Add restaurant (OT-9): admins only, the manager gets access in the same
-- step, the addition is logged, and no two restaurants share a color.
begin;
select plan(13);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids (supabase/seed.sql).
\set ari '''22222222-2222-4222-8222-000000000002'''
\set bert '''22222222-2222-4222-8222-000000000003'''

-- ---------------------------------------------------------------------------
-- An admin adds one with Ari as manager.
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select lives_ok(format($$
  select public.add_restaurant('Federale''s Wicker Park', '1500 N Milwaukee Ave, Chicago', '', '#0E7490', '%s')
$$, :ari), 'an admin can add a restaurant with a manager');

select pg_temp.logout();
select is(
  (select color from public.restaurants where name = 'Federale''s Wicker Park'),
  '#0e7490', 'the color is stored lower case');
select is(
  (select phone from public.restaurants where name = 'Federale''s Wicker Park'),
  null, 'a blank phone is stored as none');
select ok(
  exists (select 1 from public.memberships m join public.restaurants r on r.id = m.restaurant_id
          where r.name = 'Federale''s Wicker Park' and m.user_id = (:ari)::uuid),
  'the manager gets a membership there');
select ok(
  exists (select 1 from public.audit_log a join public.restaurants r on r.id = a.target_restaurant_id
          where r.name = 'Federale''s Wicker Park' and a.action = 'restaurant.add'
            and a.actor_id = (select id from auth.users where email = 'admin@example.com')),
  'and the addition is logged with its author');

select pg_temp.login('ari.kim@example.com');
select is(
  (select count(*)::int from public.restaurants where name = 'Federale''s Wicker Park'),
  1, 'so the manager can see it');
select pg_temp.login('maya.reyes@example.com');
select is(
  (select count(*)::int from public.restaurants where name = 'Federale''s Wicker Park'),
  0, 'another manager cannot');

-- ---------------------------------------------------------------------------
-- What is refused.
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$
  select public.add_restaurant('Ops Diner', null, null, '#475569', null)
$$, '42501', null, 'an ops manager cannot add a restaurant');

select pg_temp.login('admin@example.com');
select throws_ok($$
  select public.add_restaurant('Teal Twin', null, null, '#0e7490', null)
$$, '23505', null, 'a color already in use is refused, whatever its case');
select throws_ok($$
  select public.add_restaurant('Porter', null, null, '#475569', null)
$$, '23505', null, 'so is a name already in use');
select throws_ok(format($$
  select public.add_restaurant('Ops Run', null, null, '#475569', '%s')
$$, :bert), '22023', null, 'the manager has to be a manager');
select throws_ok($$
  select public.add_restaurant('   ', null, null, '#475569', null)
$$, '22023', null, 'a blank name is refused');
select throws_ok($$
  select public.add_restaurant('Bad Color', null, null, 'teal', null)
$$, '23514', null, 'a color that is not a hex code is refused');

select * from finish();
rollback;

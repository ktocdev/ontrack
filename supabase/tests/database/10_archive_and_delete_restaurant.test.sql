-- Archive and delete a restaurant (OT-9): admins only; an archived restaurant
-- takes nothing new and can be restored; only a restaurant with no history
-- that nobody calls home can be deleted; every change is logged.
begin;
select plan(14);

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

-- Seed ids (supabase/seed.sql): Porter has tickets and equipment.
\set porter '''11111111-1111-4111-8111-000000000003'''
\set category '''33333333-3333-4333-8333-000000000012'''

-- ---------------------------------------------------------------------------
-- Archive
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.set_restaurant_archived('%s', true) $$, :porter),
  '42501', null, 'ops cannot archive a restaurant');

select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.set_restaurant_archived('%s', true) $$, :porter),
  'an admin can archive one');
select lives_ok(format($$ select public.set_restaurant_archived('%s', true) $$, :porter),
  'archiving twice is harmless');

select pg_temp.logout();
select isnt((select archived_at from public.restaurants where id = (:porter)::uuid), null, 'it is marked archived');
select is(
  (select count(*)::int from public.audit_log where action = 'restaurant.archive' and target_restaurant_id = (:porter)::uuid),
  1, 'once in the audit log');
select is(
  (select count(*)::int from public.tickets where restaurant_id = (:porter)::uuid) > 0,
  true, 'its tickets are still there');
select throws_ok(format($$
  insert into public.equipment (restaurant_id, category_id, name) values ('%s', '%s', 'New fryer')
$$, :porter, :category), '42501', null, 'nothing new can be added at an archived restaurant');

select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.set_restaurant_archived('%s', false) $$, :porter), 'an admin can restore it');
select pg_temp.logout();
select lives_ok(format($$
  insert into public.equipment (restaurant_id, category_id, name) values ('%s', '%s', 'New fryer')
$$, :porter, :category), 'and it takes new equipment again');

-- ---------------------------------------------------------------------------
-- Delete
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select throws_ok(format($$ select public.delete_restaurant('%s') $$, :porter),
  '23503', null, 'a restaurant with history cannot be deleted');

-- An empty restaurant that is someone's home stays. (Set as the owner: only
-- an admin's User profile screen moves a home, which comes later.)
select pg_temp.login('admin@example.com');
select public.add_restaurant('Home Base', '1 Test St', null, '#5c6b1f');
select pg_temp.logout();
update public.profiles set home_restaurant_id = (select id from public.restaurants where name = 'Home Base')
  where email = 'ari.kim@example.com';
select pg_temp.login('admin@example.com');
select throws_ok($$ select public.delete_restaurant((select id from public.restaurants where name = 'Home Base')) $$,
  '23503', null, 'nor one that is someone''s home restaurant');

select lives_ok($$
  select public.delete_restaurant(public.add_restaurant('Typo Tavern', '1 Test St', null, '#475569'))
$$, 'a new, empty restaurant can be deleted');
select pg_temp.logout();
select is((select count(*)::int from public.restaurants where name = 'Typo Tavern'), 0, 'and it is gone');
select is(
  (select meta->>'name' from public.audit_log where action = 'restaurant.delete' order by id desc limit 1),
  'Typo Tavern', 'the log keeps its name');

select * from finish();
rollback;

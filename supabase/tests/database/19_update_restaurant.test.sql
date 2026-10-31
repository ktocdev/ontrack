-- Edit restaurant (OT-23): admins only, what changed is logged, nothing changed
-- logs nothing, and the name and color rules still hold.
begin;
select plan(15);

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
\set porter '''11111111-1111-4111-8111-000000000003'''

-- ---------------------------------------------------------------------------
-- An admin edits Porter.
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select lives_ok(format($$
  select public.update_restaurant('%s', '  Porter Tavern ', '1 New St, Chicago', '', '#0E7490')
$$, :porter), 'an admin can edit a restaurant');

select pg_temp.logout();
select is((select name from public.restaurants where id = (:porter)::uuid), 'Porter Tavern', 'the name is trimmed');
select is((select address from public.restaurants where id = (:porter)::uuid), '1 New St, Chicago', 'the address changes');
select is((select phone from public.restaurants where id = (:porter)::uuid), null, 'a blank phone is stored as none');
select is((select color from public.restaurants where id = (:porter)::uuid), '#0e7490', 'the color is stored lower case');
select is(
  (select meta -> 'name' from public.audit_log where action = 'restaurant.update' and target_restaurant_id = (:porter)::uuid
     and actor_id = (select id from auth.users where email = 'admin@example.com')),
  '{"from": "Porter", "to": "Porter Tavern"}'::jsonb,
  'the edit is logged with its author, from and to');

-- ---------------------------------------------------------------------------
-- Saving the same values writes nothing.
-- ---------------------------------------------------------------------------
select pg_temp.login('admin@example.com');
select lives_ok(format($$
  select public.update_restaurant('%s', 'Porter Tavern', '1 New St, Chicago', null, '#0E7490')
$$, :porter), 'its own name and color are not a conflict, whatever the case');
select pg_temp.logout();
select is(
  (select count(*)::int from public.audit_log where action = 'restaurant.update' and target_restaurant_id = (:porter)::uuid),
  1, 'and saving with nothing changed logs nothing');

-- ---------------------------------------------------------------------------
-- What is refused.
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$
  select public.update_restaurant('%s', 'Ops Diner', null, null, '#475569')
$$, :porter), '42501', null, 'an ops manager cannot edit a restaurant');

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$
  select public.update_restaurant('11111111-1111-4111-8111-000000000001', 'Maya''s', null, null, '#475569')
$$, '42501', null, 'nor can the restaurant''s own manager');

select pg_temp.login('admin@example.com');
select throws_ok(format($$
  select public.update_restaurant('%s', 'Porter Tavern', null, null, '#a3336d')
$$, :porter), '23505', null, 'a color another restaurant uses is refused, whatever its case');
select throws_ok(format($$
  select public.update_restaurant('%s', 'Federale’s West Loop', null, null, '#0e7490')
$$, :porter), '23505', null, 'so is a name another restaurant uses');
select throws_ok(format($$
  select public.update_restaurant('%s', '   ', null, null, '#0e7490')
$$, :porter), '22023', null, 'a blank name is refused');
select throws_ok(format($$
  select public.update_restaurant('%s', 'Porter Tavern', null, null, 'teal')
$$, :porter), '23514', null, 'a color that is not a hex code is refused');
select throws_ok($$
  select public.update_restaurant('11111111-1111-4111-8111-00000000dead', 'Nobody', null, null, '#475569')
$$, 'P0002', null, 'a restaurant that does not exist is refused');

select * from finish();
rollback;

-- Equipment: visible within scope; added only with edit_equipment at that
-- restaurant. Maya has it by override, Ari does not, ops has it everywhere.
begin;
select plan(9);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.login('ari.kim@example.com');
select is(
  (select count(distinct restaurant_id)::int from public.equipment),
  1, 'manager sees one restaurant''s equipment');
select throws_ok($$
  insert into public.equipment (restaurant_id, category_id, name, created_by)
  values ('11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000012', 'Test: reach-in', '22222222-2222-4222-8222-000000000002')
$$, '42501', null, 'manager without edit_equipment cannot add a unit');
select is(
  (select count(*)::int from public.categories), 16, 'but reads the shared categories');
select pg_temp.logout();

select pg_temp.login('maya.reyes@example.com');
select lives_ok($$
  insert into public.equipment (restaurant_id, category_id, name, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Test: reach-in', '22222222-2222-4222-8222-000000000001')
$$, 'manager granted edit_equipment can add a unit at her restaurant');
select throws_ok($$
  insert into public.equipment (restaurant_id, category_id, name, created_by)
  values ('11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000012', 'Test: elsewhere', '22222222-2222-4222-8222-000000000001')
$$, '42501', null, 'but not at another restaurant');
select lives_ok($$
  update public.equipment set retired_at = now() where name = 'Test: reach-in'
$$, 'and can retire it');
select pg_temp.logout();

select pg_temp.login('bert.velilla@example.com');
select is(
  (select count(distinct restaurant_id)::int from public.equipment), 4, 'ops sees every restaurant''s equipment');
select lives_ok($$
  insert into public.equipment (restaurant_id, category_id, name, created_by)
  values ('11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000011', 'Test: fryer 3', '22222222-2222-4222-8222-000000000003')
$$, 'ops can add a unit anywhere');
select pg_temp.logout();

select pg_temp.login('lee.chen@example.com');
select throws_ok($$
  insert into public.equipment (restaurant_id, category_id, name, created_by)
  values ('11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000011', 'Test: nope', '22222222-2222-4222-8222-000000000005')
$$, '42501', null, 'leadership cannot add equipment');
select pg_temp.logout();

select * from finish();
rollback;

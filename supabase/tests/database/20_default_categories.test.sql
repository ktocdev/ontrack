-- The categories come from a migration, not the seed (OT-25), so a hosted project
-- has them. The seed no longer inserts any, so these counts prove the migration.
begin;
select plan(6);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select is((select count(*)::int from public.categories where area = 'foh'), 8, 'eight for the front of house');
select is((select count(*)::int from public.categories where area = 'boh'), 8, 'eight for the back of house');
select is((select sort_order from public.categories where area = 'foh' and name = 'Retractable roofs & windows'), 8,
  'Retractable roofs & windows is last in the front of house (OT-91)');
select is((select count(*)::int from public.categories where name = 'POS & tech'), 0,
  'and POS & tech, which nothing used here, is gone');

select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.categories), 16, 'a manager can read them all');
select throws_ok($$
  insert into public.categories (name, area) values ('Patio', 'foh')
$$, '42501', null, 'but one without edit_equipment cannot add one');

select * from finish();
rollback;

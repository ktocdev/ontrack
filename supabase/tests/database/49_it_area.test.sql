-- OT-115: IT is an area of its own. Its categories work as the others do: Ops adds one, a
-- manager files a ticket under one, a unit sits in one, and the names are unique per area.
begin;
select plan(7);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select is(enum_range(null::public.area)::text[], array['foh', 'boh', 'it'], 'three areas, IT last');

-- Ops looks after IT's categories as any other's
select pg_temp.login('bert.velilla@example.com');
select lives_ok($$ select public.add_category('Network & Wi-Fi', 'it') $$, 'Ops adds one to IT');
select throws_ok($$ select public.add_category('website', 'it') $$, '23505', null, 'a name IT already has is taken');
select lives_ok($$ select public.add_category('Website', 'foh') $$, 'but another area may use it');

-- A manager reports an IT problem; the seed's POS terminal is in IT
select pg_temp.login('maya.reyes@example.com');
select lives_ok($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values ('11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000021',
          'Card reader offline at host stand', '22222222-2222-4222-8222-000000000001')
$$, 'a manager files a ticket under POS & network');
select is((select c.area::text from public.tickets t join public.categories c on c.id = t.category_id
           where t.title = 'Card reader offline at host stand'), 'it', 'and it is an IT ticket');

select pg_temp.login('bert.velilla@example.com');
select is((select c.area::text from public.equipment e join public.categories c on c.id = e.category_id
           where e.id = '44444444-4444-4444-8444-000000000027'), 'it', 'the seed''s POS terminal is in IT');

select * from finish();
rollback;

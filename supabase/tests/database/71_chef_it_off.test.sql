-- OT-177: Chef starts with Front of House and IT off, and someone given the title takes both.
begin;
select plan(4);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

\set chef '''eeeeeeee-eeee-4eee-8eee-000000000002'''
\set dana '''22222222-2222-4222-8222-000000000007'''
\set porter '''11111111-1111-4111-8111-000000000003'''

select is(
  (select array_agg(area::text || ':' || notify::text || ':' || shown::text order by area)
   from public.job_title_areas where job_title_id = :chef),
  array['foh:off:false', 'it:off:false'],
  'Chef starts with Front of House and IT off and hidden');
select is(
  (select count(*)::int from public.job_title_areas where job_title_id = :chef and area = 'boh'),
  0, 'and Back of House on, so nothing is stored for it');

-- Dana is given Chef and takes its view as her own.
select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.set_person_access(%L, 'manager', array[%L]::uuid[], %L) $$, :dana, :porter, :chef),
  'an admin gives Dana the title');
select pg_temp.login('dana.ortiz@example.com');
select is(
  (select array_agg(area::text || ':' || notify::text || ':' || shown::text order by area) from public.area_prefs),
  array['foh:off:false', 'it:off:false'],
  'Dana starts with Front of House and IT off');

select * from finish();
rollback;

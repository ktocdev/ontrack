-- The group's name is one row anyone can read and nobody can write through the
-- API. The role defaults come with the schema, so a deployment with no seed
-- still answers can() correctly.
begin;
select plan(8);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select is((select count(*)::int from public.group_settings), 1, 'one row');
select throws_ok(
  $$ insert into public.group_settings (id, name) values (false, 'Second') $$,
  '23514', null, 'and there can only ever be one');
select throws_ok(
  $$ insert into public.group_settings default values $$,
  '23505', null, 'not even a second default one');

set local role anon;
select is((select name from public.group_settings), 'Four Corners', 'readable before sign-in');
select is((select short_name from public.group_settings), '4C', 'short name too');
select pg_temp.logout();

select pg_temp.login('admin@example.com');
update public.group_settings set name = 'Renamed';
select pg_temp.logout();
select is((select name from public.group_settings), 'Four Corners', 'not writable through the API, even by an admin');

select is(
  (select count(*)::int from public.rights where user_id is null),
  40, 'every role has a default for every right');
select pg_temp.login('admin@example.com');
select ok(public.can('invite_users'), 'an admin may invite');

select * from finish();
rollback;

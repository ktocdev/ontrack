-- OT-114: the roles' names are the group's. Only an admin renames them, always logged, and
-- the table keeps the shape the app reads: the four roles, each a name and a short name.
begin;
select plan(16);

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

select is((select role_names from public.group_settings), '{}'::jsonb, 'no names stored, so the app''s defaults show');

-- Who may
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.save_role_names('{"manager": {"name": "Boss", "short": "B"}}') $$,
  '42501', null, 'a manager cannot rename the roles');
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.save_role_names('{"ops": {"name": "Boss", "short": "B"}}') $$,
  '42501', null, 'nor can Ops');
update public.group_settings set role_names = '{"ops": {"name": "Boss", "short": "B"}}';
select pg_temp.logout();
select is((select role_names from public.group_settings), '{}'::jsonb,
  'and nobody writes the column through the API');

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.save_role_names(
  '{"manager": {"name": "  Reporter ", "short": " Rep "}, "ops": {"name": "Support Team", "short": "Support"}}') $$,
  'an admin can');
select pg_temp.logout();
select is((select role_names from public.group_settings),
  '{"manager": {"name": "Reporter", "short": "Rep"}, "ops": {"name": "Support Team", "short": "Support"}}'::jsonb,
  'trimmed, and the roles left out keep their defaults');
select is((select meta -> 'to' -> 'ops' ->> 'name' from public.audit_log where action = 'group.role_names' and created_at = now()),
  'Support Team', 'logged with what it became');
select is((select meta -> 'from' from public.audit_log where action = 'group.role_names' and created_at = now()),
  '{}'::jsonb, 'and what it was');

-- The shape
select pg_temp.login('admin@example.com');
select throws_ok($$ select public.save_role_names('{"chef": {"name": "Chef", "short": "Chef"}}') $$,
  '23514', null, 'only the four roles');
select throws_ok($$ select public.save_role_names('{"manager": {"name": "   ", "short": "R"}}') $$,
  '23514', null, 'not a blank name');
select throws_ok($$ select public.save_role_names('{"manager": {"name": "Reporter"}}') $$,
  '23514', null, 'not without a short name');
select throws_ok($$ select public.save_role_names('{"manager": {"name": "Reporter", "short": "Reporters"}}') $$,
  '23514', null, 'a short name fits the grid, 8 at most');
select throws_ok($$ select public.save_role_names(
  '{"manager": {"name": "A name far longer than thirty characters", "short": "R"}}') $$,
  '23514', null, 'a name is 30 at most');
select throws_ok($$ select public.save_role_names('["manager"]') $$, '22023', null, 'an object, nothing else');

-- Back to the defaults
select lives_ok($$ select public.save_role_names('{}') $$, 'an empty set puts every default back');
select pg_temp.logout();
select is((select role_names from public.group_settings), '{}'::jsonb, 'so nothing is stored');

select * from finish();
rollback;

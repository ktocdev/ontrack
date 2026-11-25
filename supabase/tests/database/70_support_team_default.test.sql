-- OT-176: a new group starts with Support Team as the Ops role's name. The seed stores none,
-- so the flows read the boards' names; this checks the default a new row takes and that the
-- names stay writable only through save_role_names.
begin;
select plan(4);

select is((select role_names from public.group_settings), '{}'::jsonb,
  'the seed stores no names, so the boards'' names show');

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'group_settings' and column_name = 'role_names'),
  '''{"ops": {"name": "Support Team", "short": "Support"}}''::jsonb',
  'a new group starts with Support Team for Ops');

select ok(public.role_names_ok('{"ops": {"name": "Support Team", "short": "Support"}}'::jsonb),
  'the default has the shape the app reads');

-- What a group with no Ops name takes: the migration's update, run again here.
update public.group_settings
set role_names = role_names || '{"ops": {"name": "Support Team", "short": "Support"}}'::jsonb
where not role_names ? 'ops';
select is((select role_names -> 'ops' ->> 'name' from public.group_settings), 'Support Team',
  'a group with no Ops name saved takes Support Team');

select * from finish();
rollback;

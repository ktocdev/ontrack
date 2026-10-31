-- Signed-out visitors run no database functions. A function they truly need goes in
-- this allow-list, on purpose, with the reason beside it. It is empty today.
begin;
select plan(3);

select is(
  array(
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and p.oid::regprocedure::text <> all (array[]::text[])
    order by 1
  ),
  array[]::text[],
  'anon can execute nothing in public outside the allow-list');

select ok(has_function_privilege('authenticated', 'public.can(text, uuid)', 'execute'),
  'signed-in people keep can()');

set local role anon;
select is((select count(*)::int from public.group_settings), 1, 'and anon can still read the group name');

select * from finish();
rollback;

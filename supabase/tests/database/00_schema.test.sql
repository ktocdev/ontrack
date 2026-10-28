-- Schema shape: every table exists, every table has RLS on, the permission
-- functions exist. Runs with `supabase test db`.
begin;
select plan(27);

select has_table('public', t, 'table ' || t || ' exists')
from unnest(array[
  'restaurants', 'profiles', 'memberships', 'invites', 'rights', 'push_subscriptions', 'audit_log',
  'equipment', 'categories',
  'tickets', 'ticket_updates', 'ticket_photos',
  'contractors', 'service_records', 'service_line_items', 'invoices',
  'walkthrough_schedules', 'walkthrough_templates', 'walkthrough_items', 'walkthroughs',
  'walkthrough_checks', 'inhouse_fixes', 'quarterly_tasks'
]) as t;

-- Row-level security is on for every table in public, no exceptions.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every public table has row-level security enabled'
);

select has_function('public', 'can', array['text', 'uuid'], 'can(action, restaurant_id) exists');
select has_function('public', 'has_scope', array['uuid'], 'has_scope(restaurant_id) exists');

-- Every table except reference data has at least one policy.
select is(
  (select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)),
  0,
  'every public table has at least one policy'
);

select * from finish();
rollback;

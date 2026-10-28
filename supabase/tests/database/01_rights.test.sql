-- can() returns the Roles & rights grid for each role's default, and a
-- per-person override wins over the role default.
begin;
select plan(26);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Manager (Ari, no overrides)
select pg_temp.login('ari.kim@example.com');
select ok(public.can('create_tickets'), 'manager: create tickets');
select ok(not public.can('see_all_tickets'), 'manager: sees own tickets only');
select ok(not public.can('update_status'), 'manager: cannot update status');
select ok(not public.can('log_cost'), 'manager: cannot log cost');
select ok(not public.can('see_costs'), 'manager: cannot see costs');
select ok(not public.can('edit_equipment'), 'manager: cannot edit equipment');
select ok(not public.can('see_contractors'), 'manager: cannot see contractors');
select ok(not public.can('set_walkthrough_schedule'), 'manager: cannot set schedules');
select ok(not public.can('invite_users'), 'manager: cannot invite');
select ok(not public.can('manage_rights'), 'manager: cannot manage rights');
-- Scope: Ari is at Ranalli's only
select ok(public.can('create_tickets', '11111111-1111-4111-8111-000000000004'), 'manager: right applies at own restaurant');
select ok(not public.can('create_tickets', '11111111-1111-4111-8111-000000000001'), 'manager: right does not apply elsewhere');
select pg_temp.logout();

-- Manager with overrides (Maya: see_costs and edit_equipment granted)
select pg_temp.login('maya.reyes@example.com');
select ok(public.can('see_costs', '11111111-1111-4111-8111-000000000001'), 'override: Maya sees costs at her restaurant');
select ok(public.can('edit_equipment', '11111111-1111-4111-8111-000000000001'), 'override: Maya edits equipment at her restaurant');
select ok(not public.can('edit_equipment', '11111111-1111-4111-8111-000000000003'), 'override: still scoped to her restaurant');
select ok(not public.can('update_status'), 'override: other rights unchanged');
select pg_temp.logout();

-- Ops (Bert)
select pg_temp.login('bert.velilla@example.com');
select ok(public.can('update_status', '11111111-1111-4111-8111-000000000003'), 'ops: update status anywhere');
select ok(public.can('log_cost'), 'ops: log cost');
select ok(public.can('edit_equipment', '11111111-1111-4111-8111-000000000004'), 'ops: edit equipment anywhere');
select ok(not public.can('invite_users'), 'ops: cannot invite');
select ok(not public.can('manage_rights'), 'ops: cannot manage rights');
select pg_temp.logout();

-- Leadership (Lee)
select pg_temp.login('lee.chen@example.com');
select ok(public.can('see_costs') and public.can('see_contractors') and public.can('see_all_tickets'), 'leadership: read rights');
select ok(not public.can('create_tickets') and not public.can('update_status') and not public.can('edit_equipment'), 'leadership: no write rights');
select pg_temp.logout();

-- Admin
select pg_temp.login('admin@example.com');
select ok(public.can('invite_users') and public.can('manage_rights') and public.can('set_walkthrough_schedule'), 'admin: admin rights');
select ok(not public.can('create_tickets') and not public.can('update_status'), 'admin: tickets are read-only');
select pg_temp.logout();

-- Nobody signed in
select ok(not public.can('create_tickets'), 'anonymous: nothing');

select * from finish();
rollback;

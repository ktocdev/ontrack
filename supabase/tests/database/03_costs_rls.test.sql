-- Costs: see_costs decides whether service records, line items, invoices and
-- contractor names come back. Granting the right to a manager changes what
-- the database returns, with no app change (the Phase 1 done test).
begin;
select plan(12);

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

-- Maya has see_costs by override: she sees the cost on her closed ticket.
select pg_temp.login('maya.reyes@example.com');
select is(
  (select total_cents from public.v_ticket_costs where ticket_id = '66666666-6666-4666-8666-000000000988'),
  24500::bigint, 'manager with see_costs sees the $245.00 on OT-0988');
select is(
  (select name from public.contractors where id = '55555555-5555-4555-8555-000000000001'),
  'Coldline Refrigeration', 'and the contractor name');
select is(
  (select count(*)::int from public.service_records where ticket_id = '66666666-6666-4666-8666-000000001036'),
  0, 'but nothing from another restaurant');
select throws_ok($$
  insert into public.service_records (ticket_id, kind, title)
  values ('66666666-6666-4666-8666-000000000988', 'in_house', 'Test: manager logging')
$$, '42501', null, 'seeing costs does not allow logging them');
select pg_temp.logout();

-- Ari has no see_costs: cost views are empty for her.
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.service_records), 0, 'manager without see_costs sees no service records');
select is((select count(*)::int from public.invoices), 0, 'nor invoices');
select is((select count(*)::int from public.contractors), 0, 'nor contractors');
select is(
  (select count(*)::int from public.v_equipment_spend where equipment_id = '44444444-4444-4444-8444-000000000014'),
  0, 'nor spend on her own ice machine');
select pg_temp.logout();

-- An admin grants Ari see_costs in Roles & rights.
select pg_temp.login('admin@example.com');
select lives_ok($$
  insert into public.rights (user_id, key, allowed, updated_by)
  values ('22222222-2222-4222-8222-000000000002', 'see_costs', true, '22222222-2222-4222-8222-000000000006')
$$, 'admin can grant a per-person right');
select pg_temp.logout();

-- Now the same queries return rows for Ari, with no other change.
select pg_temp.login('ari.kim@example.com');
select is(
  (select total_cents from public.v_ticket_costs where ticket_id = '66666666-6666-4666-8666-000000001019'),
  16500::bigint, 'after the grant she sees the $165.00 on her restaurant''s ticket');
select is(
  (select count(*)::int from public.service_records where ticket_id = '66666666-6666-4666-8666-000000000988'),
  0, 'and still nothing from other restaurants');
select pg_temp.logout();

-- Ops may not touch rights.
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$
  insert into public.rights (user_id, key, allowed)
  values ('22222222-2222-4222-8222-000000000003', 'manage_rights', true)
$$, '42501', null, 'ops cannot grant rights');
select pg_temp.logout();

select * from finish();
rollback;

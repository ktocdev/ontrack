-- OT-90: service records have their own restaurant and an optional ticket, change only
-- through log_service, update_service_record and attach_invoice (each checked and
-- logged, none deletes), and feed the spend views.
begin;
select plan(53);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids: Logan Square (r1) has OT-1042 on Walk-in Cooler 1 and the Ice Machine;
-- Porter (r3) has OT-1044 and the Hood Exhaust Fan. Coldline is a contractor. Bert is
-- Ops (log_cost everywhere); Maya manages r1 with see_costs but not log_cost; Ari
-- manages Ranalli's with neither.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set r2 '''11111111-1111-4111-8111-000000000002'''
\set r3 '''11111111-1111-4111-8111-000000000003'''
\set cooler '''44444444-4444-4444-8444-000000000001'''
\set ice '''44444444-4444-4444-8444-000000000003'''
\set hood '''44444444-4444-4444-8444-000000000004'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1044 '''66666666-6666-4666-8666-000000001044'''
\set coldline '''55555555-5555-4555-8555-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set maya '''22222222-2222-4222-8222-000000000001'''

-- Every seeded record took its ticket's restaurant ---------------------------------------

select pg_temp.su();
select is(
  (select count(*)::int from public.service_records s join public.tickets t on t.id = s.ticket_id
   where s.restaurant_id <> t.restaurant_id), 0,
  'every existing record has its ticket''s restaurant');

-- Before: what the done test's numbers start from.
select coalesce((select total_cents from public.v_equipment_spend where equipment_id = (:cooler)::uuid and year = 2026), 0) as cooler_before,
       coalesce((select sum(total_cents) from public.v_contractor_spend where contractor_id = (:coldline)::uuid and year = 2026), 0) as coldline_before,
       coalesce((select total_cents from public.v_ticket_costs where ticket_id = (:t1042)::uuid), 0) as ticket_before
\gset

-- Logging on a ticket --------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.log_service(
  p_kind => 'contractor', p_service_date => '2026-11-03', p_ticket_id => (:t1042)::uuid,
  p_restaurant_id => (:r3)::uuid, p_equipment_id => (:hood)::uuid, p_contractor_id => (:coldline)::uuid,
  p_technician => ' Rosa Alvarez ', p_invoice_number => 'CL-20931', p_notes => 'Test: replaced fan motor',
  p_labor_cents => 12000, p_parts_cents => 21240, p_trip_cents => 6500) as rec
\gset

select results_eq(
  format('select restaurant_id, equipment_id, ticket_id, title, technician, logged_by from public.service_records where id = %L', :'rec'),
  format('values (%L::uuid, %L::uuid, %L::uuid, %L::text, %L::text, %L::uuid)',
    :r1, :cooler, :t1042, 'Walk-in cooler not holding temp', 'Rosa Alvarez', :bert),
  'a visit on a ticket takes the ticket''s restaurant, unit and title, whatever else was sent');
select is((select total_cents from public.v_service_record_totals where service_record_id = (:'rec')::uuid),
  39740::bigint, 'its labor, parts and trip fee come to $397.40');
select is((select count(*)::int from public.service_line_items where service_record_id = (:'rec')::uuid),
  3, 'one line item for each amount');
select results_eq(
  format('select number, amount_cents, status::text, path from public.invoices where service_record_id = %L', :'rec'),
  $$ values ('CL-20931'::text, 39740, 'missing'::text, null::text) $$,
  'a contractor''s visit gets an invoice row, Missing until a file is attached, for the total');
select is((select total_cents from public.v_equipment_spend where equipment_id = (:cooler)::uuid and year = 2026),
  (:cooler_before + 39740)::bigint, 'the unit''s 2026 cost rises by $397.40');
select is((select sum(total_cents) from public.v_contractor_spend where contractor_id = (:coldline)::uuid and year = 2026),
  (:coldline_before + 39740)::numeric, 'and Coldline''s spend');
select is((select total_cents from public.v_contractor_spend
           where contractor_id = (:coldline)::uuid and restaurant_id = (:r3)::uuid and year = 2026), null,
  'counted at the ticket''s restaurant, not the one sent');
select is((select total_cents from public.v_ticket_costs where ticket_id = (:t1042)::uuid),
  (:ticket_before + 39740)::bigint, 'and the ticket''s total, which the Closed tab sums');
select ok(exists (select 1 from public.v_missing_invoices where service_record_id = (:'rec')::uuid and restaurant_id = (:r1)::uuid),
  'it shows under Missing at its restaurant');
select ok((select invoices >= 1 and missing >= 1 and total_cents >= 39740 from public.v_invoices_by_month
           where restaurant_id = (:r1)::uuid and month = '2026-11-01'),
  'and in November''s invoices');

select pg_temp.su();
select results_eq(
  format($$ select actor_id, target_restaurant_id, (meta->>'labor_cents')::int from public.audit_log
            where action = 'service.log' and meta->>'service_record_id' = %L $$, :'rec'),
  format('values (%L::uuid, %L::uuid, 12000)', :bert, :r1),
  'logging is in the audit log, with who and where');

-- Logging with no ticket -----------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.log_service(
  p_kind => 'contractor', p_service_date => '2026-11-04', p_restaurant_id => (:r1)::uuid,
  p_equipment_id => (:ice)::uuid, p_contractor_id => (:coldline)::uuid, p_labor_cents => 15000) as pm
\gset

select results_eq(
  format('select restaurant_id, equipment_id, ticket_id, title from public.service_records where id = %L', :'pm'),
  format('values (%L::uuid, %L::uuid, null::uuid, %L::text)', :r1, :ice, 'Contractor visit'),
  'a visit with no ticket stays on the unit and restaurant it was logged on');
select is((select total_cents from public.v_equipment_lifetime where equipment_id = (:ice)::uuid) >= 15000, true,
  'it counts toward the unit''s cost');
select is((select count(*)::int from public.v_ticket_costs where ticket_id is null), 0,
  'and toward no ticket''s total');

select public.log_service(p_kind => 'in_house', p_restaurant_id => (:r1)::uuid, p_parts_cents => 1200) as ih
\gset
select results_eq(
  format('select equipment_id, title, (select count(*)::int from public.invoices where service_record_id = %1$L) from public.service_records where id = %1$L', :'ih'),
  $$ values (null::uuid, 'In-house work'::text, 0) $$,
  'in-house work on a restaurant needs no unit and gets no invoice row');

select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L, p_equipment_id => %L) $$, :r1, :hood),
  '23514', null, 'a unit with no ticket must be at the restaurant');
select pg_temp.su();
update public.equipment set retired_at = now() where id = (:ice)::uuid;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L, p_equipment_id => %L) $$, :r1, :ice),
  '23514', null, 'and not retired');
select throws_ok($$ select public.log_service(p_kind => 'in_house') $$,
  '42501', null, 'a visit names a ticket or a restaurant');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_ticket_id => %L) $$, gen_random_uuid()),
  '42501', null, 'and a ticket that doesn''t exist is refused like one out of reach');

-- What a visit must hold -----------------------------------------------------------------

select throws_ok(format($$ select public.log_service(p_kind => 'contractor', p_restaurant_id => %L) $$, :r1),
  '22023', null, 'a contractor''s visit names the contractor');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L, p_contractor_id => %L) $$, :r1, :coldline),
  '22023', null, 'in-house work names none');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L, p_labor_cents => -100) $$, :r1),
  '22023', null, 'an amount can''t be negative');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L, p_title => %L) $$, :r1, repeat('x', 201)),
  '23514', null, 'and a title has a length limit');
select pg_temp.su();
update public.contractors set archived_at = now() where id = '55555555-5555-4555-8555-000000000002';
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'contractor', p_restaurant_id => %L, p_contractor_id => '55555555-5555-4555-8555-000000000002') $$, :r1),
  '22023', null, 'an archived contractor takes no new visits');
select pg_temp.su();
update public.restaurants set archived_at = now() where id = (:r2)::uuid;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L) $$, :r2),
  '42501', null, 'and an archived restaurant none either');

-- Who may log ----------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_ticket_id => %L) $$, :t1042),
  '42501', null, 'seeing costs doesn''t allow logging them');
select ok(exists (select 1 from public.service_records where id = (:'pm')::uuid),
  'but a manager with see_costs reads a visit with no ticket at her restaurant');
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.service_records where id in ((:'rec')::uuid, (:'pm')::uuid)), 0,
  'a manager elsewhere reads neither');
select is((select count(*)::int from public.v_invoices_by_month), 0, 'nor any month''s invoices without see_costs');

-- No direct writes, no deletes -----------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ insert into public.service_records (ticket_id, kind, title) values (%L, 'in_house', 'Test: direct') $$, :t1042),
  '42501', null, 'Ops can''t insert a record directly, which would skip the log');
select throws_ok(format($$ insert into public.service_line_items (service_record_id, kind, amount_cents) values (%L, 'parts', 100) $$, :'rec'),
  '42501', null, 'nor a line item');
update public.service_line_items set amount_cents = 1 where service_record_id = (:'rec')::uuid;
update public.invoices set number = 'Test: changed' where service_record_id = (:'rec')::uuid;
delete from public.service_records where id = (:'rec')::uuid;
delete from public.invoices where service_record_id = (:'rec')::uuid;
select is((select total_cents from public.v_service_record_totals where service_record_id = (:'rec')::uuid), 39740::bigint,
  'nor change an amount');
select is((select number from public.invoices where service_record_id = (:'rec')::uuid), 'CL-20931',
  'or an invoice');
select is((select count(*)::int from public.service_records where id = (:'rec')::uuid), 1,
  'and a record is never deleted');

-- Correcting a visit ---------------------------------------------------------------------

select lives_ok(format($$ select public.update_service_record(%L, 'contractor', '2026-11-03',
    p_ticket_id => %L, p_contractor_id => %L, p_technician => 'Rosa Alvarez', p_title => 'Condenser fan motor replaced',
    p_invoice_number => 'CL-20932', p_labor_cents => 18000, p_parts_cents => 21740, p_trip_cents => 0) $$,
  :'rec', :t1042, :coldline), 'Ops corrects a visit');
select results_eq(
  format('select title, (select total_cents from public.v_service_record_totals where service_record_id = %1$L), (select number from public.invoices where service_record_id = %1$L), (select amount_cents from public.invoices where service_record_id = %1$L) from public.service_records where id = %1$L', :'rec'),
  $$ values ('Condenser fan motor replaced'::text, 39740::bigint, 'CL-20932'::text, 39740) $$,
  'the title, amounts and invoice number change, and the invoice keeps the total');
select is((select count(*)::int from public.service_line_items where service_record_id = (:'rec')::uuid and kind = 'trip'), 0,
  'an amount set to zero leaves no line item');
select pg_temp.su();
select results_eq(
  format($$ select (meta->'before'->>'labor_cents')::int, (meta->'after'->>'labor_cents')::int from public.audit_log
            where action = 'service.update' and meta->>'service_record_id' = %L $$, :'rec'),
  $$ values (12000, 18000) $$, 'the edit is logged with before and after');

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.update_service_record(%L, 'contractor', '2026-11-04',
    p_ticket_id => %L, p_contractor_id => %L, p_labor_cents => 15000) $$, :'pm', :t1044, :coldline),
  'a ticket can be added to a visit that had none');
select results_eq(
  format('select restaurant_id, equipment_id, ticket_id from public.service_records where id = %L', :'pm'),
  format('values (%L::uuid, (select equipment_id from public.tickets where id = %L), %L::uuid)', :r3, :t1044, :t1044),
  'and the visit moves to the ticket''s restaurant and unit');

-- A manager given log_cost at her own restaurant can't reach another.
select pg_temp.su();
insert into public.rights (user_id, key, allowed, updated_by) values ((:maya)::uuid, 'log_cost', true, (:bert)::uuid);
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'in_house', p_ticket_id => %L) $$, :t1044),
  '42501', null, 'log_cost at one restaurant doesn''t reach another');
select throws_ok(format($$ select public.update_service_record(%L, 'in_house', current_date, p_ticket_id => %L) $$, :'ih', :t1044),
  '42501', null, 'nor can a record be moved there');
select throws_ok(format($$ select public.update_service_record(%L, 'in_house', current_date, p_restaurant_id => %L) $$, :'pm', :r1),
  '42501', null, 'nor brought back from there');

-- The invoice file -----------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner_id) values ('invoices', '%s/Coldline_INV-58213.pdf', auth.uid()::text) $$, :'ih'),
  'Ops uploads an invoice for a visit with no ticket');
select throws_ok(format($$ select public.attach_invoice(%L, %L) $$, :'rec', :'ih' || '/Coldline_INV-58213.pdf'),
  '22023', null, 'a record can''t claim another record''s file');
select throws_ok(format($$ select public.attach_invoice(%L, %L) $$, :'rec', :'rec' || '/nothing.pdf'),
  '22023', null, 'or a file that was never uploaded');
insert into storage.objects (bucket_id, name, owner_id) values ('invoices', (:'rec') || '/Coldline_INV-58213.pdf', auth.uid()::text);
select lives_ok(format($$ select public.attach_invoice(%L, %L) $$, :'rec', :'rec' || '/Coldline_INV-58213.pdf'),
  'and attaches its own');
select results_eq(
  format('select status::text, attached_by from public.invoices where service_record_id = %L', :'rec'),
  format('values (%L::text, %L::uuid)', 'attached', :bert),
  'the invoice is attached, by whom');
select ok(not exists (select 1 from public.v_missing_invoices where service_record_id = (:'rec')::uuid),
  'and leaves Missing');

select pg_temp.login('maya.reyes@example.com');
select ok(exists (select 1 from storage.objects where bucket_id = 'invoices' and name = (:'rec') || '/Coldline_INV-58213.pdf'),
  'a manager with see_costs at the restaurant opens the file');
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'invoices' and name like (:'rec') || '/%'), 0,
  'one elsewhere can''t');

-- A restaurant with only a ticket-less visit still has history ---------------------------

select pg_temp.su();
update public.restaurants set archived_at = null where id = (:r2)::uuid;
insert into public.service_records (restaurant_id, kind, title) values ((:r2)::uuid, 'in_house', 'Test: only history');
select is((select service_records from public.v_restaurant_history where restaurant_id = (:r2)::uuid) >= 1, true,
  'a visit counts as a restaurant''s history');

select * from finish();
rollback;

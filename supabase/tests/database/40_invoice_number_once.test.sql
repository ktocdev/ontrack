-- OT-92: an invoice number is logged once per contractor.
begin;
select plan(7);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.detail() returns text language plpgsql as $$
declare d text;
begin
  perform public.log_service(p_kind => 'contractor', p_restaurant_id => '11111111-1111-4111-8111-000000000001',
    p_contractor_id => '55555555-5555-4555-8555-000000000001', p_invoice_number => 'INV-58213');
  return null;
exception when unique_violation then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $$;

-- Seed: INV-58213 is Coldline's, on OT-1042 (record …0001). Northstar is another contractor.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set coldline '''55555555-5555-4555-8555-000000000001'''
\set northstar '''55555555-5555-4555-8555-000000000002'''

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.log_service(p_kind => 'contractor', p_restaurant_id => %L,
  p_contractor_id => %L, p_invoice_number => ' inv-58213 ') $$, :r1, :coldline),
  '23505', 'this invoice number is already logged for this contractor',
  'the same contractor''s invoice number again is refused, whatever its case or spaces');

select is(pg_temp.detail(), '77777777-7777-4777-8777-000000000001', 'and the refusal names the visit that has it');

select lives_ok(format($$ select public.log_service(p_kind => 'contractor', p_restaurant_id => %L,
  p_contractor_id => %L, p_invoice_number => 'INV-58213') $$, :r1, :northstar),
  'another contractor may use the same number');
select lives_ok(format($$ select public.log_service(p_kind => 'in_house', p_restaurant_id => %L,
  p_invoice_number => 'INV-58213') $$, :r1),
  'and so may in-house work, which has no contractor');

-- An edit is checked too: moving the Northstar visit to Coldline, or renumbering it.
select public.log_service(p_kind => 'contractor', p_restaurant_id => :r1, p_contractor_id => :northstar,
  p_invoice_number => 'NS-9001') as ns
\gset
select throws_ok(format($$ select public.update_service_record(%L, 'contractor', current_date,
  p_restaurant_id => %L, p_contractor_id => %L, p_invoice_number => 'INV-58213') $$,
  (select service_record_id from public.invoices i join public.service_records s on s.id = i.service_record_id
   where i.number = 'INV-58213' and s.contractor_id = :northstar), :r1, :coldline),
  '23505', null, 'an edit can''t move a number onto a contractor who already has it');
select throws_ok(format($$ select public.update_service_record(%L, 'contractor', current_date,
  p_restaurant_id => %L, p_contractor_id => %L, p_invoice_number => 'INV-58213') $$, :'ns', :r1, :northstar),
  '23505', null, 'or renumber a visit to one the contractor already has');
select lives_ok(format($$ select public.update_service_record(%L, 'contractor', current_date,
  p_restaurant_id => %L, p_contractor_id => %L, p_invoice_number => 'NS-9001', p_labor_cents => 5000) $$, :'ns', :r1, :northstar),
  'and a visit keeping its own number saves');

select * from finish();
rollback;

-- OT-97: fixes from the Phase 5 security pass. An invoice file is added and never
-- changed or removed, and is read only with see_costs; a refused invoice number names
-- the other visit only to someone who can see it; a contractor's email is an address
-- and nothing more.
begin;
select plan(14);

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

-- What a refused save says in its detail: 'saved' if it went through, '' for no detail.
create function pg_temp.refusal_detail(p_sql text) returns text language plpgsql as $$
declare
  v_detail text;
begin
  execute p_sql;
  return 'saved';
exception when unique_violation then
  get stacked diagnostics v_detail = pg_exception_detail;
  return coalesce(v_detail, '');
end $$;

-- Seed ids: Logan Square (r1) and Porter (r3). The seed's visit on OT-1042 (rec1) is at
-- r1 with an invoice attached; Hobart's one visit (rec8) is at Porter, invoice H-20931.
-- Bert is Ops; Maya manages r1 with see_costs.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set rec1 '''77777777-7777-4777-8777-000000000001'''
\set rec8 '''77777777-7777-4777-8777-000000000008'''
\set hobart '''55555555-5555-4555-8555-000000000005'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set admin '''22222222-2222-4222-8222-000000000006'''
\set file '''77777777-7777-4777-8777-000000000001/Coldline_INV-58213.pdf'''

-- 1. An invoice file is added, never changed or removed ----------------------------------

-- The seed names the file on the invoice row; put the file itself there. Storage's own
-- guard on SQL deletes is switched off for this transaction, so only the policies decide.
select pg_temp.su();
insert into storage.objects (bucket_id, name) values ('invoices', :file);
select set_config('storage.allow_delete_query', 'true', true);

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('invoices', '%s/new/bill.pdf', auth.uid()::text)
$$, (:rec1)), 'Ops with log_cost uploads a file to a record''s folder');

update storage.objects set metadata = '{"changed": true}' where bucket_id = 'invoices' and name = :file;
delete from storage.objects where bucket_id = 'invoices' and name = :file;

select pg_temp.su();
select is((select count(*)::int from storage.objects where bucket_id = 'invoices' and name = :file),
  1, 'an invoice file can''t be removed through Storage, even with log_cost');
select is((select metadata from storage.objects where bucket_id = 'invoices' and name = :file),
  null, 'or overwritten or moved');
select is((select count(*)::int from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'invoices:%'
             and cmd not in ('SELECT', 'INSERT')),
  0, 'the invoices bucket has rules for reading and adding only');

select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'invoices' and name like (:rec1) || '/%'),
  2, 'with see_costs both files are read');

-- log_cost with see_costs switched off: adds files, reads none.
select pg_temp.su();
insert into public.rights (user_id, key, allowed, updated_by) values ((:bert)::uuid, 'see_costs', false, (:admin)::uuid);
select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from storage.objects where bucket_id = 'invoices'),
  0, 'log_cost without see_costs reads no invoice file');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id) values ('invoices', '%s/blind/bill.pdf', auth.uid()::text)
$$, (:rec1)), 'but still uploads one');
select pg_temp.su();
delete from public.rights where user_id = (:bert)::uuid and key = 'see_costs';

-- 2. A refused invoice number names the other visit only to someone who can see it -------

-- Maya is given log_cost, which a manager's override grants at her restaurant only.
insert into public.rights (user_id, key, allowed, updated_by) values ((:maya)::uuid, 'log_cost', true, (:admin)::uuid);

select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.service_records where id = (:rec8)::uuid),
  0, 'a manager at Logan Square can''t see Hobart''s visit at Porter');
select is(pg_temp.refusal_detail(format($$
  select public.log_service(p_kind => 'contractor', p_restaurant_id => %L, p_contractor_id => %L, p_invoice_number => 'h-20931')
$$, (:r1), (:hobart))), '', 'Hobart''s invoice number is still refused for her, without naming the visit that has it');

select pg_temp.login('bert.velilla@example.com');
select is(pg_temp.refusal_detail(format($$
  select public.log_service(p_kind => 'contractor', p_restaurant_id => %L, p_contractor_id => %L, p_invoice_number => 'h-20931')
$$, (:r1), (:hobart))), (:rec8), 'Ops, who sees costs at Porter, is told which visit has it');

-- 3. A contractor's email is an address and nothing more ---------------------------------

create function pg_temp.save_hobart_email(p_email text) returns uuid language sql as $$
  select public.save_contractor(
    '55555555-5555-4555-8555-000000000005', 'Hobart Service',
    array(select trade_id from public.contractor_trades where contractor_id = '55555555-5555-4555-8555-000000000005'),
    p_phone => '(800) 555-0199', p_email => p_email);
$$;

select throws_ok($$ select pg_temp.save_hobart_email('a@b.co?cc=x%40y.z') $$, '23514', null,
  'an email that would add a CC to the Email button is refused');
select throws_ok($$ select pg_temp.save_hobart_email('a@b.co?subject=hi&body=pay') $$, '23514', null,
  'and one that would fill in the subject and body');
select throws_ok($$ select pg_temp.save_hobart_email('a@b.co,x%40y.z') $$, '23514', null,
  'and one that would add a second recipient');
select lives_ok($$ select pg_temp.save_hobart_email('o''brien+ap@service.hobart.example.co.uk') $$,
  'an ordinary address, with an apostrophe, a plus and subdomains, is saved');

select * from finish();
rollback;

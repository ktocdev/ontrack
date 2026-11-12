-- OT-91: contractors change only through save_contractor, set_contractor_archived and
-- delete_contractor, by Ops with log_cost or an admin, each logged; trades come from the
-- list (OT-99; 41_trades has the rest); delete only while no service record names them.
begin;
select plan(37);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- The ids of trades by name, as save_contractor takes them.
create function pg_temp.trades(variadic p_names text[]) returns uuid[] language sql as $$
  select array(select id from public.trades where name = any (p_names) order by sort_order)
$$;
-- A contractor's trades by name, in the list's order.
create function pg_temp.trades_of(p_id uuid) returns text[] language sql as $$
  select array(select t.name from public.contractor_trades ct join public.trades t on t.id = ct.trade_id
               where ct.contractor_id = p_id order by t.sort_order)
$$;
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids: Coldline has visits on record. Bert is Ops; Maya manages Logan Square; Lee
-- is leadership; Ari manages Ranalli's with no see_costs or see_contractors.
\set coldline '''55555555-5555-4555-8555-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set r1 '''11111111-1111-4111-8111-000000000001'''

-- The trade list ---------------------------------------------------------------------------

select is((select count(*)::int from public.trades where active), 15, 'fifteen trades');
select is((select name from public.trades order by sort_order desc limit 1), 'Other', 'with Other last');
select is((select count(*)::int from public.contractors c where cardinality(pg_temp.trades_of(c.id)) <> 1), 0,
  'every seeded contractor has one trade');

-- Adding ------------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.save_contractor(null, ' Test Roofing Co ', pg_temp.trades('Roofing'), p_contact_name => 'Sam Lee',
  p_phone => '(312) 555-0100', p_email => 'sam@example.com', p_preferred => true) as added
\gset
select results_eq(
  format('select name, pg_temp.trades_of(id), contact_name, preferred, created_by from public.contractors where id = %L', :'added'),
  format('values (%L::text, %L::text[], %L::text, true, %L::uuid)', 'Test Roofing Co', '{Roofing}', 'Sam Lee', :bert),
  'Ops adds a contractor, trimmed, as themselves');
select pg_temp.su();
select is((select actor_id from public.audit_log where action = 'contractor.add' and meta->>'contractor_id' = :'added'),
  (:bert)::uuid, 'and it is logged');

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.save_contractor(null, 'coldline refrigeration', pg_temp.trades('Refrigeration')) $$,
  '23505', null, 'a name already in the directory is refused, whatever its case');
select throws_ok($$ select public.save_contractor(null, 'Test: no trade', array[gen_random_uuid()]) $$,
  '22023', null, 'a trade off the list is refused');
select throws_ok($$ select public.save_contractor(null, '  ', pg_temp.trades('Other')) $$,
  '23514', null, 'a name is required');
select throws_ok(format($$ select public.save_contractor(null, %L, pg_temp.trades('Other')) $$, repeat('x', 121)),
  '23514', null, 'and has a length limit');
select throws_ok($$ select public.save_contractor(null, 'Test: bad email', pg_temp.trades('Other'), p_email => 'not an email') $$,
  '23514', null, 'an email must look like one');

-- Editing -----------------------------------------------------------------------------------

select lives_ok(format($$ select public.save_contractor(%L, 'Test Roofing Co', pg_temp.trades('General repair'),
  p_phone => '(312) 555-0101', p_notes => 'Test: gutters too') $$, :'added'), 'Ops edits a contractor');
select results_eq(
  format('select pg_temp.trades_of(id), phone, contact_name, preferred from public.contractors where id = %L', :'added'),
  $$ values ('{General repair}'::text[], '(312) 555-0101'::text, null::text, false) $$,
  'every field is as the form holds it');
select pg_temp.su();
select results_eq(
  format($$ select meta->'before'->'trades', meta->'after'->'trades' from public.audit_log
            where action = 'contractor.update' and meta->>'contractor_id' = %L $$, :'added'),
  $$ values ('["Roofing"]'::jsonb, '["General repair"]'::jsonb) $$, 'the edit is logged with before and after');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ select public.save_contractor(%L, 'Test', pg_temp.trades('Other')) $$, gen_random_uuid()),
  'P0002', null, 'editing a contractor that doesn''t exist says so');

-- Who may -----------------------------------------------------------------------------------

select pg_temp.su();
insert into public.rights (user_id, key, allowed, updated_by) values ((:maya)::uuid, 'log_cost', true, (:bert)::uuid);
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.save_contractor(null, 'Test: by a manager', pg_temp.trades('Other')) $$,
  '42501', null, 'a manager with log_cost at her restaurant can''t change the group''s contractors');
select throws_ok(format($$ select public.set_contractor_archived(%L, true) $$, :coldline),
  '42501', null, 'or archive one');
select pg_temp.login('lee.chen@example.com');
select throws_ok($$ select public.save_contractor(null, 'Test: by leadership', pg_temp.trades('Other')) $$,
  '42501', null, 'leadership reads contractors and changes none');
select pg_temp.login('admin@example.com');
select lives_ok($$ select public.save_contractor(null, 'Test: by an admin', pg_temp.trades('Other')) $$, 'an admin can add one');

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ insert into public.contractors (name) values ('Test: direct') $$,
  '42501', null, 'nobody inserts a contractor directly, which would skip the log');
update public.contractors set name = 'Test: renamed directly' where id = (:coldline)::uuid;
delete from public.contractors where id = (:'added')::uuid;
select pg_temp.su();
select is((select name from public.contractors where id = (:coldline)::uuid), 'Coldline Refrigeration',
  'or renames one');
select is((select count(*)::int from public.contractors where id = (:'added')::uuid), 1, 'or deletes one');

-- Archive and restore -----------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.set_contractor_archived(%L, true) $$, :coldline), 'Ops archives a contractor');
select isnt((select archived_at from public.contractors where id = (:coldline)::uuid), null,
  'who stays readable, with their visits');
select throws_ok(format($$ select public.log_service(p_kind => 'contractor', p_restaurant_id => %L, p_contractor_id => %L) $$, :r1, :coldline),
  '22023', null, 'and takes no new visits');
select lives_ok($$ select public.save_contractor(null, 'Coldline Refrigeration', pg_temp.trades('Refrigeration')) $$,
  'an archived contractor''s name is free again');
select throws_ok(format($$ select public.set_contractor_archived(%L, false) $$, :coldline),
  '23505', null, 'so restoring them while the name is taken is refused');
select public.set_contractor_archived(id, true) from public.contractors where name = 'Coldline Refrigeration' and archived_at is null;
select lives_ok(format($$ select public.set_contractor_archived(%L, false) $$, :coldline), 'and works once it is free');
select is((select archived_at from public.contractors where id = (:coldline)::uuid), null, 'restored');
select pg_temp.su();
select is((select count(*)::int from public.audit_log where meta->>'contractor_id' = :coldline
           and action in ('contractor.archive', 'contractor.restore')), 2, 'archive and restore are logged');

-- Delete ------------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select results_eq(
  format('select contractor_id, in_use from public.v_contractor_history where contractor_id in (%L, %L) order by in_use', :coldline, :'added'),
  format('values (%L::uuid, false), (%L::uuid, true)', :'added', :coldline),
  'the history view says who has visits');
select throws_ok(format($$ select public.delete_contractor(%L) $$, :coldline),
  '23503', null, 'a contractor with visits can''t be deleted');
select lives_ok(format($$ select public.delete_contractor(%L) $$, :'added'), 'one with none can');
select is((select count(*)::int from public.contractors where id = (:'added')::uuid), 0, 'and is gone');
select pg_temp.su();
select is((select meta->>'name' from public.audit_log where action = 'contractor.delete' and meta->>'contractor_id' = :'added'),
  'Test Roofing Co', 'with its name kept in the log');
select throws_ok(format($$ delete from public.contractors where id = %L $$, :coldline),
  '23503', null, 'even the service role can''t delete a contractor with visits');

select pg_temp.login('lee.chen@example.com');
select is((select in_use from public.v_contractor_history where contractor_id = (:coldline)::uuid), true,
  'leadership sees the directory''s history too');
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.v_contractor_history), 0, 'a manager without see_contractors sees none of it');

select * from finish();
rollback;

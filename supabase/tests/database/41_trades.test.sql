-- OT-99: a contractor has one or more trades, and the trade list changes only through
-- add_trade, rename_trade, set_trade_active and delete_trade, by Ops with log_cost or an
-- admin, each logged. A turned-off trade is given to nobody new, and a contractor who
-- has it keeps it; delete only while no contractor has it.
begin;
select plan(40);

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
create function pg_temp.trades(variadic p_names text[]) returns uuid[] language sql as $$
  select array(select id from public.trades where name = any (p_names) order by sort_order)
$$;
create function pg_temp.trades_of(p_id uuid) returns text[] language sql as $$
  select array(select t.name from public.contractor_trades ct join public.trades t on t.id = ct.trade_id
               where ct.contractor_id = p_id order by t.sort_order)
$$;

\set bert '''22222222-2222-4222-8222-000000000003'''
\set maya '''22222222-2222-4222-8222-000000000001'''

-- Adding ------------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.add_trade(' Pest control ') as pest
\gset
select is((select name from public.trades where id = (:'pest')::uuid), 'Pest control', 'Ops adds a trade, trimmed');
select results_eq(
  $$ select name from public.trades order by sort_order desc limit 2 $$,
  $$ values ('Other'::text), ('Pest control'::text) $$,
  'it goes just before Other, which stays last');
select throws_ok($$ select public.add_trade('PEST CONTROL') $$, '23505', null, 'a name on the list is refused, whatever its case');
select throws_ok($$ select public.add_trade('  ') $$, '23514', null, 'a name is required');
select throws_ok(format($$ select public.add_trade(%L) $$, repeat('x', 61)), '23514', null, 'and has a length limit');
select pg_temp.su();
select is((select actor_id from public.audit_log where action = 'trade.add' and meta->>'trade_id' = :'pest'),
  (:bert)::uuid, 'adding is logged');

-- Who may -----------------------------------------------------------------------------------

insert into public.rights (user_id, key, allowed, updated_by) values ((:maya)::uuid, 'log_cost', true, (:bert)::uuid);
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ select public.add_trade('Test: by a manager') $$, '42501', null,
  'a manager with log_cost at her restaurant can''t change the group''s trades');
select throws_ok(format($$ select public.set_trade_active(%L, false) $$, :'pest'), '42501', null, 'or turn one off');
select pg_temp.login('lee.chen@example.com');
select throws_ok($$ select public.add_trade('Test: by leadership') $$, '42501', null, 'leadership changes no trades');
select ok((select count(*) from public.trades) >= 16, 'and reads them all');
select pg_temp.login('ari.kim@example.com');
select is((select count(*)::int from public.trades), 0, 'a manager who can''t see contractors reads no trades');
select is((select count(*)::int from public.contractor_trades), 0, 'or who has them');
select pg_temp.login('admin@example.com');
select lives_ok($$ select public.add_trade('Test: by an admin') $$, 'an admin can add one');

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ insert into public.trades (name, sort_order) values ('Test: direct', 99) $$,
  '42501', null, 'nobody inserts a trade directly, which would skip the log');
select throws_ok(format($$ insert into public.contractor_trades (contractor_id, trade_id)
                           select id, %L from public.contractors limit 1 $$, :'pest'),
  '42501', null, 'or gives a contractor a trade directly');
update public.trades set name = 'Test: renamed directly' where id = (:'pest')::uuid;
delete from public.contractor_trades;
select pg_temp.su();
select is((select name from public.trades where id = (:'pest')::uuid), 'Pest control', 'or renames one');
select is((select count(*)::int from public.contractor_trades), 12, 'or takes one away');

-- A contractor with several trades ----------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.save_contractor(null, 'Test Multi Co', pg_temp.trades('HVAC', 'Refrigeration', 'Pest control')) as multi
\gset
select is(pg_temp.trades_of((:'multi')::uuid), array['Refrigeration', 'HVAC', 'Pest control'],
  'a contractor can have several trades, shown in the list''s order');
select lives_ok(format($$ select public.save_contractor(%L, 'Test Multi Co',
  pg_temp.trades('HVAC', 'Refrigeration', 'Pest control') || pg_temp.trades('HVAC')) $$, :'multi'),
  'a trade named twice');
select is((select count(*)::int from public.contractor_trades where contractor_id = (:'multi')::uuid), 3, 'counts once');
select throws_ok($$ select public.save_contractor(null, 'Test: none', '{}'::uuid[]) $$,
  '22023', null, 'a contractor needs at least one trade');
select throws_ok($$ select public.save_contractor(null, 'Test: null', null) $$, '22023', null, 'null is none');

-- Renaming ----------------------------------------------------------------------------------

select lives_ok(format($$ select public.rename_trade(%L, 'Pest & wildlife') $$, :'pest'), 'Ops renames a trade');
select is(pg_temp.trades_of((:'multi')::uuid), array['Refrigeration', 'HVAC', 'Pest & wildlife'],
  'which every contractor with it shows');
select throws_ok(format($$ select public.rename_trade(%L, 'hvac') $$, :'pest'), '23505', null,
  'a name already on the list is refused');

-- Turning off and on ------------------------------------------------------------------------

select lives_ok(format($$ select public.set_trade_active(%L, false) $$, :'pest'), 'Ops turns a trade off');
select throws_ok($$ select public.save_contractor(null, 'Test: new with it', pg_temp.trades('Pest & wildlife')) $$,
  '23514', null, 'nobody new takes it');
select lives_ok(format($$ select public.save_contractor(%L, 'Test Multi Co', pg_temp.trades('Refrigeration', 'HVAC', 'Pest & wildlife')) $$, :'multi'),
  'a contractor who has it can be edited and keeps it');
select lives_ok(format($$ select public.save_contractor(%L, 'Test Multi Co', pg_temp.trades('Refrigeration')) $$, :'multi'),
  'or let it go');
select is(pg_temp.trades_of((:'multi')::uuid), array['Refrigeration'], 'and the trades are as the form holds them');
select throws_ok(format($$ select public.save_contractor(%L, 'Test Multi Co', pg_temp.trades('Refrigeration', 'Pest & wildlife')) $$, :'multi'),
  '23514', null, 'but can''t take it back while it is off');
select lives_ok(format($$ select public.set_trade_active(%L, true) $$, :'pest'), 'and turns it on again');
select pg_temp.su();
select results_eq(
  format($$ select action from public.audit_log where meta->>'trade_id' = %L and action like 'trade.%%' order by created_at, id $$, :'pest'),
  $$ values ('trade.add'::text), ('trade.rename'::text), ('trade.turn_off'::text), ('trade.turn_on'::text) $$,
  'every change to a trade is logged');

-- Deleting ----------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select results_eq(
  format($$ select t.name, h.in_use from public.v_trade_history h join public.trades t on t.id = h.trade_id
            where t.name in ('HVAC', 'Pest & wildlife') order by t.name $$),
  $$ values ('HVAC'::text, true), ('Pest & wildlife'::text, false) $$,
  'the history view says which trades a contractor has');
select throws_ok($$ select public.delete_trade((pg_temp.trades('HVAC'))[1]) $$, '23503', null,
  'a trade a contractor has can''t be deleted');
select lives_ok(format($$ select public.delete_trade(%L) $$, :'pest'), 'one nobody has can');
select is((select count(*)::int from public.trades where id = (:'pest')::uuid), 0, 'and is gone');
select pg_temp.su();
select is((select meta->>'name' from public.audit_log where action = 'trade.delete' and meta->>'trade_id' = :'pest'),
  'Pest & wildlife', 'with its name kept in the log');
select throws_ok($$ delete from public.trades where name = 'HVAC' $$, '23503', null,
  'even the service role can''t delete a trade a contractor has');

-- A contractor deleted takes their trades with them, named in the log.
select pg_temp.login('bert.velilla@example.com');
select public.delete_contractor((:'multi')::uuid);
select pg_temp.su();
select is((select meta->'trades' from public.audit_log where action = 'contractor.delete' and meta->>'contractor_id' = :'multi'),
  '["Refrigeration"]'::jsonb, 'deleting a contractor logs their trades and lets them go');

select * from finish();
rollback;

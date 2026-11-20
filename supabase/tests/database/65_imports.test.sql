-- Imports (OT-149): contractors and equipment from a spreadsheet's rows in one checked,
-- logged step, kept in imports, and undone within 24 hours by the archive and delete rule.
begin;
select plan(36);

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

\set logan '''11111111-1111-4111-8111-000000000001'''
\set west '''11111111-1111-4111-8111-000000000002'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set lighting '''33333333-3333-4333-8333-000000000001'''
\set plumbing '''33333333-3333-4333-8333-000000000002'''
\set cooler '''44444444-4444-4444-8444-000000000001'''

select count(*)::int as contractors_before from public.contractors \gset

-- The file: a new contractor with a new trade, Coldline again with a new phone (its contact
-- cell empty), and Hobart, already there, to skip.
create temp table c_rows as select jsonb_build_array(
  jsonb_build_object('row', 2, 'name', 'Lakeview Glass', 'trades', jsonb_build_array('Glass'),
                     'contact_name', 'Ana Ruiz', 'phone', '(312) 555-0101', 'email', 'ana@lakeview.example.com',
                     'insurance_until', '2027-03-31'),
  jsonb_build_object('row', 3, 'name', 'coldline  refrigeration', 'trades', jsonb_build_array('Refrigeration'),
                     'contact_name', '', 'phone', '(312) 555-0000', 'on_duplicate', 'update'),
  jsonb_build_object('row', 4, 'name', 'Hobart Service', 'trades', jsonb_build_array('Dishwashing'),
                     'contact_name', 'Someone', 'phone', '1')
) as r;
grant select on c_rows to authenticated;
create temp table cols as select array['name', 'trades', 'contact_name', 'phone', 'email', 'insurance_until'] as c;
grant select on cols to authenticated;

-- Who imports contractors -----------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$select public.import_contractors((select r from c_rows), (select c from cols), array['Glass'])$$,
  '42501', null, 'a Reporter can''t import contractors');
select pg_temp.login('lee.chen@example.com');
select throws_ok($$select public.import_contractors((select r from c_rows), (select c from cols), array['Glass'])$$,
  '42501', null, 'nor can leadership');

-- Each row's problem names its row, and nothing is written -------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 7, 'name', 'No Phone Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al')),
  array['name', 'trades', 'contact_name', 'phone'])$$,
  '22023', 'row 7: No Phone Co needs a phone number', 'a new contractor needs a phone, as on the form');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Bad Mail', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al',
                       'phone', '1', 'email', 'not an address')),
  array['name', 'trades', 'contact_name', 'phone', 'email'])$$,
  '22023', 'row 2: not an address is not an email address', 'an email is an address');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Odd Trade', 'trades', jsonb_build_array('Juggling'), 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone'])$$,
  '22023', 'row 2: there is no trade called Juggling', 'an unknown trade must be added with the import');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Twice Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1'),
    jsonb_build_object('row', 3, 'name', 'twice co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone'])$$,
  '22023', 'row 3: twice co is in the file twice', 'one contractor twice in the file is refused');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Fine Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1'),
    jsonb_build_object('row', 3, 'name', 'Late Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1',
                       'insurance_until', 'someday')),
  array['name', 'trades', 'contact_name', 'phone', 'insurance_until'])$$,
  '22023', null, 'a date that isn''t one is refused');
select pg_temp.su();
select is((select count(*)::int from public.contractors), :contractors_before, 'a refused import adds nothing');
select is((select count(*)::int from public.contractors where name = 'Fine Co'), 0, 'not even the rows before the bad one');

-- The import --------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.import_contractors((select r from c_rows), (select c from cols), array['Glass'], 'contractors.xlsx') as c_result \gset
select is(:'c_result'::jsonb - 'import_id', '{"added": 1, "updated": 1, "skipped": 1, "new_trades": 1}'::jsonb,
  'one added, one updated, one skipped, one new trade');
select (:'c_result'::jsonb ->> 'import_id') as c_import \gset

select pg_temp.su();
select is((select array_agg(t.name) from public.contractor_trades ct join public.trades t on t.id = ct.trade_id
           join public.contractors c on c.id = ct.contractor_id where c.name = 'Lakeview Glass'),
  array['Glass'], 'the new contractor has the new trade');
select is((select phone from public.contractors where name = 'Coldline Refrigeration'), '(312) 555-0000',
  'an update changes the file''s columns');
select is((select contact_name from public.contractors where name = 'Coldline Refrigeration'), 'Rosa Alvarez',
  'an empty cell leaves the value as it is');
select is((select name from public.contractors where id = '55555555-5555-4555-8555-000000000001'), 'Coldline Refrigeration',
  'the update matched by name, ignoring case and spaces, and kept its own spelling');
select is((select contact_name from public.contractors where name = 'Hobart Service'), 'Factory service',
  'a skipped duplicate is left alone');
select is((select file_name from public.imports where id = :'c_import'), 'contractors.xlsx', 'the import is kept');
select ok(exists (select 1 from public.audit_log where action = 'import.contractors' and meta ->> 'import_id' = :'c_import'),
  'and logged');

select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from public.imports where id = :'c_import'), 1, 'Ops reads the import');
select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.imports where id = :'c_import'), 0, 'a Reporter doesn''t');
select throws_ok(format('select public.undo_import(%L)', :'c_import'), 'P0002', null, 'nor undoes it (to them there is no such import, OT-154)');

-- Undo --------------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import(:'c_import'), '{"removed": 1, "restored": 1, "kept": []}'::jsonb,
  'undo removes what it added and puts back what it updated');
select pg_temp.su();
select is((select count(*)::int from public.contractors where name = 'Lakeview Glass'), 0, 'the new contractor is gone');
select is((select phone from public.contractors where name = 'Coldline Refrigeration'), '(312) 555-0187',
  'Coldline has its phone back');
select is((select count(*)::int from public.trades where name = 'Glass'), 0, 'the trade nobody has now is gone');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.undo_import(%L)', :'c_import'), '55000', null, 'an import is undone once');

-- What gained history stays, and 24 hours is the limit ---------------------------------

select (public.import_contractors(jsonb_build_array(
  jsonb_build_object('row', 2, 'name', 'Visited Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone']) ->> 'import_id') as visited_import \gset
select pg_temp.su();
insert into public.service_records (restaurant_id, kind, contractor_id, service_date, title)
select :logan, 'contractor', id, current_date, 'Fixed the drain' from public.contractors where name = 'Visited Co';
select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import(:'visited_import') -> 'kept', '["Visited Co"]'::jsonb, 'a contractor with a visit is kept');
select pg_temp.su();
select is((select count(*)::int from public.contractors where name = 'Visited Co'), 1, 'and is still there');

select pg_temp.login('bert.velilla@example.com');
select (public.import_contractors(jsonb_build_array(
  jsonb_build_object('row', 2, 'name', 'Old News Co', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone']) ->> 'import_id') as old_import \gset
select pg_temp.su();
update public.imports set created_at = now() - interval '25 hours' where id = :'old_import';
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.undo_import(%L)', :'old_import'), '55000', null, 'after 24 hours there is no undo');

-- Equipment ---------------------------------------------------------------------------

-- Maya can add and edit equipment at Logan Square only.
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.import_equipment(null, jsonb_build_array(
    jsonb_build_object('row', 5, 'restaurant_id', %L, 'name', 'Bar sink', 'category_id', %L)), array['name', 'category_id'])$$,
    :porter, :plumbing),
  '42501', 'row 5: you can''t add or edit equipment at Porter', 'only at a restaurant where you can edit equipment');
select (public.import_equipment(:logan, jsonb_build_array(
  jsonb_build_object('row', 2, 'name', 'Patio heater', 'category_id', :lighting, 'brand', 'Infratech')),
  array['name', 'category_id', 'brand']) ->> 'added')::int as maya_added \gset
select is(:maya_added, 1, 'a Reporter with Add / edit equipment imports at their restaurant');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.import_equipment(%L, jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Mystery box')), array['name'])$$, :logan),
  '22023', 'row 2: Mystery box needs a category', 'a new unit needs a category');

select pg_temp.su();
update public.categories set active = false where id = :plumbing;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.import_equipment(%L, jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Mop sink', 'category_id', %L)), array['name', 'category_id'])$$, :logan, :plumbing),
  '22023', null, 'a turned-off category goes on nothing new');
select pg_temp.su();
update public.categories set active = true where id = :plumbing;

-- All restaurants: a new unit at West Loop, and Logan's walk-in matched by its serial.
select pg_temp.login('bert.velilla@example.com');
select public.import_equipment(null, jsonb_build_array(
  jsonb_build_object('row', 2, 'restaurant_id', :west, 'name', 'Ice bin', 'category_id', :plumbing, 'serial', 'IB-1'),
  jsonb_build_object('row', 3, 'restaurant_id', :logan, 'name', 'Cooler (walk-in)', 'serial', 'kp-7xw-220418',
                     'brand', 'Kolpak', 'model', '', 'on_duplicate', 'update')),
  array['name', 'serial', 'brand', 'model', 'category_id'], 'units.csv') as e_result \gset
select is(:'e_result'::jsonb - 'import_id', '{"added": 1, "updated": 1, "skipped": 0}'::jsonb,
  'a unit is matched by its serial at the same restaurant');
select (:'e_result'::jsonb ->> 'import_id') as e_import \gset
select pg_temp.su();
select is((select name || ' / ' || brand from public.equipment where id = :cooler), 'Cooler (walk-in) / Kolpak',
  'the update changed the file''s columns');

-- The walk-in has tickets, but undo puts back its values; the new unit, with a ticket since, stays.
insert into public.tickets (restaurant_id, category_id, equipment_id, title, created_by)
select :west, :plumbing, id, 'Bin cracked', '22222222-2222-4222-8222-000000000003'
from public.equipment where name = 'Ice bin';
select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import(:'e_import'), '{"removed": 0, "restored": 1, "kept": ["Ice bin"]}'::jsonb,
  'undo keeps a unit with a ticket and restores the one it updated');
select pg_temp.su();
select is((select name from public.equipment where id = :cooler), 'Walk-in Cooler 1', 'the walk-in has its name back');

select finish();
rollback;

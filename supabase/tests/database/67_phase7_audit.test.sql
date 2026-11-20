-- Security and code quality pass over Phase 7 (OT-154): who reads an import, every malformed
-- row named by its row, new trades added only for a row that is written, undo keeping edits
-- made since, no telling whether an import exists, and undo of a unit moved since.
begin;
select plan(28);

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
\set porter '''11111111-1111-4111-8111-000000000003'''
\set lighting '''33333333-3333-4333-8333-000000000001'''

-- 1. Who reads an import ------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select (public.import_equipment(:porter,
  jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Audit Porter Unit', 'category_id', :lighting, 'serial', 'AUD-1')),
  array['name', 'category_id', 'serial'], 'porter.csv') ->> 'import_id') as porter_import \gset
select is((select count(*)::int from public.imports where id = :'porter_import'), 1, 'whoever ran an import reads it');

-- Chris, narrowed to Logan Square, can't see Porter's units, so he can't read their import.
select pg_temp.su();
delete from public.memberships where user_id = (select id from auth.users where email = 'chris.novak@example.com');
insert into public.memberships (user_id, restaurant_id)
  select id, :logan from auth.users where email = 'chris.novak@example.com';
select pg_temp.login('chris.novak@example.com');
select is((select count(*)::int from public.equipment where restaurant_id = :porter), 0, 'Chris sees no unit at Porter');
select is((select count(*)::int from public.imports where id = :'porter_import'), 0,
  'nor Bert''s import of one, with its units'' values');
select pg_temp.login('theo.grant@example.com');
select is((select count(*)::int from public.imports where id = :'porter_import'), 0,
  'another Ops manager doesn''t read someone else''s import');
select pg_temp.login('admin@example.com');
select is((select count(*)::int from public.imports where id = :'porter_import'), 1, 'an admin does');

-- 5. Nobody else learns whether an import exists ------------------------------------------

select pg_temp.login('theo.grant@example.com');
select throws_ok(format('select public.undo_import(%L)', :'porter_import'), 'P0002', 'no such import',
  'someone else''s import is no such import to undo');
select throws_ok(format('select public.undo_import_preview(%L)', :'porter_import'), 'P0002', 'no such import',
  'or to preview');
select throws_ok(format('select public.undo_import_preview(%L)', gen_random_uuid()), 'P0002', 'no such import',
  'the same as an id that names nothing');

-- 2. Every malformed row says which -------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$select public.import_equipment(null,
    jsonb_build_array(jsonb_build_object('row', 5, 'name', 'X', 'restaurant_id', 'not-an-id')), array['name'])$$,
  '22023', 'row 5: choose a restaurant from the list', 'a restaurant id that isn''t one names its row');
select throws_ok($$select public.import_equipment('11111111-1111-4111-8111-000000000001',
    jsonb_build_array(jsonb_build_object('row', 6, 'name', 'X', 'category_id', 'nope')), array['name', 'category_id'])$$,
  '22023', 'row 6: choose a category from the list', 'so does a category id');
select throws_ok($$select public.import_equipment('11111111-1111-4111-8111-000000000001',
    jsonb_build_array(jsonb_build_object('row', 'two', 'name', 'X', 'category_id', 'nope')), array['name', 'category_id'])$$,
  '22023', 'row 1: choose a category from the list', 'a row number that can''t be read is its place in the file');
select throws_ok($$select public.import_equipment('11111111-1111-4111-8111-000000000001',
    jsonb_build_array('"a cell"'::jsonb), array['name'])$$,
  '22023', 'row 1: a row is a set of named cells', 'a row that isn''t an object');
select throws_ok($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 3, 'name', 'Listless Co', 'trades', 'Plumbing', 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone'])$$,
  '22023', 'row 3: trades are a list of names', 'trades that aren''t a list');

-- 3. A new trade is checked with its row, and added only for a row that is written ---------

select throws_ok(format($$select public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 4, 'name', 'Long Trade Co', 'trades', jsonb_build_array(%L), 'contact_name', 'Al', 'phone', '1')),
  array['name', 'trades', 'contact_name', 'phone'], array[%L])$$, repeat('g', 61), repeat('g', 61)),
  '22023', 'row 4: a trade''s name is at most 60 characters', 'a long new trade names its row');
select is(public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Coldline Refrigeration', 'trades', jsonb_build_array('Audit Skipped Trade'))),
  array['name', 'trades'], array['Audit Skipped Trade', 'Audit Unused Trade']) - 'import_id',
  '{"added": 0, "updated": 0, "skipped": 1, "new_trades": 0}'::jsonb,
  'a skipped row adds no trade, and neither does one no row names');
select is((select count(*)::int from public.trades where name like 'Audit % Trade'), 0, 'so the list is as it was');

-- 6. The log keeps the file name as the import does ---------------------------------------

select (public.import_contractors(jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Coldline Refrigeration')),
  array['name'], '{}', repeat('f', 5000)) ->> 'import_id') as long_import \gset
select pg_temp.su();
select is((select char_length(meta ->> 'file_name') from public.audit_log
           where action = 'import.contractors' and meta ->> 'import_id' = :'long_import'), 200,
  'the audit log keeps 200 characters of the file name');

-- 4. Undo keeps what was edited since -----------------------------------------------------

select phone as coldline_phone, notes as coldline_notes from public.contractors where name = 'Coldline Refrigeration' \gset
select pg_temp.login('bert.velilla@example.com');
select (public.import_contractors(jsonb_build_array(
    jsonb_build_object('row', 2, 'name', 'Coldline Refrigeration', 'phone', '(312) 555-0999', 'notes', 'From the sheet',
                       'on_duplicate', 'update')),
  array['name', 'phone', 'notes'], '{}', 'vendors.xlsx') ->> 'import_id') as c_import \gset
-- Someone fixes the phone by hand afterwards.
select pg_temp.su();
update public.contractors set phone = '(312) 555-1234' where name = 'Coldline Refrigeration';
select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import_preview(:'c_import') ->> 'restore', '1', 'the preview still puts back the notes');
select is(public.undo_import(:'c_import') ->> 'restored', '1', 'undo puts back what nobody changed since');
select is((select phone from public.contractors where name = 'Coldline Refrigeration'), '(312) 555-1234',
  'the phone fixed by hand stays');
select is((select notes from public.contractors where name = 'Coldline Refrigeration'), :'coldline_notes',
  'the notes go back');

-- A unit: the import sets brand and model; brand is edited since.
select public.import_equipment(:logan,
  jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Audit Fryer', 'category_id', :lighting)),
  array['name', 'category_id']) is not null as ok \gset
select (public.import_equipment(:logan,
  jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Audit Fryer', 'brand', 'Pitco', 'model', 'SG14', 'on_duplicate', 'update')),
  array['name', 'brand', 'model']) ->> 'import_id') as e_import \gset
select pg_temp.su();
update public.equipment set brand = 'Frymaster' where name = 'Audit Fryer';
select pg_temp.login('bert.velilla@example.com');
select public.undo_import(:'e_import');
select is((select brand || '/' || coalesce(model, '-') from public.equipment where name = 'Audit Fryer'), 'Frymaster/-',
  'a unit keeps the brand edited since and loses the model the import wrote');

-- Edited everywhere since: nothing to put back.
select (public.import_equipment(:logan,
  jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Audit Fryer', 'model', 'SG18', 'on_duplicate', 'update')),
  array['name', 'model']) ->> 'import_id') as e2_import \gset
select pg_temp.su();
update public.equipment set model = 'SG20', name = 'Audit Fryer 2' where name = 'Audit Fryer';
select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import_preview(:'e2_import') ->> 'restore', '0', 'nothing to put back when all of it was edited');
select is(public.undo_import(:'e2_import') ->> 'restored', '0', 'and undo counts none');

-- Checked and kept: a unit moved since is undone only by someone who can edit it there -----

select pg_temp.login('maya.reyes@example.com');
select (public.import_equipment(:logan,
  jsonb_build_array(jsonb_build_object('row', 2, 'name', 'Audit Mover', 'category_id', :lighting)),
  array['name', 'category_id']) ->> 'import_id') as m_import \gset
select pg_temp.su();
update public.equipment set restaurant_id = :porter where name = 'Audit Mover';
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('select public.undo_import(%L)', :'m_import'), '42501', null,
  'Maya can''t undo an import whose unit is now at Porter');
select pg_temp.su();
select is((select count(*)::int from public.equipment where name = 'Audit Mover'), 1, 'so the unit stays');

-- Duplicates match as the review does: the same examples pin importKey in the app's
-- lib/import/matching.test.ts.

select pg_temp.su();
select is(array(select public.import_key(x) from unnest(array[
    'Coldline  Refrigeration', E'Coldline\tRefrigeration', E'Cold' || chr(160) || 'line', 'ÉCLAIR Bakery', 'Cold-line', 'Ice Machine 2']) x),
  array['coldlinerefrigeration', 'coldlinerefrigeration', 'coldline', 'éclairbakery', 'cold-line', 'icemachine2'],
  'import_key() keys a name as the app''s importKey does');

-- The helpers are internal ----------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok($$select public.import_current('equipment', gen_random_uuid())$$, '42501', null,
  'nobody signed in calls the import helpers');

select * from finish();
rollback;

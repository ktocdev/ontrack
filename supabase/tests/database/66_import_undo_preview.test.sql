-- Undo an import's confirm step (OT-153): undo_import_preview says what undo_import would do,
-- with its checks, and changes nothing.
begin;
select plan(8);

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

-- Bert imports two new contractors and updates Hobart's notes; one of the new ones gets a visit.
select pg_temp.login('bert.velilla@example.com');
select (public.import_contractors(jsonb_build_array(
  jsonb_build_object('row', 2, 'name', 'Preview One', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1'),
  jsonb_build_object('row', 3, 'name', 'Preview Two', 'trades', jsonb_build_array('Plumbing'), 'contact_name', 'Al', 'phone', '1'),
  jsonb_build_object('row', 4, 'name', 'Hobart Service', 'notes', 'Ask for Sam', 'on_duplicate', 'update')),
  array['name', 'trades', 'contact_name', 'phone', 'notes']) ->> 'import_id') as imp \gset
select pg_temp.su();
insert into public.service_records (restaurant_id, kind, contractor_id, service_date, title)
select :logan, 'contractor', id, current_date, 'Fixed a leak' from public.contractors where name = 'Preview Two';

select pg_temp.login('bert.velilla@example.com');
select is(public.undo_import_preview(:'imp') - 'until', '{"remove": 1, "keep": ["Preview Two"], "restore": 1}'::jsonb,
  'the preview says what undo would remove, keep and put back');
select ok((public.undo_import_preview(:'imp') ->> 'until')::timestamptz > now() + interval '23 hours',
  'and until when');
select pg_temp.su();
select is((select count(*)::int from public.contractors where name like 'Preview %'), 2, 'it changes nothing');
select is((select undone_at from public.imports where id = :'imp'), null, 'and the import is still open');

select pg_temp.login('chris.novak@example.com');
select throws_ok(format('select public.undo_import_preview(%L)', :'imp'), '42501', null,
  'another Ops manager can''t undo Bert''s import');
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('select public.undo_import_preview(%L)', :'imp'), '42501', null,
  'nor can a Reporter');

select pg_temp.login('bert.velilla@example.com');
select public.undo_import(:'imp');
select throws_ok(format('select public.undo_import_preview(%L)', :'imp'), '55000', null, 'an undone import has no preview');

select pg_temp.su();
update public.imports set created_at = now() - interval '25 hours', undone_at = null where id = :'imp';
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.undo_import_preview(%L)', :'imp'), '55000', null, 'nor one past 24 hours');

select finish();
rollback;

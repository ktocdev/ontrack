-- Import a checklist from a spreadsheet (OT-137): one logged step that matches what is
-- there, adds and turns off, on a new version when a walkthrough has had the checklist.
begin;
select plan(13);

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

\set kitchen_ext '''88888888-8888-4888-8888-000000000002'''
\set kitchen '''cccccccc-cccc-4ccc-8ccc-000000000003'''
select i.title as keep_title, i.group_name as keep_group
from public.walkthrough_items i where i.section_id = :kitchen order by i.sort_order limit 1 \gset
select count(*)::int as items_before from public.walkthrough_items i
join public.walkthrough_sections s on s.id = i.section_id where s.template_id = :kitchen_ext \gset

-- The file: the first Kitchen item, changed; a new item; a new Patio section.
create temp table rows_in as select jsonb_build_array(
  jsonb_build_object('section', 'Kitchen', 'section_short', 'Kitchen', 'area', 'boh', 'group', :'keep_group',
                     'title', :'keep_title', 'directions', 'Look behind the line too.'),
  jsonb_build_object('section', 'Kitchen', 'section_short', 'Kitchen', 'area', 'boh', 'group', 'Electrical',
                     'title', 'Breaker panel labels', 'video_url', 'https://example.com/panel',
                     'category_id', '33333333-3333-4333-8333-000000000014'),
  jsonb_build_object('section', 'Patio', 'group', 'Furniture', 'title', 'Umbrellas')
) as r;
grant select on rows_in to authenticated;

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$select public.import_checklist('88888888-8888-4888-8888-000000000002', (select r from rows_in))$$,
  '42501', null, 'a Reporter can''t import a checklist');

select pg_temp.login('bert.velilla@example.com');
select public.import_checklist(:kitchen_ext, (select r from rows_in)) as v1 \gset
select isnt(:'v1'::uuid, :kitchen_ext::uuid, 'importing over a checklist a walkthrough has had makes a new version');

select pg_temp.su();
select is((select count(*)::int from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
           where s.template_id = :kitchen_ext), :items_before, 'the old version is as it was');
select is((select count(*)::int from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
           where s.template_id = :'v1' and s.active and i.active), 3, 'the new one has the file''s three items');
select is((select directions from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
           where s.template_id = :'v1' and i.title = :'keep_title'), 'Look behind the line too.', 'a matched item is changed');
select isnt((select i.copied_from from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
             where s.template_id = :'v1' and i.title = :'keep_title'), null, 'and keeps its history');
select is((select category_id from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
           where s.template_id = :'v1' and i.title = 'Breaker panel labels'), '33333333-3333-4333-8333-000000000014'::uuid,
  'a new item takes its category');
select ok((select count(*) from public.walkthrough_items i join public.walkthrough_sections s on s.id = i.section_id
           where s.template_id = :'v1' and not i.active) > 0, 'what the file leaves out, with history, is turned off');
select is((select array_agg(name order by sort_order) from public.walkthrough_sections where template_id = :'v1' and active),
  array['Kitchen', 'Patio'], 'the sections are the file''s, in its order');
select is((select count(*)::int from public.audit_log where action = 'checklist.import'), 1, 'the import is logged');

-- Importing again over the new version, which no walkthrough has had, changes it in place.
select pg_temp.login('bert.velilla@example.com');
select is(public.import_checklist(:'v1', jsonb_build_array(jsonb_build_object('section', 'Patio', 'group', 'Furniture', 'title', 'Umbrellas'))),
  :'v1'::uuid, 'a version no walkthrough has had is replaced in place');
select pg_temp.su();
select ok(not exists (select 1 from public.walkthrough_items where title = 'Breaker panel labels'),
  'and an item with no history the file leaves out is deleted');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.import_checklist(%L, %L::jsonb)', :'v1',
  '[{"section":"Patio","group":"Furniture","title":"Heaters","category_id":"00000000-0000-4000-8000-000000000000"}]'),
  '22023', null, 'an unknown category is refused');

select * from finish();
rollback;

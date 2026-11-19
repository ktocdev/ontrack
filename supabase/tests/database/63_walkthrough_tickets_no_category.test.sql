-- Walkthrough tickets need no category (OT-141): a ticket from an item with no active
-- category takes none, carries its section's area (or the one given where there is none)
-- and its place on the checklist; only the walkthrough's functions write either; routing and
-- hand back read the ticket's own area; every section names an area from now on.
begin;
select plan(35);

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
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set july '''aaaaaaaa-aaaa-4aaa-8aaa-000000000103'''
\set walls '''dddddddd-dddd-4ddd-8ddd-000000000110'''
\set floors '''dddddddd-dddd-4ddd-8ddd-000000000111'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set parking '''dddddddd-dddd-4ddd-8ddd-000000000401'''
\set utility '''99999999-9999-4999-8999-000000000001'''
\set degrease '''99999999-9999-4999-8999-000000000002'''
\set kitchen_ext '''88888888-8888-4888-8888-000000000002'''
\set kitchen '''cccccccc-cccc-4ccc-8ccc-000000000003'''
\set boh_electrical '''33333333-3333-4333-8333-000000000014'''

-- ---------------------------------------------------------------------------
-- 1. A ticket from an item with no category
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select public.create_walkthrough_ticket(:oct, 'Hole in the wall by the mop sink', :walls) as walls_ticket \gset
select pg_temp.su();
select is((select category_id from public.tickets where id = :'walls_ticket'), null::uuid,
  'a ticket from an item with no category takes none');
select is((select area::text from public.tickets where id = :'walls_ticket'), 'boh', 'it carries its section''s area');
select is((select checklist_place from public.tickets where id = :'walls_ticket'), 'BOH › Envelope › Walls',
  'and its place on the checklist');
select is((select source::text from public.tickets where id = :'walls_ticket'), 'walkthrough', 'with the Walkthrough tag');

-- An item with a category keeps it, and the ticket has no area of its own.
select pg_temp.login('maya.reyes@example.com');
select public.create_walkthrough_ticket(:oct, 'Outlet sparks', :outlets) as outlet_ticket \gset
select pg_temp.su();
select is((select category_id from public.tickets where id = :'outlet_ticket'), :boh_electrical::uuid,
  'a ticket from an item with a category takes it');
select is((select area from public.tickets where id = :'outlet_ticket'), null::public.area, 'and has no area of its own');
select is((select checklist_place from public.tickets where id = :'outlet_ticket'), 'BOH › Electrical › Outlets',
  'and keeps its place on the checklist too');

-- A quarterly task has no area, so one is asked for.
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('select public.create_walkthrough_ticket(%L, ''Shelves falling down'', p_task_id => %L)', :oct, :utility),
  '22023', 'pick an area for this ticket', 'a ticket from a quarterly task asks for an area');
select public.create_walkthrough_ticket(:oct, 'Shelves falling down', p_task_id => :utility, p_area => 'boh') as task_ticket \gset
select pg_temp.su();
select is((select area::text || ' · ' || checklist_place from public.tickets where id = :'task_ticket'),
  'boh · Q4 · Organize utility areas', 'and takes the one given, with the quarter and the task as its place');

-- So does a section that names none (the seed's Exterior).
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('select public.create_walkthrough_ticket(%L, ''Lights out'', %L)', :july, :parking),
  '22023', 'pick an area for this ticket', 'a section with no area asks for one');
select lives_ok(format('select public.create_walkthrough_ticket(%L, ''Lights out'', %L, p_area => ''foh'')', :july, :parking),
  'and takes the one given');
select pg_temp.su();
select is((select checklist_place from public.tickets where title = 'Lights out'), 'Exterior › Lighting › Parking lot lights',
  'with the section''s short name in its place');

-- ---------------------------------------------------------------------------
-- 2. Only the walkthrough's functions write the area and the place
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format('insert into public.tickets (restaurant_id, title, created_by) values (%L, ''No category'', auth.uid())', :logan),
  '23514', null, 'a ticket filed by hand still needs a category');
select throws_ok(format('insert into public.tickets (restaurant_id, category_id, title, checklist_place, created_by)
  values (%L, %L, ''Claims a place'', ''BOH › Envelope › Walls'', auth.uid())', :logan, :boh_electrical),
  '42501', 'a walkthrough ticket is made from the walkthrough', 'nor does one claim a place on a checklist');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('update public.tickets set area = ''foh'' where id = %L', :'walls_ticket'),
  '42501', 'a walkthrough ticket is made from the walkthrough', 'Ops does not move a ticket''s area');
select throws_ok(format('update public.tickets set checklist_place = ''Elsewhere'' where id = %L', :'walls_ticket'),
  '42501', 'a walkthrough ticket is made from the walkthrough', 'or its place');
update public.tickets set area = 'foh' where id = :'outlet_ticket';
select is((select area from public.tickets where id = :'outlet_ticket'), null::public.area,
  'and an area given to a ticket with a category is cleared');
select throws_ok(format('update public.tickets set category_id = null where id = %L', :'outlet_ticket'),
  '23514', null, 'or take a category off');
select lives_ok(format('update public.tickets set category_id = %L where id = %L', :boh_electrical, :'walls_ticket'),
  'Ops may give a ticket with none a category');
select pg_temp.su();
select is((select area from public.tickets where id = :'walls_ticket'), null::public.area, 'which takes the place of its area');
select is((select checklist_place from public.tickets where id = :'walls_ticket'), 'BOH › Envelope › Walls', 'and keeps its place');

-- ---------------------------------------------------------------------------
-- 3. Routing and hand back read the ticket's own area
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select public.create_walkthrough_ticket(:oct, 'Floor tile lifting', :floors) as floor_ticket \gset
select pg_temp.su();
select ok(exists (select 1 from public.notifications n, public.notification_recipients(n.id) r
                  where n.ticket_id = :'floor_ticket' and n.kind = 'new_ticket'
                    and r.user_id = (select id from public.profiles where email = 'bert.velilla@example.com')),
  'Ops hears about a new ticket with no category');
select ok(not exists (select 1 from public.notifications n, public.notification_recipients(n.id) r
                      where n.ticket_id = :'floor_ticket' and n.kind = 'new_ticket'
                        and r.user_id = (select id from public.profiles where email = 'theo.grant@example.com')),
  'but not someone with its area off (Back of House, for IT)');

select pg_temp.login('bert.velilla@example.com');
select public.hand_back_ticket(:'floor_ticket', 'Reset the tile') as handed \gset
select pg_temp.su();
select is((select area::text from public.inhouse_fixes where id = :'handed'), 'boh', 'a ticket handed back gives its task its area');

-- ---------------------------------------------------------------------------
-- 4. Convert to ticket
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select public.add_walkthrough_fix(:oct, 'Fill the nail holes', :walls) as wall_fix \gset
select public.add_walkthrough_fix(:oct, 'Clear the shelf', p_task_id => :degrease) as task_fix \gset
insert into public.inhouse_fixes (restaurant_id, title, created_by) values (:logan, 'Hand-made task', auth.uid())
  returning id as hand_fix \gset
select pg_temp.login('bert.velilla@example.com');
select public.convert_inhouse_fix(:'wall_fix') as wall_fix_ticket \gset
select pg_temp.su();
select is((select coalesce(category_id::text, 'none') || ' · ' || area || ' · ' || checklist_place
           from public.tickets where id = :'wall_fix_ticket'),
  'none · boh · BOH › Envelope › Walls', 'a walkthrough fix with no category becomes a ticket with none, its area and its place');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.convert_inhouse_fix(%L)', :'task_fix'),
  '22023', 'pick an area for this ticket', 'a fix on a quarterly task asks for an area');
select lives_ok(format('select public.convert_inhouse_fix(%L, p_area => ''boh'')', :'task_fix'), 'and takes the one given');
select throws_ok(format('select public.convert_inhouse_fix(%L, p_area => ''boh'')', :'hand_fix'),
  '22023', 'pick a category for this ticket', 'a task added by hand still needs a category');
select pg_temp.su();
select is((select checklist_place from public.tickets
           where id = (select converted_ticket_id from public.inhouse_fixes where id = :'task_fix')),
  'Q4 · Degrease BOH floors', 'the quarterly task''s ticket names the task');

-- ---------------------------------------------------------------------------
-- 5. Every section names an area
-- ---------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format('select public.save_checklist_section(%L, null, ''Roof'', null, null)', :kitchen_ext),
  '22023', 'every section needs an area', 'a new section needs an area');
select throws_ok(format('select public.save_checklist_section(%L, %L, ''Kitchen'', ''Kitchen'', null)', :kitchen_ext, :kitchen),
  '22023', 'every section needs an area', 'and an edit can''t take one away');
select public.save_checklist_section(:kitchen_ext, null, 'Roof', null, 'boh') as v2 \gset
select pg_temp.su();
select is((select count(*)::int from public.walkthrough_sections s join public.walkthrough_templates t on t.id = s.template_id
           where t.replaced_by is null and s.copied_from = 'cccccccc-cccc-4ccc-8ccc-000000000004' and s.area is null), 1,
  'a section with an area is saved, and the new version keeps its copy of Exterior, which had none');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(
  format('select public.import_checklist(%L, %L::jsonb)', :'v2',
    '[{"section":"Kitchen","area":"","group":"Electrical","title":"Outlets"},{"section":"Exterior","area":"boh","group":"Lighting","title":"Timers"}]'),
  '22023', 'every section needs an area', 'an import needs an area on every section');

-- ---------------------------------------------------------------------------
-- 6. The helper stays closed
-- ---------------------------------------------------------------------------

select pg_temp.su();
select ok(not has_function_privilege('authenticated', 'public.walkthrough_place(public.walkthroughs, uuid, uuid)', 'execute'),
  'walkthrough_place is closed to everyone signed in');
select ok(not has_function_privilege('anon', 'public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid, public.area)', 'execute'),
  'create_walkthrough_ticket is closed to signed-out visitors');

select * from finish();
rollback;

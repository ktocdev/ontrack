-- In-house tasks from Ops (OT-128): Add task, Convert to ticket and Hand back, each checked
-- (Update status at the restaurant) and logged, each one notification to the restaurant's
-- Reporters by My categories and its own Profile switch.
begin;
select plan(34);

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

-- Who is told about a task's newest notification, as "name:push:email".
create function pg_temp.told(p_fix uuid) returns text[] language plpgsql as $$
declare
  v_id uuid;
  v text[];
begin
  perform pg_temp.su();
  select id into v_id from public.notifications where inhouse_fix_id = p_fix order by seq desc limit 1;
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

\set logan '''11111111-1111-4111-8111-000000000001'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set boh_electrical '''33333333-3333-4333-8333-000000000014'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set t1039 '''66666666-6666-4666-8666-000000001039'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''

select id as cooler, category_id as cooler_category from public.equipment where restaurant_id = :logan and name = 'Walk-in Cooler 1'
\gset
select id as elsewhere from public.equipment where restaurant_id = :porter limit 1
\gset
select id as boxes from public.inhouse_fixes where title = 'Clear boxes from utility closet'
\gset
select id as reglued from public.inhouse_fixes where title = 'Re-glue trim on pass shelf'
\gset

-- ---------------------------------------------------------------------------
-- Add task
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.add_inhouse_task(%L, 'Mine')$$, :logan), '42501', null,
  'a Reporter adds their own tasks the usual way, not this one');
select throws_ok(
  format($$insert into public.inhouse_fixes (restaurant_id, title, created_by, from_ops) values (%L, 'Posing', %L, true)$$, :logan, :maya),
  '42501', null, 'and can''t make one look like it came from Ops');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$select public.add_inhouse_task(%L, 'Lead')$$, :logan), '42501', null, 'nor can leadership');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.add_inhouse_task(%L, 'Wrong place', null, %L)$$, :logan, :'elsewhere'), '22023', null,
  'a unit from another restaurant is refused');
select public.add_inhouse_task(:logan, '  Wipe down the cooler gasket  ', 'It''s the 2-pin kind', :'cooler') as task
\gset
select results_eq(
  format($$select title, note, equipment_id, category_id, area::text, from_ops, created_by from public.inhouse_fixes where id = %L$$, :'task'),
  format($$values ('Wipe down the cooler gasket'::text, 'It''s the 2-pin kind'::text, %L::uuid, %L::uuid, 'boh'::text, true, %L::uuid)$$,
         :'cooler', :'cooler_category', :bert),
  'Ops adds a task with the unit, which brings its category and area'
);
select is(pg_temp.told(:'task'), array['bert:false:true', 'maya:true:true'],
  'Maya hears, and Bert has his email copy');
select is((select count(*)::int from public.audit_log where action = 'inhouse_task.add' and actor_id = :bert), 1, 'it is logged');

-- ---------------------------------------------------------------------------
-- Convert to ticket
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.convert_inhouse_fix(%L, %L)$$, :'boxes', :boh_electrical), 'P0002', null,
  'a Reporter can''t convert a fix');
select public.add_walkthrough_fix(:oct, 'Cover plate cracked', :outlets) as wfix
\gset
select check_id as wcheck from public.inhouse_fixes where id = :'wfix'
\gset

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.convert_inhouse_fix(%L)$$, :'reglued'), '22023', null, 'a fix that''s done isn''t converted');
select throws_ok(format($$select public.convert_inhouse_fix(%L)$$, :'boxes'), '22023', null,
  'a fix with no category and no item asks for one');
select lives_ok(format($$select public.convert_inhouse_fix(%L, %L)$$, :'boxes', :boh_electrical), 'given one, it converts');
select results_eq(
  format($$select t.title, t.source::text, t.walkthrough_id, t.created_by, t.status::text, t.assignee_id
           from public.tickets t join public.inhouse_fixes f on f.converted_ticket_id = t.id where f.id = %L$$, :'boxes'),
  format($$values ('Clear boxes from utility closet'::text, 'reported'::text, null::uuid, %L::uuid, 'open'::text, null::uuid)$$, :bert),
  'a plain ticket by Bert, open with nobody on it'
);

select convert_inhouse_fix as wticket from public.convert_inhouse_fix(:'wfix')
\gset
select results_eq(
  format($$select source::text, walkthrough_id, walkthrough_check_id, category_id from public.tickets where id = %L$$, :'wticket'),
  format($$values ('walkthrough'::text, %L::uuid, %L::uuid, %L::uuid)$$, :oct, :'wcheck', :boh_electrical),
  'a walkthrough fix becomes a walkthrough ticket on the same check, with the item''s category'
);
select results_eq(
  format($$select converted_ticket_id, check_id from public.inhouse_fixes where id = %L$$, :'wfix'),
  format($$values (%L::uuid, null::uuid)$$, :'wticket'),
  'the fix stays, converted, and hands the check to the ticket'
);
select is(pg_temp.told(:'wfix'), array['bert:false:true', 'maya:true:true'], 'Maya hears it became a ticket');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.convert_inhouse_fix(%L)$$, :'wfix'), '22023', null, 'it isn''t converted twice');

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :outlets), '23514', null,
  'the item can''t be Good while its ticket is open');
select throws_ok(format($$select public.set_inhouse_fix_done(%L, true)$$, :'wfix'), '23514', null,
  'a converted fix isn''t checked off');
select throws_ok(format($$select public.delete_inhouse_fix(%L)$$, :'wfix'), '23514', null, 'nor deleted');
select pg_temp.su();
select is(
  (select fixes from public.v_walkthrough_summary where walkthrough_id = :oct),
  (select count(*)::int from public.inhouse_fixes where walkthrough_id = :oct and converted_ticket_id is null),
  'the walkthrough''s in-house count leaves it out');
select is((select count(*)::int from public.audit_log where action = 'inhouse_fix.convert'), 2, 'each convert is logged');

-- ---------------------------------------------------------------------------
-- Hand back
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.hand_back_ticket(%L, 'Mine')$$, :t1039), 'P0002', null, 'a Reporter can''t hand back');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.hand_back_ticket(%L, '   ')$$, :t1039), '22023', null, 'it says what to do');
select public.hand_back_ticket(:t1039, 'Replace the bulb', 'It''s the 2-pin kind, in the office') as back
\gset
select results_eq(
  format($$select status::text, closed_by, resolution from public.tickets where id = %L$$, :t1039),
  format($$values ('closed'::text, %L::uuid, 'Handed back as an in-house task: Replace the bulb'::text)$$, :bert),
  'the ticket closes, saying why'
);
select results_eq(
  format($$select f.from_ticket_id, f.equipment_id, f.category_id, f.from_ops, f.note
           from public.inhouse_fixes f where f.id = %L$$, :'back'),
  format($$select id, equipment_id, category_id, true, 'It''s the 2-pin kind, in the office'::text from public.tickets where id = %L$$, :t1039),
  'and the task takes its unit and category, with a link back'
);
select pg_temp.su();
select is(
  (select count(*)::int from public.notifications where ticket_id = :t1039 and kind = 'status_change' and created_at >= now()),
  0, 'closing it sends nothing of its own');
select is(pg_temp.told(:'back'), array['bert:false:true', 'maya:true:true'], 'the task is the one notification');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.hand_back_ticket(%L, 'Again')$$, :t1039), '22023', null, 'a closed ticket isn''t handed back');
select pg_temp.su();
select is((select count(*)::int from public.audit_log where action = 'ticket.hand_back'), 1, 'it is logged');

-- ---------------------------------------------------------------------------
-- My categories and the Profile switch
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
insert into public.area_prefs (user_id, area, notify, shown) values (:maya, 'boh', 'off', true);
select pg_temp.login('bert.velilla@example.com');
select public.add_inhouse_task(:logan, 'Back of house thing', null, :'cooler') as boh_task
\gset
select is(pg_temp.told(:'boh_task'), array['bert:false:true'], 'with Back of House off, Maya isn''t told of a task there');
select pg_temp.login('bert.velilla@example.com');
select public.hand_back_ticket(:t1042, 'Her own ticket back') as own_back
\gset
select is(pg_temp.told(:'own_back'), array['bert:false:true', 'maya:true:true'],
  'but a ticket she filed, handed back, still reaches her');
select pg_temp.login('bert.velilla@example.com');
select public.add_inhouse_task(:logan, 'Front of house thing', null, null, 'foh') as foh_task
\gset
select is(pg_temp.told(:'foh_task'), array['bert:false:true', 'maya:true:true'], 'a Front of House task does');

select pg_temp.login('maya.reyes@example.com');
insert into public.notification_prefs (user_id, kind, enabled) values (:maya, 'inhouse_task', false);
select pg_temp.login('bert.velilla@example.com');
select public.add_inhouse_task(:logan, 'Another front thing', null, null, 'foh') as off_task
\gset
select is(pg_temp.told(:'off_task'), array['bert:false:true'], 'and with its Profile switch off, nothing does');

-- Ops narrowed to Logan Square reaches only Logan Square.
select pg_temp.su();
update public.memberships set restaurant_id = :logan where user_id = (select id from public.profiles where email = 'chris.novak@example.com');
select pg_temp.login('chris.novak@example.com');
select throws_ok(format($$select public.add_inhouse_task(%L, 'Porter thing')$$, :porter), '42501', null,
  'Ops at Logan Square adds nothing at Porter');

select * from finish();
rollback;

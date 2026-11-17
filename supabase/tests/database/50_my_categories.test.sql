-- My categories (OT-116): each person's own area and category settings, and how
-- notification_recipients filters the pool by them.
begin;
select plan(25);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- "name:push:email" for each person told about the ticket's newest outbox row.
create function pg_temp.told(p_title text) returns text[] language plpgsql as $$
declare
  v_id uuid;
  v text[];
begin
  perform set_config('role', 'postgres', true);
  select x.id into v_id from public.notifications x join public.tickets t on t.id = x.ticket_id
  where t.title = p_title order by x.seq desc limit 1;
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

-- Seed: Bert, Chris and Theo are Ops everywhere; Theo is the IT person, with Front and Back
-- of House off and hidden. Maya manages Logan Square.
\set theo '''22222222-2222-4222-8222-000000000008'''
\set fls '''11111111-1111-4111-8111-000000000001'''
\set fridge '''33333333-3333-4333-8333-000000000012'''
\set pos '''33333333-3333-4333-8333-000000000021'''

-- ---------------------------------------------------------------------------
-- Each person's own rows
-- ---------------------------------------------------------------------------

select pg_temp.login('theo.grant@example.com');
select is((select count(*)::int from public.area_prefs), 2, 'someone reads their own settings');
select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.area_prefs), 0, 'and nobody else''s');
select pg_temp.login('admin@example.com');
select is((select count(*)::int from public.area_prefs where user_id = (:theo)::uuid), 2,
  'except an admin, for View as');

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$ insert into public.area_prefs (user_id, area, notify) values (%L, 'it', 'off') $$, :theo),
  '42501', null, 'nobody writes someone else''s settings');
update public.area_prefs set notify = 'all', shown = true where user_id = (:theo)::uuid;
delete from public.category_prefs where user_id = (:theo)::uuid;
delete from public.area_prefs where user_id = (:theo)::uuid;
select pg_temp.login('theo.grant@example.com');
select is((select count(*)::int from public.area_prefs where notify = 'off' and not shown), 2,
  'or changes or deletes them');

select pg_temp.login('maya.reyes@example.com');
select lives_ok($$ insert into public.area_prefs (user_id, area, notify, updated_at) values (auth.uid(), 'it', 'urgent', '2000-01-01') $$,
  'someone writes their own');
select ok((select updated_at > now() - interval '1 minute' from public.area_prefs where user_id = auth.uid()),
  'and the database dates it');
select throws_ok($$ update public.area_prefs set notify = 'all' where user_id = auth.uid() $$, '23514', null,
  'a row at the defaults is not kept; it is deleted');
select throws_ok(format($$ insert into public.category_prefs (user_id, category_id) values (auth.uid(), %L) $$, :fridge),
  '23514', null, 'a category row says something');
select lives_ok($$ delete from public.area_prefs where user_id = auth.uid() $$, 'and someone deletes their own');

set local role postgres;
select set_config('request.jwt.claims', '', true);
update public.profiles set deactivated_at = now() where email = 'maya.reyes@example.com';
select pg_temp.login('maya.reyes@example.com');
select throws_ok($$ insert into public.area_prefs (user_id, area, notify) values (auth.uid(), 'it', 'off') $$,
  '42501', null, 'someone deactivated writes nothing');
set local role postgres;
select set_config('request.jwt.claims', '', true);
update public.profiles set deactivated_at = null where email = 'maya.reyes@example.com';

set local role anon;
select throws_ok($$ select * from public.category_prefs $$, '42501', null, 'signed out reads nothing');

-- Deleting a category takes everyone's settings for it.
set local role postgres;
insert into public.categories (id, name, area) values ('33333333-3333-4333-8333-000000000099', 'Never used', 'boh');
insert into public.category_prefs (user_id, category_id, shown) values ((:theo)::uuid, '33333333-3333-4333-8333-000000000099', true);
delete from public.categories where id = '33333333-3333-4333-8333-000000000099';
select is((select count(*)::int from public.category_prefs where category_id = '33333333-3333-4333-8333-000000000099'), 0,
  'a deleted category takes its settings');

-- ---------------------------------------------------------------------------
-- Who gets what
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
insert into public.tickets (restaurant_id, category_id, title, created_by)
values ((:fls)::uuid, (:fridge)::uuid, 'Back of House', auth.uid()),
       ((:fls)::uuid, (:pos)::uuid, 'POS', auth.uid());
select is(pg_temp.told('Back of House'), array['bert:true:true', 'chris:true:true'],
  'an area set to Off hears nothing of a new ticket there');
select is(pg_temp.told('POS'), array['bert:true:true', 'chris:true:true', 'theo:true:true'],
  'and one left on hears it');

select pg_temp.login('theo.grant@example.com');
insert into public.category_prefs (user_id, category_id, notify) values (auth.uid(), (:fridge)::uuid, 'all');
select is(pg_temp.told('Back of House'), array['bert:true:true', 'chris:true:true', 'theo:true:true'],
  'a category''s own setting wins over its area''s');
select pg_temp.login('chris.novak@example.com');
insert into public.category_prefs (user_id, category_id, notify) values (auth.uid(), (:pos)::uuid, 'off');
select is(pg_temp.told('POS'), array['bert:true:true', 'theo:true:true'], 'both ways');
select pg_temp.login('theo.grant@example.com');
update public.category_prefs set notify = null, shown = true where user_id = auth.uid();
select is(pg_temp.told('Back of House'), array['bert:true:true', 'chris:true:true'],
  'a category with only Show set follows its area''s Notify');

-- Urgent only.
select pg_temp.login('bert.velilla@example.com');
insert into public.area_prefs (user_id, area, notify) values (auth.uid(), 'boh', 'urgent');
select is(pg_temp.told('Back of House'), array['chris:true:true'], 'Urgent only leaves out a normal ticket');
select pg_temp.login('maya.reyes@example.com');
insert into public.tickets (restaurant_id, category_id, title, created_by, urgency)
values ((:fls)::uuid, (:fridge)::uuid, 'Urgent', auth.uid(), 'urgent');
select is(pg_temp.told('Urgent'), array['bert:true:true', 'chris:true:true'], 'and tells of an urgent one');

-- A reopen is the pool too.
select pg_temp.login('maya.reyes@example.com');
update public.tickets set status = 'closed', resolution = 'Done' where title = 'Back of House';
select public.reopen_ticket((select id from public.tickets where title = 'Back of House'), 'It is back');
select is(pg_temp.told('Back of House'), array['chris:true:true'], 'a reopen follows the settings too');

-- Another Ops person picking a ticket up reaches Ops' inbox only by the settings.
select pg_temp.login('chris.novak@example.com');
select public.set_ticket_status((select id from public.tickets where title = 'Back of House'), 'in_progress');
select is(pg_temp.told('Back of House'), array['chris:false:true', 'maya:true:true'],
  'Ops'' email about another picking one up follows the settings');
select pg_temp.login('bert.velilla@example.com');
delete from public.area_prefs where user_id = auth.uid();
select is(pg_temp.told('Back of House'), array['bert:false:true', 'chris:false:true', 'maya:true:true'],
  'and comes back with them');

-- A ticket you filed or are on always reaches you.
select pg_temp.login('theo.grant@example.com');
insert into public.tickets (restaurant_id, category_id, title, created_by)
values ((:fls)::uuid, (:fridge)::uuid, 'Theo filed', auth.uid());
update public.tickets set status = 'closed', resolution = 'Done' where title = 'Theo filed';
select pg_temp.login('bert.velilla@example.com');
select public.reopen_ticket((select id from public.tickets where title = 'Theo filed'), 'Still broken');
select is(pg_temp.told('Theo filed'), array['bert:false:true', 'chris:true:true', 'theo:true:true'],
  'a reopen reaches whoever filed it, whatever their setting');
select pg_temp.login('theo.grant@example.com');
select public.set_ticket_status((select id from public.tickets where title = 'Theo filed'), 'in_progress');
select pg_temp.login('chris.novak@example.com');
select public.post_ticket_update((select id from public.tickets where title = 'Theo filed'), 'Parts ordered');
select is(pg_temp.told('Theo filed'), array['chris:false:true', 'theo:true:true'],
  'and so does news of a ticket you are on');

select * from finish();
rollback;

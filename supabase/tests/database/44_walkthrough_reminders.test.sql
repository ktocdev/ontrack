-- Walkthrough reminders (OT-103): the daily job writes one reminder for each open
-- walkthrough 7 and 2 days before it is due, once each, and notification_recipients sends
-- it to the restaurant's managers who can work the walkthrough.
begin;
select plan(20);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The newest reminder for a walkthrough.
create function pg_temp.latest(p_walkthrough uuid) returns uuid language plpgsql as $$
declare
  v uuid;
begin
  perform pg_temp.service();
  select id into v from public.notifications where walkthrough_id = p_walkthrough order by seq desc limit 1;
  return v;
end $$;

-- "name:push:email" for each person told about the walkthrough's newest reminder.
create function pg_temp.told(p_walkthrough uuid) returns text[] language plpgsql as $$
declare
  v_id uuid := pg_temp.latest(p_walkthrough);
  v text[];
begin
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

-- Seed: October's four walkthroughs are open and due Oct 31. Maya manages Logan Square
-- (…0001), Ari manages …0004, Dana Porter (…0003); nobody manages …0002. Bert and Chris
-- are Ops everywhere.
\set fls '''11111111-1111-4111-8111-000000000001'''
\set oct_fls '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set oct_0002 '''aaaaaaaa-aaaa-4aaa-8aaa-000000000002'''
\set maya '''22222222-2222-4222-8222-000000000001'''

-- Only the scheduled job writes reminders.
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.queue_walkthrough_reminders('2026-10-24') $$, '42501', null,
  'a signed-in person can''t send reminders');

-- 8 days before: nothing. 7 days before: one for each open walkthrough.
select pg_temp.service();
select is(public.queue_walkthrough_reminders('2026-10-23'), 0, 'nothing before the seventh day');
select is(public.queue_walkthrough_reminders('2026-10-24'), 4, 'on the seventh day, one for each open walkthrough');
select is((select days_before from public.notifications where walkthrough_id = (:oct_fls)::uuid),
  7, 'and it says which reminder it is');
select is(public.queue_walkthrough_reminders('2026-10-24'), 0, 'running it again sends nothing more');
select is(public.queue_walkthrough_reminders('2026-10-26'), 0, 'nor do the days after');

-- Who hears: the restaurant's managers, by push and email; not Ops.
select is(pg_temp.told((:oct_fls)::uuid), array['maya:true:true'],
  'a reminder goes to the restaurant''s manager by push and email, and not to Ops');
select is(pg_temp.told((:oct_0002)::uuid), '{}'::text[], 'a restaurant with no manager tells nobody');

-- 2 days before: the second one, once.
select is(public.queue_walkthrough_reminders('2026-10-29'), 4, 'on the second day before, the second reminder');
select is(public.queue_walkthrough_reminders('2026-10-30'), 0, 'once');
select is(public.queue_walkthrough_reminders('2026-11-01'), 0, 'and nothing once it is past due');

-- A walkthrough opened late, or a missed morning, gets one reminder, the nearest.
insert into public.walkthroughs (restaurant_id, template_id, period, due_on)
values ((:fls)::uuid, '88888888-8888-4888-8888-000000000001', '2026-11-01', '2026-11-30')
on conflict (restaurant_id, period) do nothing;
select set_config('test.nov', (select id::text from public.walkthroughs
  where restaurant_id = (:fls)::uuid and period = '2026-11-01'), true);
select is(public.queue_walkthrough_reminders('2026-11-29'), 1, 'a late start sends one reminder');
select is((select array_agg(days_before) from public.notifications where walkthrough_id = current_setting('test.nov')::uuid),
  array[2], 'the nearest day, not both');
select is(public.queue_walkthrough_reminders('2026-11-30'), 0, 'and nothing the next day');

-- The switches: the kind stops it, email off leaves push.
select pg_temp.login('maya.reyes@example.com');
insert into public.notification_prefs (user_id, kind, enabled) values (auth.uid(), 'walkthrough_reminder', false);
select is(pg_temp.told(current_setting('test.nov')::uuid), '{}'::text[], 'turning reminders off stops them');
select pg_temp.login('maya.reyes@example.com');
update public.notification_prefs set kind = 'email' where user_id = auth.uid() and kind = 'walkthrough_reminder';
select is(pg_temp.told(current_setting('test.nov')::uuid), array['maya:true:false'], 'turning email off leaves push');
select pg_temp.login('maya.reyes@example.com');
delete from public.notification_prefs where user_id = auth.uid();

-- Someone who can't work the walkthrough isn't reminded about it.
select pg_temp.service();
insert into public.rights (user_id, key, allowed) values ((:maya)::uuid, 'create_tickets', false);
select is(pg_temp.told(current_setting('test.nov')::uuid), '{}'::text[], 'a manager without Create tickets isn''t reminded');
delete from public.rights where user_id = (:maya)::uuid and key = 'create_tickets';

-- Submitted before it went out: nobody.
update public.walkthroughs set status = 'submitted', submitted_at = now() where id = current_setting('test.nov')::uuid;
select is(pg_temp.told(current_setting('test.nov')::uuid), '{}'::text[], 'a submitted walkthrough tells nobody');

-- A row is about a ticket or a walkthrough, never both or neither.
select throws_ok($$
  insert into public.notifications (kind, walkthrough_id, ticket_id)
  values ('walkthrough_reminder', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '66666666-6666-4666-8666-000000001042') $$,
  '23514', null, 'a reminder names no ticket');
select throws_ok($$
  insert into public.notifications (kind, walkthrough_id) values ('update', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001') $$,
  '23514', null, 'a ticket''s notification names a ticket');

select * from finish();
rollback;

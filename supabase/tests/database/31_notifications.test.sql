-- Who gets told what (OT-45). Every thread event writes one outbox row, and
-- notification_recipients decides who hears, by push and by email.
begin;
select plan(24);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- The newest outbox row for a ticket, as the service sees it.
create function pg_temp.latest(p_ticket uuid) returns uuid language plpgsql as $$
declare
  v uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into v from public.notifications where ticket_id = p_ticket order by seq desc limit 1;
  return v;
end $$;

-- "name:push:email" for each person told about the ticket's newest row.
create function pg_temp.told(p_ticket uuid) returns text[] language plpgsql as $$
declare
  v_id uuid := pg_temp.latest(p_ticket);
  v text[];
begin
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

-- Seed ids: Maya manages Logan Square and opened 1042, which Bert is on. Bert and Chris are
-- Ops everywhere. 1031 is scheduled at Logan Square, opened by Maya with Bert on it.
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1031 '''66666666-6666-4666-8666-000000001031'''
\set fls '''11111111-1111-4111-8111-000000000001'''
\set cat '''33333333-3333-4333-8333-000000000012'''

-- A new ticket goes to Ops, not to whoever opened it.
select pg_temp.login('maya.reyes@example.com');
insert into public.tickets (restaurant_id, category_id, title, created_by)
values ((:fls)::uuid, (:cat)::uuid, 'Notify me', auth.uid());
select set_config('test.ticket', (select id::text from public.tickets where title = 'Notify me'), true);
select is(
  pg_temp.told(current_setting('test.ticket')::uuid),
  array['bert:true:true', 'chris:true:true'],
  'a new ticket goes to every Ops manager, by push and email');
select is((select kind from public.notifications where id = pg_temp.latest(current_setting('test.ticket')::uuid)),
  'new_ticket', 'and the row says what it is');

-- The kind switch stops both, and the email switch stops only email.
select pg_temp.login('chris.novak@example.com');
insert into public.notification_prefs (user_id, kind, enabled) values (auth.uid(), 'new_ticket', false);
select is(pg_temp.told(current_setting('test.ticket')::uuid), array['bert:true:true'],
  'turning a kind off stops it altogether');
select pg_temp.login('chris.novak@example.com');
update public.notification_prefs set kind = 'email' where user_id = auth.uid();
select is(pg_temp.told(current_setting('test.ticket')::uuid), array['bert:true:true', 'chris:true:false'],
  'turning email off leaves push');
select pg_temp.login('chris.novak@example.com');
update public.notification_prefs set enabled = true where user_id = auth.uid();

-- A status change: whoever opened it and whoever is on it, and Ops get their own by email.
select pg_temp.login('bert.velilla@example.com');
select public.set_ticket_status((:t1042)::uuid, 'waiting_parts');
select is(pg_temp.told((:t1042)::uuid), array['bert:false:true', 'maya:true:true'],
  'a status change reaches the manager, and Ops''s own action by email only');
select is((select status_to from public.notifications where id = pg_temp.latest((:t1042)::uuid)), 'waiting_parts',
  'and says what it became');

-- Another Ops manager posts: both are told, and the poster only by email.
select pg_temp.login('chris.novak@example.com');
select public.post_ticket_update((:t1042)::uuid, 'I can cover this');
select is(pg_temp.told((:t1042)::uuid), array['bert:true:true', 'chris:false:true', 'maya:true:true'],
  'an update reaches who opened it and who is on it, and its author by email');

-- A manager posts: their own action gets them nothing, since their inbox isn't the record.
select pg_temp.login('maya.reyes@example.com');
select public.post_ticket_update((:t1042)::uuid, 'Thanks');
select is(pg_temp.told((:t1042)::uuid), array['bert:true:true'],
  'a manager''s own update gets them nothing');

-- An internal note reaches only its author, by email.
select pg_temp.login('bert.velilla@example.com');
select public.post_ticket_update((:t1042)::uuid, 'Quote is high', '{}', true);
select is(pg_temp.told((:t1042)::uuid), array['bert:false:true'], 'an internal note reaches only its author, by email');
select ok((select internal from public.notifications where id = pg_temp.latest((:t1042)::uuid)), 'and is marked internal');

-- Taking a ticket is told by its status, so it adds no row of its own.
select pg_temp.login('bert.velilla@example.com');
select public.set_ticket_status((:t1042)::uuid, 'open');
set local role postgres;
select is(
  (select count(*)::int from public.notifications where ticket_id = (:t1042)::uuid and body is null and status_to = 'open'),
  1, 'a status change that also moves the person is one row');

-- Reopening: its reason joins the reopen, and it goes to Ops like a new ticket.
select pg_temp.login('maya.reyes@example.com');
update public.tickets set status = 'closed', resolution = 'Done' where id = (:t1031)::uuid;
set local role postgres;
select is((select kind from public.notifications where id = pg_temp.latest((:t1031)::uuid)), 'status_change',
  'closing is a status change');
select is((select body from public.notifications where id = pg_temp.latest((:t1031)::uuid)), 'Done',
  'with its comment');
select pg_temp.login('maya.reyes@example.com');
select public.reopen_ticket((:t1031)::uuid, 'It is back');
select is(pg_temp.told((:t1031)::uuid), array['bert:true:true', 'chris:true:true'], 'a reopen goes to every Ops manager');
select is((select count(*)::int from public.notifications where ticket_id = (:t1031)::uuid and kind = 'update'), 0,
  'and the reason is not a second notification');
select is((select body from public.notifications where ticket_id = (:t1031)::uuid and kind = 'reopened'), 'It is back',
  'it is the reopen''s words');

-- Someone deactivated, or no longer covering the restaurant, hears nothing.
set local role postgres;
select set_config('request.jwt.claims', '', true);
update public.profiles set deactivated_at = now() where email = 'chris.novak@example.com';
select is(pg_temp.told((:t1031)::uuid), array['bert:true:true'], 'someone deactivated is not told');
delete from public.memberships where user_id = (select id from public.profiles where email = 'bert.velilla@example.com');
select is(pg_temp.told((:t1031)::uuid), '{}'::text[], 'nor is someone with no scope there');

-- Sending takes each row once.
select set_config('role', 'postgres', true);
update public.notifications set processed_at = now() where processed_at is null and ticket_id <> (:t1042)::uuid;
select ok((select count(*) from public.claim_notifications(100)) > 0, 'waiting rows are claimed');
select is((select count(*)::int from public.claim_notifications(100)), 0, 'and only once');

-- People read only their own deliveries, and never the outbox or the who-gets-what.
insert into public.notification_deliveries (notification_id, user_id, ticket_id, kind, channel, status)
select pg_temp.latest((:t1042)::uuid), p.id, (:t1042)::uuid, 'update', 'email', 'sent'
from public.profiles p where p.email in ('maya.reyes@example.com', 'ari.kim@example.com');
select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.notification_deliveries), 1, 'someone reads only their own deliveries');
select is((select count(*)::int from public.notifications), 0, 'and no outbox');
select throws_ok($$ select public.claim_notifications() $$, '42501', null, 'nobody signed in can claim rows');
select throws_ok(format($$ select * from public.notification_recipients(%L) $$, gen_random_uuid()), '42501', null,
  'or ask who gets what');

select * from finish();
rollback;

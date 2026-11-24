-- OT-169: leadership files tickets. Create tickets is on for leadership by default, so Lee
-- files at any restaurant and posts in any open thread; Lee edits, closes and reopens only
-- the tickets Lee filed, reads and writes no internal note, works no walkthrough and no
-- In-house list, and hears what happens to Lee's own tickets.
begin;
select plan(25);

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

-- "name:push:email" for each person told about the ticket's newest outbox row.
create function pg_temp.told(p_ticket uuid) returns text[] language plpgsql as $$
declare
  v_id uuid;
  v text[];
begin
  perform set_config('role', 'postgres', true);
  select id into v_id from public.notifications where ticket_id = p_ticket order by seq desc limit 1;
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

-- Seed: Porter is …0003; 1042 is Maya's at Logan Square, open; 1028 is closed at Logan Square.
\set porter '''11111111-1111-4111-8111-000000000003'''
\set fridge '''33333333-3333-4333-8333-000000000012'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1028 '''66666666-6666-4666-8666-000000001028'''

-- ---------------------------------------------------------------------------
-- 1. The default, and filing
-- ---------------------------------------------------------------------------

select ok((select allowed from public.rights where role = 'leadership' and user_id is null and key = 'create_tickets'),
  'Create tickets is on for leadership by default');

select pg_temp.login('lee.chen@example.com');
select ok(public.can('create_tickets', (:porter)::uuid), 'so Lee may file at Porter');
select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by)
  values (%L, %L, 'Test: from leadership', auth.uid())
$$, :porter, :fridge), 'Lee files a ticket at a restaurant that is not Lee''s home');
select pg_temp.su();
select set_config('test.lee', (select id::text from public.tickets where title = 'Test: from leadership'), true);
select is((select status::text from public.tickets where id = current_setting('test.lee')::uuid), 'open',
  'and it is open, like a Reporter''s');
select ok('bert:true:true' = any(pg_temp.told(current_setting('test.lee')::uuid)), 'and reaches Ops as a new ticket');

-- ---------------------------------------------------------------------------
-- 2. Lee hears what happens to Lee's own ticket, and nothing about anyone else's
-- ---------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select public.set_ticket_status(current_setting('test.lee')::uuid, 'in_progress');
select ok('lee:true:true' = any(pg_temp.told(current_setting('test.lee')::uuid)),
  'Lee hears that Ops is on it, by push and email');
select pg_temp.login('bert.velilla@example.com');
select public.post_ticket_update(current_setting('test.lee')::uuid, 'Coming Thursday');
select ok('lee:true:true' = any(pg_temp.told(current_setting('test.lee')::uuid)), 'and Ops'' update');
select pg_temp.login('bert.velilla@example.com');
select public.post_ticket_update(current_setting('test.lee')::uuid, 'Quote is high', '{}', true);
select ok(not ('lee:true:true' = any(pg_temp.told(current_setting('test.lee')::uuid))), 'but not an internal note');
select pg_temp.login('bert.velilla@example.com');
select public.set_ticket_status((:t1042)::uuid, 'waiting_parts');
select ok(not exists (select 1 from unnest(pg_temp.told((:t1042)::uuid)) x where x like 'lee:%'),
  'and nothing of a ticket Lee did not file');

-- ---------------------------------------------------------------------------
-- 3. Posting on anyone's open ticket, never an internal note
-- ---------------------------------------------------------------------------

select pg_temp.login('lee.chen@example.com');
select lives_ok(format($$ select public.post_ticket_update(%L, 'Saw this on my visit') $$, :t1042),
  'Lee posts on a ticket Maya filed');
select pg_temp.su();
select ok(exists (select 1 from public.ticket_updates where ticket_id = (:t1042)::uuid and body = 'Saw this on my visit'),
  'and the message is there');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.post_ticket_update(%L, 'Between us', '{}', true) $$, :t1042), '42501', null,
  'but writes no internal note');
select is((select count(*)::int from public.ticket_updates where internal), 0, 'and reads none');

-- ---------------------------------------------------------------------------
-- 4. Editing, closing and reopening: only Lee's own
-- ---------------------------------------------------------------------------

update public.tickets set title = 'Renamed by Lee' where id = (:t1042)::uuid;
update public.tickets set status = 'closed' where id = (:t1042)::uuid;
select pg_temp.su();
select isnt((select title from public.tickets where id = (:t1042)::uuid), 'Renamed by Lee', 'Lee renames no one else''s ticket');
select isnt((select status::text from public.tickets where id = (:t1042)::uuid), 'closed', 'nor closes it');

select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.reopen_ticket(%L, 'Still broken') $$, :t1028), 'P0002', null,
  'nor reopens one');

update public.tickets set title = 'Test: from leadership, clearer' where id = current_setting('test.lee')::uuid;
select pg_temp.su();
select is((select title from public.tickets where id = current_setting('test.lee')::uuid), 'Test: from leadership, clearer',
  'Lee edits Lee''s own ticket');
select pg_temp.login('lee.chen@example.com');
update public.tickets set status = 'closed' where id = current_setting('test.lee')::uuid;
select pg_temp.su();
select is((select status::text from public.tickets where id = current_setting('test.lee')::uuid), 'closed', 'and closes it');
select pg_temp.login('lee.chen@example.com');
select lives_ok(format($$ select public.reopen_ticket(%L, 'Came back') $$, current_setting('test.lee')), 'and reopens it');
select pg_temp.su();
select is((select status::text from public.tickets where id = current_setting('test.lee')::uuid), 'reopened', 'with its badge');

select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.set_ticket_status(%L, 'in_progress') $$, current_setting('test.lee')), 'P0002', null,
  'but sets no status beyond what a Reporter can');

-- A Reporter still changes any ticket at their own restaurant.
select pg_temp.login('maya.reyes@example.com');
update public.tickets set title = 'Renamed by Maya' where id = (:t1042)::uuid;
select pg_temp.su();
select is((select title from public.tickets where id = (:t1042)::uuid), 'Renamed by Maya', 'a Reporter''s edits are as before');

-- ---------------------------------------------------------------------------
-- 5. No walkthrough and no In-house list
-- ---------------------------------------------------------------------------

select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$
  insert into public.inhouse_fixes (restaurant_id, title, created_by) values (%L, 'From Lee', auth.uid())
$$, :porter), '42501', null, 'Lee adds no in-house task');
select pg_temp.su();
select set_config('test.fix', (select id::text from public.inhouse_fixes where title = 'Replace 2 bulbs over booths 4–6'), true);
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$ select public.set_inhouse_fix_done(%L, true) $$, current_setting('test.fix')), '42501', null,
  'checks none off');
select throws_ok(format($$ select public.delete_inhouse_fix(%L) $$, current_setting('test.fix')), '42501', null,
  'and deletes none');

select * from finish();
rollback;

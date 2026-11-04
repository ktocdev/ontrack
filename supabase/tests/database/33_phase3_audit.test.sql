-- Fixes from the Phase 3 security audit (OT-55): writing in a thread needs scope and a
-- right there, the record of closing and reopening is the database's, a reopen has its
-- reason, links stay at the restaurant, a message's time is now, the endpoint guard is
-- anchored.
begin;
select plan(35);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- The database owner with nobody signed in, as the seed and migrations run.
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids (supabase/seed.sql): Maya manages Logan Square (r1), where 1039 and 1042 are
-- open and 1028 is closed. Dana manages Porter (r3), where 1038 is open and 1022 closed.
-- 1033 is open at Ranalli's (r4). Chris is Ops at every restaurant.
\set r1 '''11111111-1111-4111-8111-000000000001'''
\set r4 '''11111111-1111-4111-8111-000000000004'''
\set t1039 '''66666666-6666-4666-8666-000000001039'''
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1028 '''66666666-6666-4666-8666-000000001028'''
\set t1038 '''66666666-6666-4666-8666-000000001038'''
\set t1033 '''66666666-6666-4666-8666-000000001033'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set chris '''22222222-2222-4222-8222-000000000004'''
\set dana '''22222222-2222-4222-8222-000000000007'''
\set wt_r2 '''aaaaaaaa-aaaa-4aaa-8aaa-000000000002'''
\set lighting '''33333333-3333-4333-8333-000000000001'''

-- ---------------------------------------------------------------------------
-- 1. Writing in a thread needs scope and a right there
-- ---------------------------------------------------------------------------

select pg_temp.login('admin@example.com');
select throws_ok(format($$
  insert into public.ticket_updates (ticket_id, author_id, body) values (%L, auth.uid(), 'from the admin')
$$, :t1039), '42501', null, 'an admin reads a thread but writes nothing in it');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id, owner) values ('ticket-photos', %L || '/admin.jpg', auth.uid()::text, auth.uid())
$$, :t1039), '42501', null, 'nor uploads a file under the ticket');

select pg_temp.su();
insert into public.rights (user_id, key, allowed) values ((:dana)::uuid, 'see_all_tickets', true);
select pg_temp.login('dana.ortiz@example.com');
select is((select count(*)::int from public.tickets where id = (:t1039)::uuid), 1, 'a manager with see_all_tickets reads another restaurant''s ticket');
select throws_ok(format($$
  select public.post_ticket_update(%L, 'from Porter', '{}', false)
$$, :t1039), '42501', null, 'but posts nothing on it');
select throws_ok(format($$
  insert into public.ticket_photos (ticket_id, path, created_by) values (%L, %L || '/dana.jpg', auth.uid())
$$, :t1039, :t1039), '42501', null, 'and adds no photo to it');
select lives_ok(format($$
  select public.post_ticket_update(%L, 'at Porter', '{}', false)
$$, :t1038), 'while a ticket at their own restaurant still takes their update');

select pg_temp.su();
update public.memberships set restaurant_id = (:r4)::uuid where user_id = (:chris)::uuid;
select pg_temp.login('chris.novak@example.com');
select throws_ok(format($$
  select public.post_ticket_update(%L, 'Ops note', '{}', true)
$$, :t1039), '42501', null, 'an Ops manager narrowed to one restaurant writes no internal note elsewhere');
select lives_ok(format($$
  select public.post_ticket_update(%L, 'Ops note', '{}', true)
$$, :t1033), 'and still does at the restaurant they cover');
select pg_temp.su();
update public.memberships set restaurant_id = null where user_id = (:chris)::uuid;

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id, owner) values ('ticket-photos', %L || '/late.jpg', auth.uid()::text, auth.uid())
$$, :t1028), '42501', null, 'a manager uploads nothing under a closed ticket');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id, owner) values ('ticket-photos', %L || '/new.jpg', auth.uid()::text, auth.uid())
$$, :t1039), 'and still uploads under an open one');
select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$
  insert into storage.objects (bucket_id, name, owner_id, owner) values ('ticket-photos', %L || '/ops.jpg', auth.uid()::text, auth.uid())
$$, :t1028), 'Ops still uploads under a closed ticket');

-- ---------------------------------------------------------------------------
-- 2. The record of closing and reopening is the database's
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$ update public.tickets set reopen_count = 99 where id = %L $$, :t1039),
  '42501', null, 'a manager cannot set the reopen count');
select throws_ok(format($$ update public.tickets set reopened_at = now() where id = %L $$, :t1039),
  '42501', null, 'nor when it reopened');
select throws_ok(format($$ update public.tickets set last_closed_at = now() - interval '400 days' where id = %L $$, :t1039),
  '42501', null, 'nor when it last closed');
select throws_ok(format($$ update public.tickets set closed_by = %L where id = %L $$, :chris, :t1039),
  '42501', null, 'nor who closed it');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ update public.tickets set closed_at = now() - interval '400 days' where id = %L $$, :t1028),
  '42501', null, 'Ops cannot move when a ticket closed either');
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$ update public.tickets set status = 'closed', resolution = 'Fixed' where id = %L $$, :t1039),
  'closing still works');
select ok((select closed_by = (:maya)::uuid and reopen_count = 0 from public.tickets where id = (:t1039)::uuid),
  'and the guard still writes the record itself');

-- ---------------------------------------------------------------------------
-- 3. A reopen has its reason
-- ---------------------------------------------------------------------------

select throws_ok(format($$ update public.tickets set status = 'open' where id = %L $$, :t1028),
  '42501', null, 'a manager cannot reopen with a bare status change');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ update public.tickets set status = 'in_progress' where id = %L $$, :t1028),
  '42501', null, 'nor can Ops bring a closed ticket back that way');
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$ select public.reopen_ticket(%L, 'Still leaking') $$, :t1028),
  'Reopen, with a reason, still works');
select is((select status::text from public.tickets where id = (:t1028)::uuid), 'reopened', 'the ticket is reopened');
select is(
  (select body from public.ticket_updates where ticket_id = (:t1028)::uuid and kind = 'message' order by created_at desc limit 1),
  'Still leaking', 'with the reason in the thread');

-- ---------------------------------------------------------------------------
-- 4. Links stay at the restaurant, and only Ops changes where a ticket came from
-- ---------------------------------------------------------------------------

select throws_ok(format($$ update public.tickets set parent_ticket_id = %L where id = %L $$, :t1038, :t1042),
  '42501', null, 'a manager cannot change a ticket''s parent');
select throws_ok(format($$ update public.tickets set source = 'reported' where id = %L $$, :t1042),
  '42501', null, 'nor its source');
select throws_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by, parent_ticket_id)
  values (%L, %L, 'Linked elsewhere', auth.uid(), %L)
$$, :r1, :lighting, :t1038), '23514', null, 'a new ticket cannot link to another restaurant''s ticket');
select throws_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by, walkthrough_id)
  values (%L, %L, 'From elsewhere', auth.uid(), %L)
$$, :r1, :lighting, :wt_r2), '23514', null, 'nor to another restaurant''s walkthrough');
select lives_ok(format($$
  insert into public.tickets (restaurant_id, category_id, title, created_by, parent_ticket_id)
  values (%L, %L, 'Linked here', auth.uid(), %L)
$$, :r1, :lighting, :t1042), 'a link to a ticket at the same restaurant is fine');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$ update public.tickets set parent_ticket_id = %L where id = %L $$, :t1038, :t1042),
  '23514', null, 'Ops cannot link across restaurants either');

-- ---------------------------------------------------------------------------
-- 5. A message's time and meta are the database's
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
insert into public.ticket_updates (ticket_id, author_id, body, meta, created_at)
values ((:t1042)::uuid, auth.uid(), 'Backdated?', '{"from": "open", "to": "closed"}', '2020-01-01');
select ok(
  (select created_at > now() - interval '1 minute' and meta = '{}'::jsonb
   from public.ticket_updates where ticket_id = (:t1042)::uuid and body = 'Backdated?'),
  'a message is stamped now, with no meta, whatever the client sent');

-- ---------------------------------------------------------------------------
-- 6. The endpoint guard is anchored
-- ---------------------------------------------------------------------------

select throws_ok($$ select public.save_push_subscription(E'https://fcm.googleapis.com/x\nHost: evil', 'a', 'b') $$,
  '23514', null, 'an endpoint with a newline after the host is refused');
select throws_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/x y', 'a', 'b') $$,
  '23514', null, 'so is one with a space');
select lives_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/abc-DEF_123:xyz=', 'a', 'b') $$,
  'a real endpoint is still saved');

-- And the new functions are closed to anon, as 18_anon_functions checks for every one.
select ok(not has_function_privilege('anon', 'public.can_post_on_ticket(uuid)', 'execute'), 'can_post_on_ticket is closed to anon');
select ok(has_function_privilege('authenticated', 'public.can_post_on_ticket(uuid)', 'execute'), 'and open to signed-in people');

select * from finish();
rollback;

-- Ticket photos (OT-28): a file follows its note, a message and its photos go in one
-- step, a photo row stays on its own ticket, and leadership writes nothing.
begin;
select plan(16);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): 1042 is at Maya's restaurant, 1045 at Ari's.
\set t1042 '''66666666-6666-4666-8666-000000001042'''
\set t1045 '''66666666-6666-4666-8666-000000001045'''
\set bert '''22222222-2222-4222-8222-000000000003'''

-- ---------------------------------------------------------------------------
-- A message with a photo, in one step.
-- ---------------------------------------------------------------------------
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  select public.post_ticket_update('%1$s', 'Here it is', array['%1$s/one.jpg', '%1$s/two.jpg'])
$$, :t1042), 'a manager posts a message with photos');
select is(
  (select count(*)::int from public.ticket_photos p join public.ticket_updates u on u.id = p.update_id
   where u.body = 'Here it is'),
  2, 'both photos hang on the message');
select lives_ok(format($$ select public.post_ticket_update('%1$s', '', array['%1$s/only.jpg']) $$, :t1042),
  'a message may be only a photo');
select throws_ok(format($$ select public.post_ticket_update('%s', '   ') $$, :t1042), '22023', null,
  'but not nothing at all');

select throws_ok(format($$ select public.post_ticket_update('%1$s', 'Sneaky', array['%2$s/theirs.jpg']) $$, :t1042, :t1045),
  '23514', null, 'a photo must be in its own ticket''s folder');
select is(
  (select count(*)::int from public.ticket_updates where body = 'Sneaky'),
  0, 'and the message goes with it, so a failure leaves neither');

select throws_ok(format($$ select public.post_ticket_update('%1$s', 'Not mine', array['%1$s/x.jpg']) $$, :t1045),
  '42501', null, 'a manager cannot post on another restaurant''s ticket');

-- A photo cannot be hung on someone else's message.
select throws_ok(format($$
  insert into public.ticket_photos (ticket_id, update_id, path, created_by)
  select '%1$s', u.id, '%1$s/hung.jpg', auth.uid()
  from public.ticket_updates u
  where u.ticket_id = '%1$s' and u.kind = 'message' and u.author_id = '%2$s' limit 1
$$, :t1042, :bert), '42501', null, 'a photo cannot be added to someone else''s message');

-- ---------------------------------------------------------------------------
-- A photo on an internal note stays with the note.
-- ---------------------------------------------------------------------------
select pg_temp.login('bert.velilla@example.com');
insert into public.ticket_updates (ticket_id, author_id, body, internal)
values ((:t1042)::uuid, (:bert)::uuid, 'Quote photo', true);
select lives_ok(format($$
  insert into public.ticket_photos (ticket_id, update_id, path, created_by)
  select '%1$s', u.id, '%1$s/internal.jpg', auth.uid()
  from public.ticket_updates u where u.body = 'Quote photo'
$$, :t1042), 'ops adds a photo to an internal note');
select ok(public.can_see_ticket_photo((:t1042) || '/internal.jpg'), 'and ops can open it');

select pg_temp.login('maya.reyes@example.com');
select ok(not public.can_see_ticket_photo((:t1042) || '/internal.jpg'),
  'the restaurant''s manager cannot, though the ticket is theirs');
select ok(public.can_see_ticket_photo((:t1042) || '/one.jpg'), 'they can open a photo on a message');

select pg_temp.login('ari.kim@example.com');
select ok(not public.can_see_ticket_photo((:t1042) || '/one.jpg'), 'another restaurant''s manager cannot');

-- ---------------------------------------------------------------------------
-- Leadership reads and does not write.
-- ---------------------------------------------------------------------------
select pg_temp.login('lee.chen@example.com');
select ok(public.can_see_ticket_photo((:t1042) || '/one.jpg'), 'leadership can open a photo');
select throws_ok(format($$ select public.post_ticket_update('%s', 'Leadership here') $$, :t1042), '42501', null,
  'leadership cannot post a message');
select throws_ok(format($$
  insert into public.ticket_photos (ticket_id, path, created_by) values ('%1$s', '%1$s/lee.jpg', auth.uid())
$$, :t1042), '42501', null, 'or add a photo');

select * from finish();
rollback;

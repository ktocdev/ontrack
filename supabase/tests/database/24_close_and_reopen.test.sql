-- Close and reopen (OT-29): a manager closes with an optional comment, reopens with a
-- required reason inside 30 days, and a closed ticket takes nothing new from them.
begin;
select plan(17);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): Maya manages Logan Square, 1039 is open there and
-- 0911 was closed in May. 1045 is at Ari's restaurant.
\set t1039 '''66666666-6666-4666-8666-000000001039'''
\set t0911 '''66666666-6666-4666-8666-000000000911'''
\set t1045 '''66666666-6666-4666-8666-000000001045'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set oven '''44444444-4444-4444-8444-000000000002'''

select pg_temp.login('maya.reyes@example.com');

-- Editing a ticket on a unit retired since it was linked.
select set_config('role', 'postgres', true);
update public.equipment set retired_at = now() where id = (:oven)::uuid;
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$
  update public.tickets set description = 'Still erroring', equipment_id = '%s' where id = '%s'
$$, :oven, :t1039), 'a ticket saves with a unit retired since it was linked');
select set_config('role', 'postgres', true);
update public.equipment set retired_at = null where id = (:oven)::uuid;
select pg_temp.login('maya.reyes@example.com');

-- Closing, with a comment.
select lives_ok(format($$
  update public.tickets set status = 'closed', resolution = 'Reset fixed it' where id = '%s'
$$, :t1039), 'a manager closes their ticket with a comment');
select is((select resolution from public.tickets where id = (:t1039)::uuid), 'Reset fixed it', 'the comment is kept');
select ok((select closed_at is not null and closed_by = (:maya)::uuid from public.tickets where id = (:t1039)::uuid),
  'and the database says who and when');
select is(
  (select body from public.ticket_updates where ticket_id = (:t1039)::uuid and kind = 'closed'),
  'Reset fixed it', 'the thread records it');

-- Closed takes nothing new from a manager.
select throws_ok(format($$ select public.post_ticket_update('%s', 'One more thing') $$, :t1039), '42501', null,
  'a manager cannot post on a closed ticket');
select throws_ok(format($$
  insert into public.ticket_photos (ticket_id, path, created_by) values ('%1$s', '%1$s/late.jpg', auth.uid())
$$, :t1039), '42501', null, 'or add a photo to one');
select throws_ok(format($$ update public.tickets set description = 'Changed my mind' where id = '%s' $$, :t1039),
  '42501', null, 'or edit one');

-- Reopening.
select throws_ok(format($$ select public.reopen_ticket('%s', '   ') $$, :t1039), '22023', null, 'a reopen needs a reason');
select is((select status::text from public.tickets where id = (:t1039)::uuid), 'closed', 'and stays closed without one');

select lives_ok(format($$ select public.reopen_ticket('%1$s', 'Error is back', array['%1$s/back.jpg']) $$, :t1039),
  'a manager reopens within 30 days, with a reason and a photo');
select is((select status::text from public.tickets where id = (:t1039)::uuid), 'reopened', 'the ticket is Reopened');
select is(
  (select array_agg(kind::text || coalesce(':' || nullif(body, ''), '') order by created_at, kind)
   from (select kind, body, created_at from public.ticket_updates
         where ticket_id = (:t1039)::uuid and kind in ('reopened', 'message') and body is distinct from 'x') u
   where kind = 'message' or kind = 'reopened'),
  array['message:Error is back', 'reopened'],
  'the thread has the Reopened line and the reason');
select is(
  (select count(*)::int from public.ticket_photos where path = (:t1039) || '/back.jpg'),
  1, 'and the photo');

select throws_ok(format($$ select public.reopen_ticket('%s', 'Again') $$, :t1039), 'P0002', null,
  'an open ticket cannot be reopened');

select throws_ok(format($$ select public.reopen_ticket('%s', 'Too late') $$, :t0911), '42501', null,
  'past 30 days a manager cannot reopen');

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$ select public.reopen_ticket('%s', 'Not mine') $$, :t1045), 'P0002', null,
  'another restaurant''s ticket is not there to reopen');

select * from finish();
rollback;

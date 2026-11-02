-- Internal notes (OT-40): Ops writes them, with photos, and nobody at the restaurant
-- can read them or their photos.
begin;
select plan(11);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Seed ids (supabase/seed.sql): 1047 is open at Porter, where Dana is the manager.
\set t1047 '''66666666-6666-4666-8666-000000001047'''

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$
  select public.post_ticket_update('%1$s', 'Quote is high', array['%1$s/note.jpg'], true)
$$, :t1047), 'Ops posts an internal note with a photo');
select ok(
  (select internal from public.ticket_updates where ticket_id = (:t1047)::uuid and body = 'Quote is high'),
  'and it is internal');
select is(
  (select count(*)::int from public.ticket_photos p
   join public.ticket_updates u on u.id = p.update_id
   where p.ticket_id = (:t1047)::uuid and u.body = 'Quote is high'),
  1, 'with its photo on it');
select lives_ok(format($$ select public.post_ticket_update('%s', 'Tech booked') $$, :t1047),
  'an update is visible by default');
select ok(
  not (select internal from public.ticket_updates where ticket_id = (:t1047)::uuid and body = 'Tech booked'),
  'and not internal');

select pg_temp.login('chris.novak@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = (:t1047)::uuid and body = 'Quote is high'),
  1, 'another Ops manager reads the note');

select pg_temp.login('dana.ortiz@example.com');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = (:t1047)::uuid and body = 'Quote is high'),
  0, 'the restaurant''s manager does not');
select is(
  (select count(*)::int from public.ticket_photos where ticket_id = (:t1047)::uuid and path = (:t1047) || '/note.jpg'),
  0, 'or its photo');
select is(
  (select count(*)::int from public.ticket_updates where ticket_id = (:t1047)::uuid and body = 'Tech booked'),
  1, 'but does read the update');

select throws_ok(format($$ select public.post_ticket_update('%s', 'Sneaky', '{}', true) $$, :t1047), '42501', null,
  'a manager cannot write an internal note');
select lives_ok(format($$ select public.post_ticket_update('%s', 'Thanks') $$, :t1047),
  'and still posts an update');

select * from finish();
rollback;

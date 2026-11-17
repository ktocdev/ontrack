-- Rotations (OT-126). A rotation is a cycle of months, each with its checklist; restaurants
-- follow the group's unless they are on another; the month's walkthrough opens with the
-- checklist the cycle gives it. Only the functions change them, for someone holding
-- set_walkthrough_schedule, and each change is logged.
begin;
select plan(37);

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
\set porter '''11111111-1111-4111-8111-000000000003'''
\set ranallis '''11111111-1111-4111-8111-000000000004'''
\set full '''88888888-8888-4888-8888-000000000001'''
\set kitchen '''88888888-8888-4888-8888-000000000002'''
\set bar '''88888888-8888-4888-8888-000000000003'''
\set dining '''88888888-8888-4888-8888-000000000004'''
\set storage '''88888888-8888-4888-8888-000000000005'''
\set own '''bbbbbbbb-bbbb-4bbb-8bbb-000000000001'''

select id as grp from public.walkthrough_rotations where is_group
\gset

-- ---------------------------------------------------------------------------
-- The cycle
-- ---------------------------------------------------------------------------

select is(public.restaurant_rotation(:logan), :'grp'::uuid, 'Logan Square follows the group''s rotation');
select is(public.restaurant_rotation(:ranallis), :own::uuid, 'Ranalli''s has its own');
select is(public.rotation_template(:'grp', '2026-11-01'), :kitchen::uuid, 'the group''s November is A, Kitchen + Exterior');
select is(public.rotation_template(:'grp', '2026-10-01'), :full::uuid, 'October is B, the full walkthrough');
select is(public.rotation_template(:'grp', '2025-12-01'), :full::uuid, 'months before the start follow the cycle back');
select is(public.rotation_template(:own, '2027-02-01'), :dining::uuid, 'Ranalli''s February 2027 is its second month');

-- Opening a month takes each restaurant's checklist and due day from its rotation.
update public.walkthrough_rotations set due_day = 10 where id = :own;
select is(public.open_walkthroughs('2027-02-01'), 4, 'February 2027 opens for the four restaurants');
select results_eq(
  $$select r.name, w.template_id, w.due_on from public.walkthroughs w join public.restaurants r on r.id = w.restaurant_id
    where w.period = '2027-02-01' order by r.sort_order$$,
  format($$values ('Federale’s Logan Square'::text, %L::uuid, '2027-02-28'::date), ('Federale’s West Loop', %L, '2027-02-28'),
                  ('Porter', %L, '2027-02-28'), ('Ranalli’s Logan Square', %L, '2027-02-10')$$, :full, :full, :full, :dining),
  'each with its rotation''s checklist and due day'
);

-- Reminders go by the restaurant's rotation too.
update public.walkthrough_rotations set reminder_days = '{3}' where is_group;
select public.queue_walkthrough_reminders('2027-02-25');
select results_eq(
  $$select r.name, n.days_before from public.notifications n join public.walkthroughs w on w.id = n.walkthrough_id
    join public.restaurants r on r.id = w.restaurant_id where w.period = '2027-02-01' order by r.sort_order$$,
  $$values ('Federale’s Logan Square'::text, 3), ('Federale’s West Loop', 3), ('Porter', 3)$$,
  'three days before, for the restaurants on the group''s rotation; Ranalli''s was due on the 10th'
);

-- ---------------------------------------------------------------------------
-- Changing a rotation
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.save_rotation(null, 'Mine', array[%L]::uuid[], '2026-12-01', null, '{7}')$$, :kitchen),
  '42501', null, 'a Reporter can''t make a rotation');
select throws_ok(format($$select public.set_restaurant_rotation(%L, %L)$$, :logan, :own),
  '42501', null, 'nor move their restaurant onto one');
select throws_ok($$insert into public.walkthrough_rotations (name) values ('Sneaky')$$,
  '42501', null, 'and nobody writes a rotation directly');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$select public.save_rotation(null, 'Mine', array[%L]::uuid[], '2026-12-01', null, '{7}')$$, :kitchen),
  '42501', null, 'nor can leadership');

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$select public.save_rotation(null, '  Federale''s  ', array[%L, %L]::uuid[], '2026-12-01', 25, '{2,7,7}')$$, :bar, :full),
  'Ops makes a rotation');
select id as fed from public.walkthrough_rotations where name = 'Federale''s'
\gset
select results_eq(
  format($$select name, starts_on, due_day, reminder_days from public.walkthrough_rotations where id = %L$$, :'fed'),
  $$values ('Federale''s'::text, '2026-12-01'::date, 25, '{7,2}'::int[])$$,
  'trimmed, with each reminder once, furthest first'
);
select results_eq(
  format($$select position, template_id from public.walkthrough_rotation_months where rotation_id = %L order by position$$, :'fed'),
  format($$values (0, %L::uuid), (1, %L::uuid)$$, :bar, :full),
  'its months in the order given'
);
select pg_temp.su();
select is(
  (select meta ->> 'name' from public.audit_log where action = 'rotation.save' order by id desc limit 1),
  'Federale''s', 'and it is logged');
select pg_temp.login('bert.velilla@example.com');

select throws_ok(format($$select public.save_rotation(null, 'GROUP', array[%L]::uuid[], '2026-12-01', null, '{}')$$, :kitchen),
  '23505', null, 'a name another rotation has is refused, whatever its case');
select throws_ok($$select public.save_rotation(null, 'Empty', '{}'::uuid[], '2026-12-01', null, '{}')$$,
  '22023', null, 'a rotation has at least one month');
select throws_ok(format($$select public.save_rotation(null, 'Long', array_fill(%L::uuid, array[13]), '2026-12-01', null, '{}')$$, :kitchen),
  '22023', null, 'and at most twelve');
select throws_ok(format($$select public.save_rotation(null, 'Mid', array[%L]::uuid[], '2026-12-02', null, '{}')$$, :kitchen),
  '22023', null, 'it starts on the first of a month');
select throws_ok(format($$select public.save_rotation(null, 'Late', array[%L]::uuid[], '2026-12-01', 31, '{}')$$, :kitchen),
  '22023', null, 'the due day is 1 to 28, or the last');
select throws_ok(format($$select public.save_rotation(null, 'Early', array[%L]::uuid[], '2026-12-01', null, '{45}')$$, :kitchen),
  '22023', null, 'reminders are 0 to 31 days before');
select throws_ok(format($$select public.save_rotation(%L, 'Ghost', array[%L]::uuid[], '2026-12-01', null, '{}')$$,
  '00000000-0000-4000-8000-000000000000', :kitchen), 'P0002', null, 'a rotation that doesn''t exist isn''t saved');

-- A checklist turned off goes on no new month; one already in the rotation may stay.
select pg_temp.su();
update public.walkthrough_templates set active = false where id = :storage;
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.save_rotation(%L, 'Federale''s', array[%L, %L]::uuid[], '2026-12-01', null, '{}')$$, :'fed', :bar, :storage),
  '22023', null, 'a checklist turned off isn''t added');
select lives_ok(format($$select public.save_rotation(%L, 'Ranalli’s', array[%L, %L, %L]::uuid[], '2026-01-01', 10, '{7,2}')$$, :own, :bar, :dining, :storage),
  'while Ranalli''s keeps the one it has');

-- ---------------------------------------------------------------------------
-- Which restaurants use it
-- ---------------------------------------------------------------------------

select lives_ok(format($$select public.set_restaurant_rotation(%L, %L)$$, :porter, :'fed'), 'Ops puts Porter on it');
select pg_temp.su();
select is(public.restaurant_rotation(:porter), :'fed'::uuid, 'so Porter follows it');
select is(
  (select meta ->> 'to' from public.audit_log where action = 'rotation.restaurant' order by id desc limit 1),
  :'fed', 'logged, with where it went');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.delete_rotation(%L)$$, :'fed'), '23503', null, 'a rotation in use isn''t deleted');
select throws_ok(format($$select public.delete_rotation(%L)$$, :'grp'), 'P0002', null, 'nor ever the group''s');

select lives_ok(format($$select public.set_restaurant_rotation(%L, null)$$, :porter), 'Porter goes back to the group''s');
select is((select count(*)::int from public.restaurant_rotations where restaurant_id = :porter), 0,
  'which keeps no row of its own');
select lives_ok(format($$select public.delete_rotation(%L)$$, :'fed'), 'then the rotation nobody uses is deleted');
select is((select count(*)::int from public.walkthrough_rotation_months where rotation_id = :'fed'), 0,
  'with its months');

-- An Ops person narrowed to one restaurant moves only that one.
select pg_temp.su();
update public.memberships set restaurant_id = :logan where user_id = (select id from public.profiles where email = 'chris.novak@example.com');
select pg_temp.login('chris.novak@example.com');
select throws_ok(format($$select public.set_restaurant_rotation(%L, %L)$$, :porter, :own),
  '42501', null, 'Ops at Logan Square can''t move Porter');
select lives_ok(format($$select public.set_restaurant_rotation(%L, %L)$$, :logan, :own), 'but moves Logan Square');

select * from finish();
rollback;

-- The Ops overview's backend (OT-127): v_walkthrough_summary says how each walkthrough
-- stands, for the restaurants in the caller's scope; send_walkthrough_reminder lets Ops
-- remind a restaurant, once an hour, logged; the walkthrough keeps when the last went.
begin;
select plan(24);

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

-- Who is told about a walkthrough's newest reminder, as "name:push:email".
create function pg_temp.told(p_walkthrough uuid) returns text[] language plpgsql as $$
declare
  v_id uuid;
  v text[];
begin
  perform pg_temp.su();
  select id into v_id from public.notifications where walkthrough_id = p_walkthrough order by seq desc limit 1;
  select coalesce(array_agg(split_part(r.email, '.', 1) || ':' || r.push || ':' || r.send_email order by r.email), '{}')
  into v from public.notification_recipients(v_id) r;
  return v;
end $$;

\set logan '''11111111-1111-4111-8111-000000000001'''
\set westloop '''11111111-1111-4111-8111-000000000002'''
\set porter '''11111111-1111-4111-8111-000000000003'''
\set sep '''aaaaaaaa-aaaa-4aaa-8aaa-000000000005'''
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set bert '''22222222-2222-4222-8222-000000000003'''

-- A month well ahead, so how it stands doesn't depend on today.
select public.open_walkthroughs('2099-01-01');
select id as jan from public.walkthroughs where restaurant_id = :logan and period = '2099-01-01'
\gset
select id as jan_wl from public.walkthroughs where restaurant_id = :westloop and period = '2099-01-01'
\gset
select id as jan_porter from public.walkthroughs where restaurant_id = :porter and period = '2099-01-01'
\gset

-- ---------------------------------------------------------------------------
-- How each stands
-- ---------------------------------------------------------------------------

select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from public.v_walkthrough_summary where period = '2026-10-01'), 4,
  'Ops sees October for the four restaurants');
select pg_temp.login('maya.reyes@example.com');
select is((select count(*)::int from public.v_walkthrough_summary where period = '2026-10-01'), 1,
  'a Reporter sees only their own restaurant''s');

select pg_temp.login('bert.velilla@example.com');
select is((select standing from public.v_walkthrough_summary where walkthrough_id = :sep), 'on_time',
  'September, submitted on the 24th, was on time');
select is((select standing from public.v_walkthrough_summary where walkthrough_id = :oct), 'missed',
  'October, still open after the 31st, was missed');
select is((select tickets from public.v_walkthrough_summary where walkthrough_id = :oct),
  2, 'October counts its two tickets');

select results_eq(
  format($$select standing, template_short_name, total, done, days_left > 0 from public.v_walkthrough_summary where walkthrough_id = %L$$, :'jan'),
  $$values ('not_started'::text, 'Kitchen + Exterior'::text, 50, 0, true)$$,
  'January 2099: not started, month A''s checklist, 48 items and Q1''s two tasks, days to go'
);

select pg_temp.su();
update public.walkthroughs set started_by = '22222222-2222-4222-8222-000000000001' where id = :'jan';
select pg_temp.login('bert.velilla@example.com');
select is((select standing from public.v_walkthrough_summary where walkthrough_id = :'jan'), 'in_progress',
  'started, it is in progress');

-- Late or on time goes by the due day in the group's time zone.
select pg_temp.su();
update public.walkthroughs w
set status = 'submitted',
    submitted_at = (w.due_on + time '23:30') at time zone (select time_zone from public.group_settings)
where id = :'jan_wl';
select is((select standing from public.v_walkthrough_summary where walkthrough_id = :'jan_wl'), 'on_time',
  'submitted late in the evening of its due day, it is on time');
update public.walkthroughs w
set submitted_at = (w.due_on + 1 + time '00:30') at time zone (select time_zone from public.group_settings)
where id = :'jan_wl';
select is((select standing from public.v_walkthrough_summary where walkthrough_id = :'jan_wl'), 'late',
  'just after midnight, late');

-- ---------------------------------------------------------------------------
-- Send reminder
-- ---------------------------------------------------------------------------

select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, :'jan'), 'P0002', null,
  'a Reporter can''t send one');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, :'jan'), 'P0002', null,
  'nor can leadership');
select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, :sep), '22023', null,
  'a submitted walkthrough takes none');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, gen_random_uuid()), 'P0002', null,
  'nor one that doesn''t exist');

select lives_ok(format($$select public.send_walkthrough_reminder(%L)$$, :'jan'), 'Ops sends Logan Square a reminder');
select results_eq(
  format($$select last_reminded_by, last_reminded_at is not null from public.v_walkthrough_summary where walkthrough_id = %L$$, :'jan'),
  format($$values (%L::uuid, true)$$, :bert),
  'the walkthrough says who sent the last one, and when'
);
-- Ops' email covers their own actions (OT-45), so Bert has a copy by email, and no push.
select is(pg_temp.told(:'jan'), array['bert:false:true', 'maya:true:true'],
  'it goes to the restaurant''s Reporter, as the job''s does, and a copy to Bert''s email');
select is(
  (select actor_id from public.notifications where walkthrough_id = :'jan' order by seq desc limit 1),
  :bert::uuid, 'naming who sent it');
select is(
  (select count(*)::int from public.audit_log where action = 'walkthrough.remind' and actor_id = :bert),
  1, 'and it is logged');

select pg_temp.login('bert.velilla@example.com');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, :'jan'), '55000', null,
  'a second within the hour is refused');
select is_empty($$update public.walkthroughs set last_reminded_at = null returning 1$$,
  'nobody writes when the last went');

-- Ops narrowed to Logan Square reminds only Logan Square.
select pg_temp.su();
update public.memberships set restaurant_id = :logan where user_id = (select id from public.profiles where email = 'chris.novak@example.com');
select pg_temp.login('chris.novak@example.com');
select throws_ok(format($$select public.send_walkthrough_reminder(%L)$$, :'jan_porter'), 'P0002', null,
  'Ops at Logan Square can''t remind Porter');

-- The daily job's reminders count as the last one too, from nobody.
select pg_temp.su();
select ok(public.queue_walkthrough_reminders('2099-01-24') > 0, 'the job sends the seventh-day reminders');
select results_eq(
  format($$select last_reminded_by, last_reminded_at is not null from public.walkthroughs where id = %L$$, :'jan_porter'),
  $$values (null::uuid, true)$$,
  'and Porter''s walkthrough says one went'
);
select is((select count(*)::int from public.v_walkthrough_summary), (select count(*)::int from public.walkthroughs),
  'the summary has a row for every walkthrough');

select * from finish();
rollback;

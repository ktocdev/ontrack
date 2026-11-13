-- OT-102: the manager's walkthrough. The checklist in sections, the month opened by the
-- scheduled job, checks, fixes and tickets only through functions that check the caller,
-- Good refused while something is open, quarterly tasks once per quarter, submit, and the
-- progress per section.
begin;
select plan(44);

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

\set maya '''22222222-2222-4222-8222-000000000001'''
\set logan '''11111111-1111-4111-8111-000000000001'''
\set oct '''aaaaaaaa-aaaa-4aaa-8aaa-000000000001'''
\set other '''aaaaaaaa-aaaa-4aaa-8aaa-000000000002'''
\set sep '''aaaaaaaa-aaaa-4aaa-8aaa-000000000005'''
\set outlets '''dddddddd-dddd-4ddd-8ddd-000000000104'''
\set paint '''dddddddd-dddd-4ddd-8ddd-000000000114'''
\set bulbs '''dddddddd-dddd-4ddd-8ddd-000000000202'''
\set utility '''99999999-9999-4999-8999-000000000001'''
\set boh_electrical '''33333333-3333-4333-8333-000000000014'''

-- The default checklist: two sections of 24 items, and the group schedule names it.
select results_eq(
  $$select s.short_name, count(i.id)::int from public.walkthrough_sections s
    join public.walkthrough_items i on i.section_id = s.id
    where s.template_id = '88888888-8888-4888-8888-000000000001' group by s.short_name, s.sort_order order by s.sort_order$$,
  $$values ('BOH'::text, 24), ('FOH', 24)$$,
  'the default checklist has Back and Front of House, 24 items each'
);
select is(
  (select template_id from public.walkthrough_schedules where restaurant_id is null),
  '88888888-8888-4888-8888-000000000001'::uuid, 'the group schedule names the default checklist');
select is(public.walkthrough_due_on('2026-02-01', null), '2026-02-28'::date, 'due on the last day of the month');
select is(public.walkthrough_due_on('2026-02-01', 10), '2026-02-10'::date, 'or on the schedule''s day');
select is((select count(*)::int from cron.job where jobname = 'open-walkthroughs'), 1, 'the daily job is scheduled');

-- Opening a month: one per restaurant in use, once.
select is(public.open_walkthroughs('2026-12-15'),
  (select count(*)::int from public.restaurants where archived_at is null), 'December opens for every restaurant in use');
select is(public.open_walkthroughs('2026-12-01'), 0, 'opening it again opens nothing');
select is(
  (select due_on from public.walkthroughs where restaurant_id = :logan and period = '2026-12-01'),
  '2026-12-31'::date, 'due on Dec 31');
update public.walkthrough_schedules set months = '{1,2,3,4,5,6,7,8,9,10,11}' where restaurant_id is null;
select is(public.open_walkthroughs('2027-12-01'), 0, 'a month the schedule leaves out opens nothing');

select pg_temp.login('maya.reyes@example.com');
select throws_ok($$select public.open_walkthroughs('2027-01-01')$$, '42501', null, 'a manager can''t open walkthroughs');

-- Nothing is written around the functions.
select throws_ok(
  format($$insert into public.walkthrough_checks (walkthrough_id, item_id, result) values (%L, %L, 'good')$$, :oct, :outlets),
  '42501', null, 'a check is not inserted directly');
update public.walkthroughs set status = 'submitted' where id = :oct;
select pg_temp.su();
select is((select status::text from public.walkthroughs where id = :oct), 'open', 'nor a walkthrough submitted by an update');
select pg_temp.login('maya.reyes@example.com');
select throws_ok(
  format($$insert into public.tickets (restaurant_id, category_id, title, source, created_by)
           values (%L, %L, 'Claimed', 'walkthrough', %L)$$, :logan, :boh_electrical, :maya),
  '42501', null, 'a ticket can''t claim the Walkthrough tag');
select throws_ok(
  format($$insert into public.inhouse_fixes (restaurant_id, walkthrough_id, title, created_by) values (%L, %L, 'Claimed', %L)$$,
         :logan, :oct, :maya),
  '42501', null, 'nor an in-house fix');
select throws_ok(
  $$insert into public.walkthrough_items (section_id, group_name, title) values ('cccccccc-cccc-4ccc-8ccc-000000000001', 'X', 'Y')$$,
  '42501', null, 'the checklist is not written through the API');

-- Good, and taking it off.
select lives_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :bulbs), 'Maya marks Light bulbs Good');
select is(
  (select result::text from public.walkthrough_checks where walkthrough_id = :oct and item_id = :bulbs), 'good', 'it is Good');
select lives_ok(format($$select public.set_walkthrough_good(%L, %L, null, false)$$, :oct, :bulbs), 'and takes it off');
select is(
  (select count(*)::int from public.walkthrough_checks where walkthrough_id = :oct and item_id = :bulbs), 0, 'leaving no check');
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :other, :bulbs), '42501', null,
  'not at another restaurant');
select throws_ok(format($$select public.set_walkthrough_good(%L, 'dddddddd-dddd-4ddd-8ddd-000000000999')$$, :oct), '22023', null,
  'not an item off the checklist');

-- An in-house fix.
select public.add_walkthrough_fix(:oct, ' Replace the cracked cover plate ', :outlets) as fix
\gset
select results_eq(
  format('select restaurant_id, walkthrough_id, title, origin_label, area::text, created_by from public.inhouse_fixes where id = %L', :'fix'),
  format('values (%L::uuid, %L::uuid, %L::text, %L::text, %L::text, %L::uuid)',
         :logan, :oct, 'Replace the cracked cover plate', 'Oct walkthrough · BOH › Electrical › Outlets', 'boh', :maya),
  'the fix is on the walkthrough, labeled with its item and area'
);
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :outlets), '23514', null,
  'Good waits while the fix is open');

-- A ticket from the same item, with the item's category.
select public.create_walkthrough_ticket(:oct, 'Outlet by the prep sink sparks', :outlets,
  p_description => 'Scorch marks on the cover', p_urgency => 'urgent') as ticket
\gset
select results_eq(
  format('select source::text, walkthrough_id, category_id, status::text, urgency::text, created_by, walkthrough_check_id is not null from public.tickets where id = %L', :'ticket'),
  format('values (%L::text, %L::uuid, %L::uuid, %L::text, %L::text, %L::uuid, true)',
         'walkthrough', :oct, :boh_electrical, 'open', 'urgent', :maya),
  'the ticket carries the Walkthrough tag, the walkthrough and the item''s category'
);
select is(
  (select walkthrough_check_id from public.tickets where id = :'ticket'),
  (select check_id from public.inhouse_fixes where id = :'fix'), 'the fix and the ticket share the item''s check');
select throws_ok(format($$select public.create_walkthrough_ticket(%L, 'Scuffs', %L)$$, :oct, :paint), '22023', null,
  'an item with no category asks for one');
select lives_ok(format($$select public.create_walkthrough_ticket(%L, 'Scuffs by the host stand', %L, p_category_id => %L)$$,
  :oct, :paint, :boh_electrical), 'and takes the one sent');

-- Progress: Outlets and Paint are done (flagged) in Back of House.
select results_eq(
  format($$select done, tickets, fixes from public.v_walkthrough_progress where walkthrough_id = %L and short_name = 'BOH'$$, :oct),
  $$values (2, 2, 1)$$,
  'Back of House counts its flagged items, tickets and fixes'
);

-- The fix checked off and the ticket closed, Good is allowed and the flags stay.
select public.set_inhouse_fix_done(:'fix', true);
select pg_temp.su();
update public.tickets set status = 'closed', resolution = 'Swapped the outlet' where id = :'ticket';
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :outlets), 'Good once both are done');
select lives_ok(format($$select public.set_walkthrough_good(%L, %L, null, false)$$, :oct, :outlets), 'Good taken off again');
select is(
  (select result::text from public.walkthrough_checks where walkthrough_id = :oct and item_id = :outlets), 'ticket',
  'the check stays, flagged, since a ticket and a fix point to it');

-- Quarterly tasks: Q4's two in October, done once for the quarter.
select results_eq(
  format('select title, done from public.walkthrough_quarter_tasks(%L)', :oct),
  $$values ('Organize utility areas'::text, false), ('Degrease BOH floors', false)$$,
  'October has the two Q4 tasks'
);
select lives_ok(format($$select public.set_walkthrough_good(%L, null, %L)$$, :oct, :utility), 'Maya marks one Good');
select pg_temp.su();
select public.open_walkthroughs('2026-11-01');
select id as nov from public.walkthroughs where restaurant_id = :logan and period = '2026-11-01'
\gset
select pg_temp.login('maya.reyes@example.com');
select results_eq(
  format('select title, done, check_walkthrough_id from public.walkthrough_quarter_tasks(%L)', :'nov'),
  format('values (%L::text, true, %L::uuid), (%L, false, null)', 'Organize utility areas', :oct, 'Degrease BOH floors'),
  'November shows it done in October'
);
select throws_ok(format($$select public.set_walkthrough_good(%L, null, %L)$$, :'nov', :utility), '23514', null,
  'and it isn''t done twice in a quarter');
select is(
  (select count(*)::int from public.walkthrough_quarter_tasks(:sep)), 2, 'September is Q3, which has them too');

-- Ops reads every walkthrough; leadership reads and works none.
select pg_temp.login('bert.velilla@example.com');
select ok((select count(*) from public.v_walkthrough_progress where walkthrough_id = :other) > 0, 'Ops reads another restaurant''s progress');
select pg_temp.login('lee.chen@example.com');
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :bulbs), '42501', null, 'leadership checks nothing');

-- Submit, with a note, before it's finished; then it takes nothing more.
select pg_temp.login('maya.reyes@example.com');
select lives_ok(format($$select public.submit_walkthrough(%L, '  Back door sticks; Ops knows.  ')$$, :oct), 'Maya submits');
select results_eq(
  format('select status::text, submitted_by, submitted_note from public.walkthroughs where id = %L', :oct),
  format('values (%L::text, %L::uuid, %L::text)', 'submitted', :maya, 'Back door sticks; Ops knows.'),
  'submitted by her, with the note'
);
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :oct, :bulbs), '42501', null, 'a submitted walkthrough takes no checks');
select throws_ok(format($$select public.add_walkthrough_fix(%L, 'Late', %L)$$, :oct, :bulbs), '42501', null, 'nor fixes');
select throws_ok(format($$select public.submit_walkthrough(%L)$$, :oct), '42501', null, 'nor a second submit');

-- A deactivated manager works nothing.
select pg_temp.su();
update public.profiles set deactivated_at = now() where id = :maya;
select pg_temp.login('maya.reyes@example.com');
select throws_ok(format($$select public.set_walkthrough_good(%L, %L)$$, :'nov', :bulbs), '42501', null, 'not when deactivated');

select * from finish();
rollback;

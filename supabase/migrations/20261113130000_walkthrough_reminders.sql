-- OT-103: walkthrough reminders, through the notification outbox Phase 3 built.
--
-- 1. An outbox row is about a ticket or, for a reminder, a walkthrough. A reminder from the
--    schedule names how many days before the due date it is for, and is written once for
--    each, so running the job twice, or on the next day, sends nothing more. 6b's Send
--    reminder will write the same kind with no day, as many times as Ops presses it.
-- 2. Every morning a job writes one reminder for each open walkthrough whose reminder day
--    has come (7 and 2 days before due, from its schedule). A missed morning is caught up
--    the next, as one reminder: the nearest day that has come, never both.
-- 3. notification_recipients sends it to the managers at the restaurant who hold
--    create_tickets there, by push and email, while the walkthrough is still open. It has
--    its own switch on Profile, and the email switch covers it too.

-- ---------------------------------------------------------------------------
-- 1. The outbox and the log
-- ---------------------------------------------------------------------------

alter table public.notifications
  alter column ticket_id drop not null,
  add column walkthrough_id uuid references public.walkthroughs (id) on delete cascade,
  add column days_before int check (days_before between 0 and 31);
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_ticket', 'reopened', 'status_change', 'update', 'walkthrough_reminder'));
alter table public.notifications add constraint notifications_about_one check (
  case when kind = 'walkthrough_reminder'
    then walkthrough_id is not null and ticket_id is null
    else ticket_id is not null and walkthrough_id is null and days_before is null
  end
);
create unique index notifications_reminder_once on public.notifications (walkthrough_id, days_before)
  where kind = 'walkthrough_reminder' and days_before is not null;

alter table public.notification_deliveries
  alter column ticket_id drop not null,
  add column walkthrough_id uuid references public.walkthroughs (id) on delete cascade;
alter table public.notification_deliveries add constraint notification_deliveries_about_one
  check ((ticket_id is null) <> (walkthrough_id is null));
create index notification_deliveries_walkthrough_idx on public.notification_deliveries (walkthrough_id)
  where walkthrough_id is not null;

alter table public.notification_prefs drop constraint notification_prefs_kind_check;
alter table public.notification_prefs add constraint notification_prefs_kind_check
  check (kind in ('new_ticket', 'reopened', 'status_change', 'update', 'walkthrough_reminder', 'email'));

-- ---------------------------------------------------------------------------
-- 2. Writing the reminders
-- ---------------------------------------------------------------------------

-- For each open walkthrough not yet past due, the nearest reminder day that has come, from
-- the restaurant's own schedule or the group's. Returns how many it wrote. The service role
-- and the scheduled job only; the day can be given, for tests.
create function public.queue_walkthrough_reminders(p_today date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, public.group_today());
  v_group int[] := (select reminder_days from public.walkthrough_schedules where restaurant_id is null);
  v_count int;
begin
  if not public.is_service() then
    raise exception 'only the scheduled job sends walkthrough reminders' using errcode = '42501';
  end if;

  with due as (
    select w.id,
           (select min(d) from unnest(coalesce(own.reminder_days, v_group, '{7,2}')) as d
            where d between 0 and 31 and v_today >= w.due_on - d) as days_before
    from public.walkthroughs w
    join public.restaurants r on r.id = w.restaurant_id and r.archived_at is null
    left join public.walkthrough_schedules own on own.restaurant_id = w.restaurant_id
    where w.status = 'open' and v_today <= w.due_on
  ),
  queued as (
    insert into public.notifications (walkthrough_id, kind, days_before)
    select id, 'walkthrough_reminder', days_before from due where days_before is not null
    on conflict (walkthrough_id, days_before) where kind = 'walkthrough_reminder' and days_before is not null
    do nothing
    returning 1
  )
  select count(*)::int into v_count from queued;

  if v_count > 0 then
    perform public.notify_send_push();
  end if;
  return v_count;
end;
$$;
revoke all on function public.queue_walkthrough_reminders(date) from public, anon, authenticated;
grant execute on function public.queue_walkthrough_reminders(date) to service_role;

-- Every morning at 15:00 UTC (9 or 10 in the morning in Chicago), after the month opens at 11.
select cron.schedule('walkthrough-reminders', '0 15 * * *', 'select public.queue_walkthrough_reminders()');

-- ---------------------------------------------------------------------------
-- 3. Who gets what
-- ---------------------------------------------------------------------------

-- As before (20261102160000), plus:
--   Walkthrough reminder: every manager covering the restaurant who holds create_tickets
--   there, while the walkthrough is open. Nobody did it, so it is never anyone's own.
create or replace function public.notification_recipients(p_notification uuid)
returns table (user_id uuid, email text, full_name text, push boolean, send_email boolean)
language sql
stable
security definer
set search_path = public
as $$
  with n as (
    select x.*, coalesce(t.restaurant_id, w.restaurant_id) as restaurant_id, t.created_by, t.assignee_id,
      a.role as actor_role, w.status as walkthrough_status
    from public.notifications x
    left join public.tickets t on t.id = x.ticket_id
    left join public.walkthroughs w on w.id = x.walkthrough_id
    left join public.profiles a on a.id = x.actor_id
    where x.id = p_notification
  ),
  people as (
    select p.id, p.email, p.full_name, p.role, n.actor_id, n.actor_role, n.kind, n.internal, n.created_by,
      n.assignee_id, n.status_to, n.picked_up, n.walkthrough_status,
      coalesce(
        (select r.allowed from public.rights r where r.user_id = p.id and r.key = 'create_tickets'),
        (select r.allowed from public.rights r where r.role = p.role and r.user_id is null and r.key = 'create_tickets'),
        false
      ) as creates_tickets
    from public.profiles p
    cross join n
    where n.restaurant_id is not null
      and p.deactivated_at is null
      and p.role in ('ops', 'manager')
      and exists (
        select 1 from public.memberships m
        where m.user_id = p.id and (m.restaurant_id is null or m.restaurant_id = n.restaurant_id)
      )
  ),
  chosen as (
    select *,
      not internal and (
        (kind in ('new_ticket', 'reopened') and role = 'ops')
        or (kind = 'update' and id in (created_by, assignee_id))
        or (kind = 'status_change' and status_to is not null and id in (created_by, assignee_id))
        or (kind = 'walkthrough_reminder' and role = 'manager' and creates_tickets and walkthrough_status = 'open')
      ) as told,
      role = 'ops' and (
        id is not distinct from actor_id
        or (actor_role = 'ops' and kind = 'status_change' and (picked_up or status_to = 'closed'))
      ) as ops_record
    from people
  )
  select c.id, c.email, c.full_name,
    c.told and c.id is distinct from c.actor_id as push,
    ((c.told and c.id is distinct from c.actor_id) or c.ops_record) and not exists (
      select 1 from public.notification_prefs e
      where e.user_id = c.id and e.kind = 'email' and not e.enabled
    ) as send_email
  from chosen c
  where ((c.told and c.id is distinct from c.actor_id) or c.ops_record)
    and not exists (
      select 1 from public.notification_prefs k
      where k.user_id = c.id and k.kind = c.kind and not k.enabled
    );
$$;
revoke all on function public.notification_recipients(uuid) from public, anon, authenticated;
grant execute on function public.notification_recipients(uuid) to service_role;

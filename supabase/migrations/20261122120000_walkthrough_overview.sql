-- The Ops overview's backend (OT-127, 6b). The overview board shows each restaurant's month
-- (progress, its tickets and in-house fixes, Not started, In progress or Submitted, days
-- left) and the last six months as On time, Late or Missed; the one-restaurant board adds
-- who is on it, past walkthroughs, and Send reminder with when the last one went.
--
-- 1. walkthroughs.last_reminded_at and last_reminded_by, kept by a trigger on every
--    reminder written, the daily job's or one sent by hand, since nobody signed in reads
--    notifications.
-- 2. v_walkthrough_summary: one row per walkthrough, security_invoker, so it shows only the
--    restaurants the caller has in scope. A month and the last six months are both this
--    view by period, so there is no second view.
-- 3. send_walkthrough_reminder: Update status at the restaurant (decided Nov 17, 2026, in
--    OT-125's open questions), an open walkthrough, at most one an hour, logged; the same
--    notification the job writes, so it goes to the same people.

-- ---------------------------------------------------------------------------
-- 1. When the last reminder went
-- ---------------------------------------------------------------------------

alter table public.walkthroughs
  add column last_reminded_at timestamptz,
  add column last_reminded_by uuid references public.profiles (id);

create function public.walkthrough_reminded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.walkthroughs
  set last_reminded_at = new.created_at, last_reminded_by = new.actor_id
  where id = new.walkthrough_id;
  return new;
end;
$$;
revoke all on function public.walkthrough_reminded() from public, anon, authenticated;

create trigger notifications_walkthrough_reminded after insert on public.notifications
  for each row when (new.kind = 'walkthrough_reminder')
  execute function public.walkthrough_reminded();

-- The reminders already sent.
update public.walkthroughs w
set last_reminded_at = n.created_at, last_reminded_by = n.actor_id
from (
  select distinct on (walkthrough_id) walkthrough_id, created_at, actor_id
  from public.notifications where kind = 'walkthrough_reminder'
  order by walkthrough_id, created_at desc
) n
where n.walkthrough_id = w.id;

-- ---------------------------------------------------------------------------
-- 2. The summary
-- ---------------------------------------------------------------------------

-- A walkthrough submitted by the end of its due day (in the group's time zone) is on
-- time, after it late; one still open past its due day is missed; before that it is in
-- progress once anything is checked or someone has started it.
create view public.v_walkthrough_summary with (security_invoker = true) as
select w.id as walkthrough_id,
       w.restaurant_id,
       w.period,
       w.due_on,
       w.status,
       w.template_id,
       t.name as template_name,
       t.short_name as template_short_name,
       t.description as template_description,
       w.started_by,
       w.submitted_by,
       w.submitted_at,
       w.last_reminded_at,
       w.last_reminded_by,
       coalesce(p.total, 0) as total,
       coalesce(p.done, 0) as done,
       (select count(*)::int from public.tickets k where k.walkthrough_id = w.id) as tickets,
       (select count(*)::int from public.inhouse_fixes f where f.walkthrough_id = w.id) as fixes,
       w.due_on - public.group_today() as days_left,
       case
         when w.status = 'submitted' then
           case when (w.submitted_at at time zone coalesce(g.time_zone, 'UTC'))::date <= w.due_on
             then 'on_time' else 'late' end
         when public.group_today() > w.due_on then 'missed'
         when coalesce(p.done, 0) > 0 or w.started_by is not null then 'in_progress'
         else 'not_started'
       end as standing
from public.walkthroughs w
left join public.walkthrough_templates t on t.id = w.template_id
left join public.group_settings g on true
left join lateral (
  select sum(v.total)::int as total, sum(v.done)::int as done
  from public.v_walkthrough_progress v where v.walkthrough_id = w.id
) p on true;

-- ---------------------------------------------------------------------------
-- 3. Send reminder
-- ---------------------------------------------------------------------------

create function public.send_walkthrough_reminder(p_walkthrough uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.walkthroughs%rowtype;
  v_at timestamptz;
begin
  select * into v_w from public.walkthroughs where id = p_walkthrough for update;
  -- Another restaurant's walkthrough reads the same as one that doesn't exist.
  if v_w.id is null or not public.can('update_status', v_w.restaurant_id) then
    raise exception 'no such walkthrough' using errcode = 'P0002';
  end if;
  if v_w.status <> 'open' then
    raise exception 'the walkthrough is already submitted' using errcode = '22023';
  end if;
  if v_w.last_reminded_at > now() - interval '1 hour' then
    raise exception 'a reminder went out within the hour' using errcode = '55000';
  end if;

  insert into public.notifications (walkthrough_id, kind, actor_id)
  values (v_w.id, 'walkthrough_reminder', auth.uid())
  returning created_at into v_at;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'walkthrough.remind', v_w.restaurant_id,
    jsonb_build_object('walkthrough_id', v_w.id, 'period', v_w.period));

  perform public.notify_send_push();
  return v_at;
end;
$$;
revoke all on function public.send_walkthrough_reminder(uuid) from public, anon;
grant execute on function public.send_walkthrough_reminder(uuid) to authenticated;

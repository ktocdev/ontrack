-- Rotations (OT-126, 6b). The schedule board draws a cycle of months, each with its own
-- checklist ("A · Kitchen + Exterior", "B · Back of House + Front of House"), the group's
-- for every restaurant unless one has its own (Ranalli's, three months). A rotation stands
-- on its own and restaurants point to it, so several can share one (decided Nov 12, 2026);
-- the group's is the one every restaurant without its own follows.
--
-- 1. walkthrough_rotations: a name, the month the cycle counts from, the due day and the
--    reminder days. walkthrough_rotation_months: the cycle, a checklist per position.
--    restaurant_rotations: a restaurant on a rotation other than the group's.
-- 2. The group's rotation from the old group schedule, a restaurant's own schedule as a
--    rotation of its own, then walkthrough_schedules goes; nothing in the app read it.
-- 3. open_walkthroughs and queue_walkthrough_reminders read the restaurant's rotation.
-- 4. save_rotation, set_restaurant_rotation and delete_rotation: the group's, so any
--    restaurant's set_walkthrough_schedule changes a rotation, as categories go by
--    edit_equipment; putting a restaurant on one needs it at that restaurant. Logged.
-- 5. A checklist's description ("A closer look") and short name ("BOH + FOH"), for the
--    rotation's rows and the year's preview.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

alter table public.walkthrough_templates
  add column description text check (description is null or char_length(btrim(description)) between 1 and 60),
  add column short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 20);

create table public.walkthrough_rotations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  is_group boolean not null default false,
  -- The cycle's first position falls on this month; every month before and after follows.
  starts_on date not null default date_trunc('month', now())::date
    check (extract(day from starts_on) = 1),
  -- Null is the last day of the month (decided Nov 12, 2026).
  due_day int check (due_day between 1 and 28),
  reminder_days int[] not null default '{7,2}'
    check (cardinality(reminder_days) <= 4 and 0 <= all (reminder_days) and 31 >= all (reminder_days)),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index walkthrough_rotations_one_group on public.walkthrough_rotations ((true)) where is_group;
create unique index walkthrough_rotations_name on public.walkthrough_rotations (lower(btrim(name)));
create trigger walkthrough_rotations_updated_at before update on public.walkthrough_rotations
  for each row execute function public.set_updated_at();

create table public.walkthrough_rotation_months (
  rotation_id uuid not null references public.walkthrough_rotations (id) on delete cascade,
  position int not null check (position between 0 and 11),
  template_id uuid not null references public.walkthrough_templates (id),
  primary key (rotation_id, position)
);
create index walkthrough_rotation_months_template_idx on public.walkthrough_rotation_months (template_id);

-- No row: the restaurant follows the group's rotation.
create table public.restaurant_rotations (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  rotation_id uuid not null references public.walkthrough_rotations (id),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
create index restaurant_rotations_rotation_idx on public.restaurant_rotations (rotation_id);

-- The group's, read by anyone signed in like the checklist; written only by the functions.
alter table public.walkthrough_rotations enable row level security;
alter table public.walkthrough_rotation_months enable row level security;
alter table public.restaurant_rotations enable row level security;
create policy walkthrough_rotations_select on public.walkthrough_rotations
  for select to authenticated using (public.my_role() is not null);
create policy walkthrough_rotation_months_select on public.walkthrough_rotation_months
  for select to authenticated using (public.my_role() is not null);
create policy restaurant_rotations_select on public.restaurant_rotations
  for select to authenticated using (public.my_role() is not null);

-- ---------------------------------------------------------------------------
-- 2. From the schedules
-- ---------------------------------------------------------------------------

insert into public.walkthrough_rotations (name, is_group, starts_on, due_day, reminder_days, updated_by)
select 'Group', true, date_trunc('month', now())::date, s.due_day, s.reminder_days, s.updated_by
from public.walkthrough_schedules s
where s.restaurant_id is null;
insert into public.walkthrough_rotations (name, is_group)
select 'Group', true
where not exists (select 1 from public.walkthrough_rotations where is_group);

insert into public.walkthrough_rotation_months (rotation_id, position, template_id)
select g.id, 0, t.template_id
from public.walkthrough_rotations g
cross join lateral (
  select coalesce(
    (select s.template_id from public.walkthrough_schedules s where s.restaurant_id is null),
    (select t.id from public.walkthrough_templates t where t.active order by t.created_at desc limit 1)
  ) as template_id
) t
where g.is_group and t.template_id is not null;

-- A restaurant with its own schedule keeps it, as a rotation of its own.
do $$
declare
  s record;
  v_id uuid;
begin
  for s in
    select w.*, r.name as restaurant_name
    from public.walkthrough_schedules w join public.restaurants r on r.id = w.restaurant_id
  loop
    insert into public.walkthrough_rotations (name, starts_on, due_day, reminder_days, updated_by)
    values (left(s.restaurant_name, 31) || ' · ' || left(s.id::text, 6), date_trunc('month', now())::date,
            s.due_day, s.reminder_days, s.updated_by)
    returning id into v_id;
    insert into public.walkthrough_rotation_months (rotation_id, position, template_id)
    select v_id, 0, coalesce(s.template_id, m.template_id)
    from public.walkthrough_rotation_months m
    join public.walkthrough_rotations g on g.id = m.rotation_id and g.is_group;
    insert into public.restaurant_rotations (restaurant_id, rotation_id) values (s.restaurant_id, v_id);
  end loop;
end;
$$;

-- A person's history counted their schedule edits; it counts their rotation edits now.
create or replace view public.v_person_history with (security_invoker = true) as
select p.id as user_id,
  (
    (select count(*) from public.tickets t where p.id in (t.created_by, t.closed_by, t.assignee_id))
    + (select count(*) from public.ticket_updates u where u.author_id = p.id)
    + (select count(*) from public.ticket_photos f where f.created_by = p.id)
    + (select count(*) from public.equipment e where e.created_by = p.id)
    + (select count(*) from public.contractors c where c.created_by = p.id)
    + (select count(*) from public.service_records s where s.logged_by = p.id)
    + (select count(*) from public.invoices i where i.attached_by = p.id)
    + (select count(*) from public.walkthrough_rotations w where w.updated_by = p.id)
    + (select count(*) from public.restaurant_rotations w where w.updated_by = p.id)
    + (select count(*) from public.walkthroughs w where p.id in (w.started_by, w.submitted_by))
    + (select count(*) from public.walkthrough_checks w where w.checked_by = p.id)
    + (select count(*) from public.inhouse_fixes x where p.id in (x.done_by, x.created_by))
    + (select count(*) from public.invites i where i.invited_by = p.id)
  )::int as records
from public.profiles p;

-- ---------------------------------------------------------------------------
-- 3. Opening a month and its reminders
-- ---------------------------------------------------------------------------

-- The restaurant's rotation: its own, else the group's.
create function public.restaurant_rotation(p_restaurant uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rotation_id from public.restaurant_rotations where restaurant_id = p_restaurant),
    (select id from public.walkthrough_rotations where is_group)
  );
$$;
revoke all on function public.restaurant_rotation(uuid) from public, anon, authenticated;

-- The checklist a rotation gives a month: count the months from its start, round the cycle.
create function public.rotation_template(p_rotation uuid, p_period date)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select (extract(year from p_period)::int - extract(year from starts_on)::int) * 12
             + extract(month from p_period)::int - extract(month from starts_on)::int as since,
           (select count(*)::int from public.walkthrough_rotation_months m where m.rotation_id = p_rotation) as n
    from public.walkthrough_rotations where id = p_rotation
  )
  select m.template_id
  from r join public.walkthrough_rotation_months m
    on m.rotation_id = p_rotation and r.n > 0 and m.position = ((r.since % r.n) + r.n) % r.n;
$$;
revoke all on function public.rotation_template(uuid, date) from public, anon, authenticated;

-- As before (20261113120000), from the restaurant's rotation: every month opens, with the
-- checklist the cycle gives it and the rotation's due day.
create or replace function public.open_walkthroughs(p_period date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', coalesce(p_period, public.group_today()))::date;
  v_count int;
begin
  if not public.is_service() then
    raise exception 'only the scheduled job opens walkthroughs' using errcode = '42501';
  end if;

  with plan as (
    select r.id as restaurant_id, rot.due_day, public.rotation_template(rot.id, v_period) as template_id
    from public.restaurants r
    join public.walkthrough_rotations rot on rot.id = public.restaurant_rotation(r.id)
    where r.archived_at is null
  ),
  opened as (
    insert into public.walkthroughs (restaurant_id, template_id, period, due_on)
    select restaurant_id, template_id, v_period, public.walkthrough_due_on(v_period, due_day)
    from plan
    where template_id is not null
    on conflict (restaurant_id, period) do nothing
    returning 1
  )
  select count(*)::int into v_count from opened;
  return v_count;
end;
$$;

-- As before (20261113130000), with the reminder days from the restaurant's rotation.
create or replace function public.queue_walkthrough_reminders(p_today date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, public.group_today());
  v_count int;
begin
  if not public.is_service() then
    raise exception 'only the scheduled job sends walkthrough reminders' using errcode = '42501';
  end if;

  with due as (
    select w.id,
           (select min(d) from unnest(rot.reminder_days) as d
            where v_today >= w.due_on - d) as days_before
    from public.walkthroughs w
    join public.restaurants r on r.id = w.restaurant_id and r.archived_at is null
    join public.walkthrough_rotations rot on rot.id = public.restaurant_rotation(w.restaurant_id)
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

drop table public.walkthrough_schedules;

-- ---------------------------------------------------------------------------
-- 4. Changing them
-- ---------------------------------------------------------------------------

-- Add (no id) or change a rotation: its name, its months' checklists in order, the month
-- the cycle starts, the due day (null for the last) and the reminder days. A checklist
-- turned off goes on no new month, and one already in this rotation may stay.
create function public.save_rotation(
  p_id uuid, p_name text, p_templates uuid[], p_starts_on date, p_due_day int, p_reminder_days int[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_name text := btrim(p_name);
  v_days int[];
  v_t uuid;
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough schedule' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'a rotation needs a name of up to 40 characters' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_templates), 0) not between 1 and 12 then
    raise exception 'a rotation has 1 to 12 months' using errcode = '22023';
  end if;
  if p_starts_on is null or extract(day from p_starts_on) <> 1 then
    raise exception 'a rotation starts on the first of a month' using errcode = '22023';
  end if;
  if p_due_day is not null and p_due_day not between 1 and 28 then
    raise exception 'the due day is 1 to 28, or the last day' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct d order by d desc), '{}') into v_days from unnest(p_reminder_days) as d;
  if cardinality(v_days) > 4 or exists (select 1 from unnest(v_days) d where d is null or d not between 0 and 31) then
    raise exception 'up to four reminders, 0 to 31 days before' using errcode = '22023';
  end if;

  if v_id is not null and not exists (select 1 from public.walkthrough_rotations where id = v_id) then
    raise exception 'no such rotation' using errcode = 'P0002';
  end if;
  foreach v_t in array p_templates loop
    if not exists (select 1 from public.walkthrough_templates t where t.id = v_t
                   and (t.active or exists (select 1 from public.walkthrough_rotation_months m
                                            where m.rotation_id = v_id and m.template_id = v_t)))
    then
      raise exception 'a checklist is turned off or does not exist' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from public.walkthrough_rotations
             where lower(btrim(name)) = lower(v_name) and id is distinct from v_id) then
    raise exception 'another rotation has that name' using errcode = '23505';
  end if;

  if v_id is null then
    insert into public.walkthrough_rotations (name, starts_on, due_day, reminder_days, updated_by)
    values (v_name, p_starts_on, p_due_day, v_days, auth.uid())
    returning id into v_id;
  else
    update public.walkthrough_rotations
    set name = v_name, starts_on = p_starts_on, due_day = p_due_day, reminder_days = v_days,
        updated_by = auth.uid()
    where id = v_id;
    delete from public.walkthrough_rotation_months where rotation_id = v_id;
  end if;
  insert into public.walkthrough_rotation_months (rotation_id, position, template_id)
  select v_id, t.n - 1, t.id from unnest(p_templates) with ordinality as t (id, n);

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'rotation.save', jsonb_build_object(
    'id', v_id, 'new', p_id is null, 'name', v_name, 'templates', p_templates,
    'starts_on', p_starts_on, 'due_day', p_due_day, 'reminder_days', v_days));
  return v_id;
end;
$$;
revoke all on function public.save_rotation(uuid, text, uuid[], date, int, int[]) from public, anon;
grant execute on function public.save_rotation(uuid, text, uuid[], date, int, int[]) to authenticated;

-- Put a restaurant on a rotation; the group's, or null, puts it back on the group's.
create function public.set_restaurant_rotation(p_restaurant uuid, p_rotation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid := (select id from public.walkthrough_rotations where is_group);
  v_from uuid;
begin
  if p_restaurant is null or not public.can('set_walkthrough_schedule', p_restaurant) then
    raise exception 'you cannot change this restaurant''s schedule' using errcode = '42501';
  end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant and archived_at is null) then
    raise exception 'the restaurant is archived or does not exist' using errcode = '22023';
  end if;
  if p_rotation is not null and not exists (select 1 from public.walkthrough_rotations where id = p_rotation) then
    raise exception 'no such rotation' using errcode = 'P0002';
  end if;

  v_from := public.restaurant_rotation(p_restaurant);
  if p_rotation is null or p_rotation = v_group then
    delete from public.restaurant_rotations where restaurant_id = p_restaurant;
  else
    insert into public.restaurant_rotations (restaurant_id, rotation_id, updated_by)
    values (p_restaurant, p_rotation, auth.uid())
    on conflict (restaurant_id) do update
      set rotation_id = excluded.rotation_id, updated_by = excluded.updated_by, updated_at = now();
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'rotation.restaurant', p_restaurant,
    jsonb_build_object('from', v_from, 'to', coalesce(p_rotation, v_group)));
end;
$$;
revoke all on function public.set_restaurant_rotation(uuid, uuid) from public, anon;
grant execute on function public.set_restaurant_rotation(uuid, uuid) to authenticated;

-- Delete a rotation nobody uses. The group's always stays. Walkthroughs keep their own
-- checklist, so nothing they hold points here.
create function public.delete_rotation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough schedule' using errcode = '42501';
  end if;
  select name into v_name from public.walkthrough_rotations where id = p_id and not is_group for update;
  if v_name is null then
    raise exception 'no such rotation, or it is the group''s' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.restaurant_rotations where rotation_id = p_id) then
    raise exception 'a restaurant uses this rotation' using errcode = '23503';
  end if;
  delete from public.walkthrough_rotations where id = p_id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'rotation.delete', jsonb_build_object('id', p_id, 'name', v_name));
end;
$$;
revoke all on function public.delete_rotation(uuid) from public, anon;
grant execute on function public.delete_rotation(uuid) to authenticated;

-- Quarterly tasks for Ops (OT-134, 6b): the group's list and each restaurant's removals,
-- changes, additions and restores, as WT-Ops-Tasks draws them, through checked, logged
-- functions holding set_walkthrough_schedule (at the restaurant, for a restaurant's own).
--
-- Phase 0's table already holds both: a group task has no restaurant; a restaurant's own
-- task has its restaurant and no overrides_task_id; a restaurant's version of a group task
-- (changed, or removed) has both, one per restaurant and group task. Its months say which
-- quarters it falls in.
--
-- A walkthrough already open keeps its quarter's tasks as they were (the plan, OT-134), as
-- it keeps its checklist: walkthrough_tasks is each walkthrough's copy, taken when it
-- opens. Done is still once per quarter, matched by the group task a version came from, so
-- a task changed in the middle of a quarter keeps a check made on it the month before.

-- ---------------------------------------------------------------------------
-- 1. One version per restaurant and group task; a turned-off version counts for nothing
-- ---------------------------------------------------------------------------

create unique index quarterly_tasks_one_version
  on public.quarterly_tasks (restaurant_id, overrides_task_id) where overrides_task_id is not null;
alter table public.quarterly_tasks
  add constraint quarterly_tasks_title_length check (char_length(btrim(title)) between 1 and 140),
  add constraint quarterly_tasks_directions_length check (directions is null or char_length(directions) <= 2000),
  add constraint quarterly_tasks_months_some check (cardinality(months) between 1 and 12);

-- The tasks a restaurant gets in the quarter of a month: the group's, its version in place
-- of one it changed, none for one it removed, and its own.
create function public.quarter_tasks_for(p_restaurant uuid, p_period date)
returns table (task_id uuid, root_id uuid, title text, directions text, video_url text, sort_order int)
language sql
stable
security definer
set search_path = public
as $$
  with tasks as (
    select coalesce(o.id, g.id) as id, g.id as root, coalesce(o.title, g.title) as title,
           coalesce(o.directions, g.directions) as directions, coalesce(o.video_url, g.video_url) as video_url,
           coalesce(o.months, g.months) as months, coalesce(o.sort_order, g.sort_order) as sort_order
    from public.quarterly_tasks g
    left join public.quarterly_tasks o
      on o.overrides_task_id = g.id and o.restaurant_id = p_restaurant and o.active and not o.removed
    where g.restaurant_id is null and g.active
      and not exists (
        select 1 from public.quarterly_tasks x
        where x.overrides_task_id = g.id and x.restaurant_id = p_restaurant and x.active and x.removed
      )
    union all
    select t.id, t.id, t.title, t.directions, t.video_url, t.months, t.sort_order
    from public.quarterly_tasks t
    where t.restaurant_id = p_restaurant and t.overrides_task_id is null and t.active and not t.removed
  )
  select t.id, t.root, t.title, t.directions, t.video_url, t.sort_order
  from tasks t
  where exists (select 1 from unnest(t.months) m where (m - 1) / 3 + 1 = extract(quarter from p_period)::int);
$$;
revoke all on function public.quarter_tasks_for(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each walkthrough's copy of its quarter's tasks
-- ---------------------------------------------------------------------------

create table public.walkthrough_tasks (
  walkthrough_id uuid not null references public.walkthroughs (id) on delete cascade,
  task_id uuid not null references public.quarterly_tasks (id),
  -- The group task it is a version of, or itself: what done is matched by across the quarter.
  root_id uuid not null references public.quarterly_tasks (id),
  title text not null,
  directions text,
  video_url text,
  sort_order int not null default 0,
  primary key (walkthrough_id, task_id)
);
create index walkthrough_tasks_task_idx on public.walkthrough_tasks (task_id);
create index walkthrough_tasks_root_idx on public.walkthrough_tasks (root_id);
alter table public.walkthrough_tasks enable row level security;
-- Read with the walkthrough; written only by the trigger below.
create policy walkthrough_tasks_select on public.walkthrough_tasks
  for select to authenticated
  using (public.my_role() is not null and exists (select 1 from public.walkthroughs w where w.id = walkthrough_id));

create function public.walkthrough_tasks_on_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.walkthrough_tasks (walkthrough_id, task_id, root_id, title, directions, video_url, sort_order)
  select new.id, q.task_id, q.root_id, q.title, q.directions, q.video_url, q.sort_order
  from public.quarter_tasks_for(new.restaurant_id, new.period) q;
  return new;
end;
$$;
revoke all on function public.walkthrough_tasks_on_open() from public, anon, authenticated;
create trigger walkthrough_tasks_on_open after insert on public.walkthroughs
  for each row execute function public.walkthrough_tasks_on_open();

-- The walkthroughs there already take today's tasks, which is what they show now.
insert into public.walkthrough_tasks (walkthrough_id, task_id, root_id, title, directions, video_url, sort_order)
select w.id, q.task_id, q.root_id, q.title, q.directions, q.video_url, q.sort_order
from public.walkthroughs w
cross join lateral public.quarter_tasks_for(w.restaurant_id, w.period) q;

-- As before (20261113120000), from the walkthrough's copy, with done matched by the group
-- task a version came from.
create or replace function public.walkthrough_quarter_tasks(p_walkthrough_id uuid)
returns table (
  task_id uuid,
  title text,
  directions text,
  video_url text,
  sort_order int,
  check_id uuid,
  check_walkthrough_id uuid,
  done boolean,
  tickets int,
  fixes int
)
language sql
stable
set search_path = public
as $$
  with w as (
    select id, restaurant_id, period from public.walkthroughs where id = p_walkthrough_id
  ),
  checks as (
    select c.id, c.walkthrough_id, coalesce(q.overrides_task_id, q.id) as root_id, c.result,
           (select count(*)::int from public.tickets k where k.walkthrough_check_id = c.id) as tickets,
           (select count(*)::int from public.inhouse_fixes f where f.check_id = c.id) as fixes
    from w
    join public.walkthroughs other
      on other.restaurant_id = w.restaurant_id
     and date_trunc('quarter', other.period) = date_trunc('quarter', w.period)
    join public.walkthrough_checks c on c.walkthrough_id = other.id and c.quarterly_task_id is not null
    join public.quarterly_tasks q on q.id = c.quarterly_task_id
  )
  select t.task_id, t.title, t.directions, t.video_url, t.sort_order,
         c.id, c.walkthrough_id,
         coalesce(c.result = 'good' or c.tickets > 0 or c.fixes > 0, false),
         coalesce(c.tickets, 0), coalesce(c.fixes, 0)
  from w
  join public.walkthrough_tasks t on t.walkthrough_id = w.id
  left join lateral (
    select * from checks c where c.root_id = t.root_id
    order by (c.walkthrough_id = w.id) desc, (c.result = 'good' or c.tickets > 0 or c.fixes > 0) desc
    limit 1
  ) c on true
  order by t.sort_order, t.title;
$$;
revoke all on function public.walkthrough_quarter_tasks(uuid) from public, anon;
grant execute on function public.walkthrough_quarter_tasks(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Changing them: checked, logged, never through the API
-- ---------------------------------------------------------------------------

-- Who may change a task: the group's (no restaurant) with set_walkthrough_schedule at any
-- restaurant, as rotations go; a restaurant's with it at that restaurant, not archived.
create function public.quarterly_task_check(p_restaurant uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can('set_walkthrough_schedule', p_restaurant) then
    raise exception 'you cannot change the quarterly tasks here' using errcode = '42501';
  end if;
  if p_restaurant is not null
     and not exists (select 1 from public.restaurants where id = p_restaurant and archived_at is null) then
    raise exception 'the restaurant is archived or does not exist' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.quarterly_task_check(uuid) from public, anon, authenticated;

-- Add or change a task. With no id: a group task (no restaurant) or the restaurant's own,
-- in the quarters given. With a group task's id and a restaurant: that restaurant's version
-- of it (Changed for), which stays as written whatever the group's later says. Otherwise
-- the task itself. Quarters left out keep the task's.
create function public.save_quarterly_task(
  p_id uuid, p_restaurant uuid, p_title text, p_directions text, p_video_url text, p_quarters int[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.quarterly_tasks;
  v_title text := btrim(coalesce(p_title, ''));
  v_directions text := nullif(btrim(coalesce(p_directions, '')), '');
  v_video text := nullif(btrim(coalesce(p_video_url, '')), '');
  v_months int[];
  v_id uuid;
  v_action text;
begin
  if p_quarters is not null then
    if cardinality(p_quarters) = 0 or exists (select 1 from unnest(p_quarters) q where q is null or q not between 1 and 4) then
      raise exception 'pick one or more quarters, 1 to 4' using errcode = '22023';
    end if;
    select array_agg(distinct (q - 1) * 3 + 1 order by (q - 1) * 3 + 1) into v_months from unnest(p_quarters) q;
  end if;

  if p_id is not null then
    select * into t from public.quarterly_tasks where id = p_id for update;
    if t.id is null then
      raise exception 'no such task' using errcode = 'P0002';
    end if;
  end if;

  if p_id is null then
    perform public.quarterly_task_check(p_restaurant);
    if v_months is null then
      raise exception 'pick one or more quarters, 1 to 4' using errcode = '22023';
    end if;
    insert into public.quarterly_tasks (restaurant_id, title, directions, video_url, months, sort_order)
    values (p_restaurant, v_title, v_directions, v_video, v_months,
            coalesce((select max(sort_order) + 1 from public.quarterly_tasks), 1))
    returning id into v_id;
    v_action := 'quarterly_task.add';
  elsif t.restaurant_id is null and p_restaurant is not null then
    -- A restaurant's version of a group task: the one row there is, made or changed.
    perform public.quarterly_task_check(p_restaurant);
    insert into public.quarterly_tasks (restaurant_id, overrides_task_id, title, directions, video_url, months, sort_order)
    values (p_restaurant, t.id, v_title, v_directions, v_video, coalesce(v_months, t.months), t.sort_order)
    on conflict (restaurant_id, overrides_task_id) where overrides_task_id is not null do update
      set title = excluded.title, directions = excluded.directions, video_url = excluded.video_url,
          months = excluded.months, removed = false, active = true, updated_at = now()
    returning id into v_id;
    v_action := 'quarterly_task.change_for_restaurant';
  else
    if p_restaurant is distinct from t.restaurant_id and p_restaurant is not null then
      raise exception 'that task is not this restaurant''s' using errcode = '22023';
    end if;
    perform public.quarterly_task_check(t.restaurant_id);
    update public.quarterly_tasks
    set title = v_title, directions = v_directions, video_url = v_video, months = coalesce(v_months, months),
        updated_at = now()
    where id = t.id;
    v_id := t.id;
    v_action := 'quarterly_task.save';
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), v_action, p_restaurant,
    jsonb_build_object('id', v_id, 'of', p_id, 'title', v_title, 'months', coalesce(v_months, t.months)));
  return v_id;
end;
$$;
revoke all on function public.save_quarterly_task(uuid, uuid, text, text, text, int[]) from public, anon;
grant execute on function public.save_quarterly_task(uuid, uuid, text, text, text, int[]) to authenticated;

-- Remove a group task for one restaurant, or restore it. The restaurant's version, if it
-- changed it, stays with the removal, so a restore brings that back.
create function public.set_quarterly_task_removed(p_task uuid, p_restaurant uuid, p_removed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.quarterly_tasks;
begin
  perform public.quarterly_task_check(p_restaurant);
  select * into t from public.quarterly_tasks where id = p_task and restaurant_id is null;
  if t.id is null or p_restaurant is null or p_removed is null then
    raise exception 'name a group task and a restaurant' using errcode = '22023';
  end if;
  if p_removed then
    insert into public.quarterly_tasks (restaurant_id, overrides_task_id, title, months, sort_order, removed, active)
    values (p_restaurant, t.id, t.title, t.months, t.sort_order, true, true)
    on conflict (restaurant_id, overrides_task_id) where overrides_task_id is not null do update
      set removed = true, updated_at = now();
  else
    update public.quarterly_tasks set removed = false, updated_at = now()
    where restaurant_id = p_restaurant and overrides_task_id = t.id;
  end if;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when p_removed then 'quarterly_task.remove' else 'quarterly_task.restore' end,
    p_restaurant, jsonb_build_object('id', t.id, 'title', t.title));
end;
$$;
revoke all on function public.set_quarterly_task_removed(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_quarterly_task_removed(uuid, uuid, boolean) to authenticated;

-- "Use the all-restaurants version instead": the restaurant's version stops counting. It is
-- turned off, not deleted, since walkthroughs that had it point to it.
create function public.reset_quarterly_task(p_task uuid, p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.quarterly_task_check(p_restaurant);
  update public.quarterly_tasks set active = false, removed = false, updated_at = now()
  where restaurant_id = p_restaurant and overrides_task_id = p_task and p_restaurant is not null;
  if not found then
    raise exception 'this restaurant has no version of that task' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'quarterly_task.reset', p_restaurant, jsonb_build_object('id', p_task));
end;
$$;
revoke all on function public.reset_quarterly_task(uuid, uuid) from public, anon;
grant execute on function public.reset_quarterly_task(uuid, uuid) to authenticated;

-- Turn a group task or a restaurant's own off or on, by the archive rule: off goes on no
-- new walkthrough, and one open keeps it.
create function public.set_quarterly_task_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.quarterly_tasks;
begin
  select * into t from public.quarterly_tasks where id = p_id and overrides_task_id is null for update;
  if t.id is null or p_active is null then
    raise exception 'no such task' using errcode = 'P0002';
  end if;
  perform public.quarterly_task_check(t.restaurant_id);
  update public.quarterly_tasks set active = p_active, updated_at = now() where id = t.id;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when p_active then 'quarterly_task.turn_on' else 'quarterly_task.turn_off' end,
    t.restaurant_id, jsonb_build_object('id', t.id, 'title', t.title));
end;
$$;
revoke all on function public.set_quarterly_task_active(uuid, boolean) from public, anon;
grant execute on function public.set_quarterly_task_active(uuid, boolean) to authenticated;

-- Delete a group task or a restaurant's own only while no walkthrough has had it, nor any
-- restaurant's version of it; otherwise turn it off. A check on it would go with it.
create function public.delete_quarterly_task(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.quarterly_tasks;
begin
  select * into t from public.quarterly_tasks where id = p_id and overrides_task_id is null for update;
  if t.id is null then
    raise exception 'no such task' using errcode = 'P0002';
  end if;
  perform public.quarterly_task_check(t.restaurant_id);
  if exists (select 1 from public.walkthrough_tasks w where w.root_id = t.id)
     or exists (select 1 from public.walkthrough_checks c join public.quarterly_tasks q on q.id = c.quarterly_task_id
                where q.id = t.id or q.overrides_task_id = t.id) then
    raise exception 'a walkthrough has had this task; turn it off instead' using errcode = '23503';
  end if;
  delete from public.quarterly_tasks where id = t.id;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'quarterly_task.delete', t.restaurant_id, jsonb_build_object('id', t.id, 'title', t.title));
end;
$$;
revoke all on function public.delete_quarterly_task(uuid) from public, anon;
grant execute on function public.delete_quarterly_task(uuid) to authenticated;

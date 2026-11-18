-- A restaurant's removal of a group task, restored, followed the group's task again in
-- name only (found building OT-135): Remove writes a version row, and Restore left it in use,
-- so the task read as Changed for the restaurant, its title as it was on the day. A version
-- now says whether the restaurant changed the task; Restore brings back only a changed one,
-- and otherwise the restaurant follows the group's task again. As before (20261125120000)
-- otherwise.

alter table public.quarterly_tasks add column changed boolean not null default false;
-- Versions so far: one in use and not removed was made by a change.
update public.quarterly_tasks set changed = true
where overrides_task_id is not null and active and not removed;

create or replace function public.save_quarterly_task(
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
    insert into public.quarterly_tasks (restaurant_id, overrides_task_id, title, directions, video_url, months, sort_order, changed)
    values (p_restaurant, t.id, v_title, v_directions, v_video, coalesce(v_months, t.months), t.sort_order, true)
    on conflict (restaurant_id, overrides_task_id) where overrides_task_id is not null do update
      set title = excluded.title, directions = excluded.directions, video_url = excluded.video_url,
          months = excluded.months, removed = false, active = true, changed = true, updated_at = now()
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

create or replace function public.set_quarterly_task_removed(p_task uuid, p_restaurant uuid, p_removed boolean)
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
    insert into public.quarterly_tasks (restaurant_id, overrides_task_id, title, months, sort_order, removed, active, changed)
    values (p_restaurant, t.id, t.title, t.months, t.sort_order, true, true, false)
    on conflict (restaurant_id, overrides_task_id) where overrides_task_id is not null do update
      -- A changed version still in use comes back on Restore; anything else follows the group's.
      set removed = true, changed = quarterly_tasks.active and quarterly_tasks.changed, active = true,
          updated_at = now();
  else
    -- Back to the restaurant's changed wording if it had one, else to the group's.
    update public.quarterly_tasks set removed = false, active = changed, updated_at = now()
    where restaurant_id = p_restaurant and overrides_task_id = t.id;
  end if;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when p_removed then 'quarterly_task.remove' else 'quarterly_task.restore' end,
    p_restaurant, jsonb_build_object('id', t.id, 'title', t.title));
end;
$$;

create or replace function public.reset_quarterly_task(p_task uuid, p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.quarterly_task_check(p_restaurant);
  update public.quarterly_tasks set active = false, removed = false, changed = false, updated_at = now()
  where restaurant_id = p_restaurant and overrides_task_id = p_task and p_restaurant is not null;
  if not found then
    raise exception 'this restaurant has no version of that task' using errcode = 'P0002';
  end if;
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'quarterly_task.reset', p_restaurant, jsonb_build_object('id', p_task));
end;
$$;

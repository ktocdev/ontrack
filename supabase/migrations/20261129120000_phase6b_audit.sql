-- Security and code quality pass over 6b (OT-138). What 6b added (20261121120000 to
-- 20261128120000) was read through and probed on the local stack. Five fixes:
--
-- 1. The group's rotation, every checklist and the group's quarterly tasks checked
--    can('set_walkthrough_schedule') with no restaurant, which passes for a Reporter given
--    the right at one restaurant, who could then change what every restaurant walks. They
--    are the group's, like categories (20261106140000): Ops holding the right, and admins.
--    A restaurant's own rotation choice and its own quarterly tasks still go by the right
--    at that restaurant.
-- 2. A month could land on a checklist an edit had just replaced: the trigger that refuses
--    it read the checklist without waiting for an edit in progress, so a rotation saved at
--    the same moment as the first edit kept the old version, which nothing could then
--    change. It now takes a lock on the checklist first, and watches updates too.
-- 3. A turned-off category could be put on a checklist item, by the editor or an import,
--    and a ticket from that item was then refused, with no way to pick another, since the
--    sheet asks only for an item with none. A turned-off category goes on no item new to
--    it, as on no new ticket or unit; and where an item's or a fix's category was turned
--    off later, a ticket from it asks for one instead of failing.
-- 4. Send reminder went out for an archived restaurant, where the daily job sends none.
-- 5. A change to a restaurant's quarterly task named by its own id was logged without the
--    restaurant.

-- ---------------------------------------------------------------------------
-- 1. Who changes what is the group's
-- ---------------------------------------------------------------------------

create function public.can_edit_walkthrough_setup()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin() or (public.my_role() = 'ops' and public.can('set_walkthrough_schedule'));
$$;
revoke all on function public.can_edit_walkthrough_setup() from public, anon;
grant execute on function public.can_edit_walkthrough_setup() to authenticated;

-- As before (20261121120000), with the check above.
create or replace function public.save_rotation(
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
  if not public.can_edit_walkthrough_setup() then
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

create or replace function public.delete_rotation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.can_edit_walkthrough_setup() then
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

-- As before (20261125120000): the group's tasks (no restaurant) by the check above, a
-- restaurant's with the right at that restaurant, not archived.
create or replace function public.quarterly_task_check(p_restaurant uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (p_restaurant is null and not public.can_edit_walkthrough_setup())
     or (p_restaurant is not null and not public.can('set_walkthrough_schedule', p_restaurant)) then
    raise exception 'you cannot change the quarterly tasks here' using errcode = '42501';
  end if;
  if p_restaurant is not null
     and not exists (select 1 from public.restaurants where id = p_restaurant and archived_at is null) then
    raise exception 'the restaurant is archived or does not exist' using errcode = '22023';
  end if;
end;
$$;

-- As before (20261127120000), with the check above. Every editor function and the import
-- start here, so they follow.
create or replace function public.checklist_for_change(p_template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.walkthrough_templates;
  v_id uuid;
begin
  if not public.can_edit_walkthrough_setup() then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  select * into t from public.walkthrough_templates where id = p_template for update;
  if t.id is null then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  if t.replaced_by is not null then
    raise exception 'this checklist has a newer version; reload it' using errcode = '40001';
  end if;
  if not exists (select 1 from public.walkthroughs where template_id = t.id) then
    return t.id;
  end if;
  v_id := public.copy_checklist(t.id, null);
  update public.walkthrough_templates set replaced_by = v_id, updated_at = now() where id = t.id;
  update public.walkthrough_rotation_months set template_id = v_id where template_id = t.id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'checklist.version', jsonb_build_object('from', t.id, 'to', v_id, 'name', t.name));
  return v_id;
end;
$$;

create or replace function public.add_checklist(p_name text, p_description text, p_short_name text, p_copy_from uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_edit_walkthrough_setup() then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  if p_copy_from is not null then
    if not exists (select 1 from public.walkthrough_templates where id = p_copy_from) then
      raise exception 'no such checklist' using errcode = 'P0002';
    end if;
    v_id := public.copy_checklist(p_copy_from, btrim(p_name));
    -- A copy to change is new: its parts have no history of their own.
    update public.walkthrough_templates set copied_from = null, active = true where id = v_id;
    update public.walkthrough_sections set copied_from = null where template_id = v_id;
    update public.walkthrough_items i set copied_from = null
    from public.walkthrough_sections s where s.id = i.section_id and s.template_id = v_id;
    update public.walkthrough_templates
    set description = nullif(btrim(coalesce(p_description, '')), ''), short_name = nullif(btrim(coalesce(p_short_name, '')), '')
    where id = v_id;
  else
    insert into public.walkthrough_templates (name, description, short_name)
    values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_description, '')), ''),
            nullif(btrim(coalesce(p_short_name, '')), ''))
    returning id into v_id;
  end if;
  perform public.checklist_log('checklist.add', v_id, jsonb_build_object('name', btrim(p_name), 'copy_of', p_copy_from));
  return v_id;
end;
$$;

create or replace function public.set_checklist_active(p_template uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_walkthrough_setup() then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  update public.walkthrough_templates set active = p_active, updated_at = now()
  where id = p_template and replaced_by is null and p_active is not null;
  if not found then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  perform public.checklist_log(case when p_active then 'checklist.turn_on' else 'checklist.turn_off' end, p_template, null);
end;
$$;

create or replace function public.delete_checklist(p_template uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.can_edit_walkthrough_setup() then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  select name into v_name from public.walkthrough_templates where id = p_template for update;
  if v_name is null then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.walkthroughs where template_id = p_template)
     or exists (select 1 from public.walkthrough_rotation_months where template_id = p_template) then
    raise exception 'a walkthrough or a rotation uses this checklist; turn it off instead' using errcode = '23503';
  end if;
  delete from public.walkthrough_templates where id = p_template;
  perform public.checklist_log('checklist.delete', p_template, jsonb_build_object('name', v_name));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A month never lands on a replaced checklist
-- ---------------------------------------------------------------------------

-- As before (20261127120000), reading the checklist under a lock: an edit that is making a
-- new version holds the checklist until it is done, so this waits and then sees it replaced.
create or replace function public.rotation_months_current()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_replaced boolean;
begin
  select replaced_by is not null into v_replaced
  from public.walkthrough_templates where id = new.template_id for share;
  if v_replaced then
    raise exception 'that checklist has a newer version' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger rotation_months_current on public.walkthrough_rotation_months;
create trigger rotation_months_current before insert or update of template_id on public.walkthrough_rotation_months
  for each row execute function public.rotation_months_current();

-- ---------------------------------------------------------------------------
-- 3. A turned-off category
-- ---------------------------------------------------------------------------

-- It goes on no item new to it. An item that has it keeps it, and so does that item's copy
-- in a new version of its checklist.
create function public.walkthrough_items_category_active()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is null or public.is_service() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.category_id is not distinct from old.category_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.copied_from is not null and exists (
    select 1 from public.walkthrough_items where id = new.copied_from and category_id = new.category_id
  ) then
    return new;
  end if;
  if exists (select 1 from public.categories where id = new.category_id and not active) then
    raise exception 'this category is turned off' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.walkthrough_items_category_active() from public, anon, authenticated;
create trigger walkthrough_items_category_active before insert or update of category_id on public.walkthrough_items
  for each row execute function public.walkthrough_items_category_active();

-- As before (20261113120000), except an item's category that has since been turned off
-- counts as none, so the sheet's own choice is asked for.
create or replace function public.create_walkthrough_ticket(
  p_walkthrough_id uuid,
  p_title text,
  p_item_id uuid default null,
  p_task_id uuid default null,
  p_description text default null,
  p_urgency public.ticket_urgency default 'normal',
  p_equipment_id uuid default null,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  v_target record;
  v_check uuid;
  v_category uuid;
  v_id uuid;
begin
  select * into v_target from public.walkthrough_target(w, p_item_id, p_task_id);
  v_category := coalesce(
    p_category_id,
    (select c.id from public.categories c where c.id = v_target.category_id and c.active)
  );
  if v_category is null then
    raise exception 'pick a category for this ticket' using errcode = '22023';
  end if;
  v_check := public.walkthrough_check_for(w, p_item_id, p_task_id, 'ticket');

  perform set_config('ontrack.walkthrough_ticket', '1', true);
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, description, urgency,
                              source, walkthrough_id, walkthrough_check_id, created_by)
  values (w.restaurant_id, v_category, p_equipment_id, btrim(coalesce(p_title, '')),
          nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_urgency, 'normal'),
          'walkthrough', w.id, v_check, auth.uid())
  returning id into v_id;
  perform set_config('ontrack.walkthrough_ticket', '', true);
  return v_id;
end;
$$;

-- As before (20261123120000), with the same rule for the fix's category and its item's.
create or replace function public.convert_inhouse_fix(
  p_id uuid, p_category_id uuid default null, p_urgency public.ticket_urgency default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.inhouse_fixes;
  v_category uuid;
  v_id uuid;
begin
  select * into f from public.inhouse_fixes where id = p_id for update;
  -- Another restaurant's fix reads the same as one that doesn't exist.
  if f.id is null or not public.can('update_status', f.restaurant_id) then
    raise exception 'no such fix' using errcode = 'P0002';
  end if;
  if f.converted_ticket_id is not null then
    raise exception 'it is a ticket already' using errcode = '22023';
  end if;
  if f.done_at is not null then
    raise exception 'it is fixed already' using errcode = '22023';
  end if;
  v_category := coalesce(
    p_category_id,
    (select c.id from public.categories c where c.id = f.category_id and c.active),
    (select c.id from public.walkthrough_checks k
     join public.walkthrough_items i on i.id = k.item_id
     join public.categories c on c.id = i.category_id and c.active
     where k.id = f.check_id)
  );
  if v_category is null then
    raise exception 'pick a category for this ticket' using errcode = '22023';
  end if;

  if f.walkthrough_id is not null then
    -- The same lock the walkthrough's own functions take on its checks.
    perform 1 from public.walkthroughs where id = f.walkthrough_id for update;
    perform set_config('ontrack.walkthrough_ticket', '1', true);
  end if;
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, description, urgency,
                              source, walkthrough_id, walkthrough_check_id, created_by)
  values (f.restaurant_id, v_category, f.equipment_id, f.title, f.note, coalesce(p_urgency, 'normal'),
          case when f.walkthrough_id is not null then 'walkthrough' else 'reported' end::public.ticket_source,
          f.walkthrough_id, f.check_id, auth.uid())
  returning id into v_id;
  perform set_config('ontrack.walkthrough_ticket', '', true);

  update public.inhouse_fixes set converted_ticket_id = v_id, check_id = null where id = f.id;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'inhouse_fix.convert', f.restaurant_id,
    jsonb_build_object('inhouse_fix_id', f.id, 'ticket_id', v_id, 'title', f.title));
  perform public.notify_inhouse_task(f.id, v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. No reminder for an archived restaurant
-- ---------------------------------------------------------------------------

-- As before (20261122120000), refusing an archived restaurant as the daily job skips it.
create or replace function public.send_walkthrough_reminder(p_walkthrough uuid)
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
  if exists (select 1 from public.restaurants where id = v_w.restaurant_id and archived_at is not null) then
    raise exception 'this restaurant is archived' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 5. The log names the restaurant
-- ---------------------------------------------------------------------------

-- As before (20261126120000), except the log row names the task's restaurant when the
-- task is named by its own id and no restaurant is given.
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
  values (auth.uid(), v_action, coalesce(p_restaurant, t.restaurant_id),
    jsonb_build_object('id', v_id, 'of', p_id, 'title', v_title, 'months', coalesce(v_months, t.months)));
  return v_id;
end;
$$;

-- OT-110: fixes from the security pass over Phase 6a (the manager's walkthrough).
--
-- 1. Ops could give any ticket the Walkthrough tag, link it to a walkthrough, or take both
--    off a walkthrough's ticket, with an update through the API. tickets_guard lets Ops
--    change where a ticket came from, and the origin trigger only watched inserts and the
--    check. Where a ticket came from on a walkthrough is now written only by
--    create_walkthrough_ticket (and, in 6b, Convert to ticket), on an update as on an insert.
--
-- 2. Deleting an item's only in-house fix left its check behind, saying In-house with
--    nothing under it. Nothing read it as done, but a check is meant to exist only while
--    its item is Good or has a fix or a ticket, and 6b's turned-off items stay on a
--    walkthrough that "already checked" them by that row. delete_inhouse_fix now takes the
--    empty check with it.
--
-- 3. Before 6b gives Ops the checklist, the schedule and the quarterly tasks to edit: a
--    how-to video link is a web address and nothing else (it becomes a link people tap),
--    and a schedule's months and reminder days are real ones.

-- 1. Where a ticket came from -----------------------------------------------------------

create or replace function public.tickets_walkthrough_origin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_marked boolean := coalesce(current_setting('ontrack.walkthrough_ticket', true), '') = '1';
begin
  if not public.is_service() and not v_marked then
    if tg_op = 'INSERT' and (new.source = 'walkthrough' or new.walkthrough_id is not null
                             or new.walkthrough_check_id is not null) then
      raise exception 'a walkthrough ticket is made from the walkthrough' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.walkthrough_check_id is distinct from old.walkthrough_check_id
      or new.walkthrough_id is distinct from old.walkthrough_id
      or (new.source is distinct from old.source and 'walkthrough' in (new.source, old.source))
    ) then
      raise exception 'a walkthrough ticket is made from the walkthrough' using errcode = '42501';
    end if;
  end if;
  if new.walkthrough_check_id is not null and not exists (
    select 1 from public.walkthrough_checks c
    where c.id = new.walkthrough_check_id and c.walkthrough_id = new.walkthrough_id
  ) then
    raise exception 'a ticket links only to a check of its own walkthrough' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.tickets_walkthrough_origin() from public, anon;

-- 2. A check goes with its last fix -----------------------------------------------------

create or replace function public.delete_inhouse_fix(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.inhouse_fixes;
begin
  select * into f from public.inhouse_fixes where id = p_id for update;
  if f.id is null or not public.can('create_tickets', f.restaurant_id) then
    raise exception 'you can''t delete this task' using errcode = '42501';
  end if;
  if f.first_done_at is not null then
    raise exception 'a task that was checked off stays on the record' using errcode = '23514';
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'inhouse_fix.delete', f.restaurant_id,
          jsonb_build_object('title', f.title, 'origin', f.origin_label));

  delete from public.inhouse_fixes where id = p_id;

  if f.check_id is not null then
    -- The lock the walkthrough's own functions take, so a fix or ticket being added to
    -- this item at the same moment is seen before its check is judged empty.
    perform 1 from public.walkthroughs where id = f.walkthrough_id for update;
    delete from public.walkthrough_checks c
    where c.id = f.check_id
      and c.result <> 'good'
      and not exists (select 1 from public.inhouse_fixes x where x.check_id = c.id)
      and not exists (select 1 from public.tickets k where k.walkthrough_check_id = c.id);
  end if;
end;
$$;
revoke all on function public.delete_inhouse_fix(uuid) from public, anon;
grant execute on function public.delete_inhouse_fix(uuid) to authenticated;

-- Checks already left empty.
delete from public.walkthrough_checks c
where c.result <> 'good'
  and not exists (select 1 from public.inhouse_fixes x where x.check_id = c.id)
  and not exists (select 1 from public.tickets k where k.walkthrough_check_id = c.id);

-- 3. What the checklist and the schedule may hold ---------------------------------------

-- A link that isn't a web address would show no video card; drop it rather than fail.
update public.quarterly_tasks set video_url = null
where video_url is not null and video_url !~* '^https?://[^[:space:]]+$';
update public.walkthrough_items set video_url = null
where video_url is not null and video_url !~* '^https?://[^[:space:]]+$';

alter table public.quarterly_tasks
  add constraint quarterly_tasks_video_url_shape
    check (video_url is null or (video_url ~* '^https?://[^[:space:]]+$' and char_length(video_url) <= 500)),
  add constraint quarterly_tasks_months_real
    check (1 <= all (months) and 12 >= all (months));
alter table public.walkthrough_items
  add constraint walkthrough_items_video_url_shape
    check (video_url is null or (video_url ~* '^https?://[^[:space:]]+$' and char_length(video_url) <= 500));
alter table public.walkthrough_schedules
  add constraint walkthrough_schedules_months_real
    check (1 <= all (months) and 12 >= all (months)),
  add constraint walkthrough_schedules_reminder_days_real
    check (0 <= all (reminder_days) and 31 >= all (reminder_days));

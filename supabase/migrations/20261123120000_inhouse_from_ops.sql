-- In-house tasks from Ops (OT-128, 6b; decided Nov 16, 2026). Three ways Ops reaches a
-- restaurant's In-house list, each a checked, logged function holding Update status at the
-- restaurant, and each one notification to its Reporters:
--
-- 1. add_inhouse_task: a title, a note and an optional unit, which brings its category.
-- 2. convert_inhouse_fix: a fix that needs a contractor becomes a ticket (with the
--    Walkthrough tag when it came from one, nobody on it). The fix stays on the record as
--    converted and leaves the restaurant's list; the ticket takes over the item's check, so
--    the walkthrough counts the item as a ticket.
-- 3. hand_back_ticket: the reverse. One step closes the ticket and adds the task with the
--    ticket's unit and category and a link back; the close sends nothing, the task does.
--
-- The notification is one kind, inhouse_task, about the task (and its ticket, when there is
-- one), with its own Profile switch. It goes by My categories (OT-116): the task's category,
-- else its area; a task is never urgent, so Urgent only lets it by only when it is yours.

-- ---------------------------------------------------------------------------
-- 1. The task
-- ---------------------------------------------------------------------------

alter table public.inhouse_fixes
  add column equipment_id uuid references public.equipment (id),
  add column category_id uuid references public.categories (id),
  add column from_ticket_id uuid references public.tickets (id),
  add column from_ops boolean not null default false,
  add constraint inhouse_fixes_note_length check (note is null or char_length(note) <= 1000),
  add constraint inhouse_fixes_from_ticket_is_ops check (from_ticket_id is null or from_ops);

-- A direct insert still makes only a manager's own plain task.
drop policy inhouse_fixes_insert on public.inhouse_fixes;
create policy inhouse_fixes_insert on public.inhouse_fixes
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id) and created_by = auth.uid()
    and done_at is null and done_by is null and first_done_at is null
    and walkthrough_id is null and check_id is null and origin_label is null and converted_ticket_id is null
    and equipment_id is null and category_id is null and from_ticket_id is null and not from_ops
  );

-- A fix converted to a ticket is the ticket's record now: nothing changes or deletes it.
create function public.inhouse_fixes_converted_stay()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.converted_ticket_id is not null and not public.is_service() then
    raise exception 'a fix converted to a ticket stays as it is' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.inhouse_fixes_converted_stay() from public, anon, authenticated;
create trigger inhouse_fixes_converted_stay before update or delete on public.inhouse_fixes
  for each row execute function public.inhouse_fixes_converted_stay();

-- ---------------------------------------------------------------------------
-- 2. The notification
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column inhouse_fix_id uuid references public.inhouse_fixes (id) on delete cascade;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_ticket', 'reopened', 'status_change', 'update', 'walkthrough_reminder', 'inhouse_task'));
alter table public.notifications drop constraint notifications_about_one;
alter table public.notifications add constraint notifications_about_one check (
  case kind
    when 'walkthrough_reminder' then walkthrough_id is not null and ticket_id is null and inhouse_fix_id is null
    -- Its ticket, when there is one: the one it became, or the one handed back.
    when 'inhouse_task' then inhouse_fix_id is not null and walkthrough_id is null and days_before is null
    else ticket_id is not null and walkthrough_id is null and days_before is null and inhouse_fix_id is null
  end
);

alter table public.notification_prefs drop constraint notification_prefs_kind_check;
alter table public.notification_prefs add constraint notification_prefs_kind_check
  check (kind in ('new_ticket', 'reopened', 'status_change', 'update', 'walkthrough_reminder', 'inhouse_task', 'email'));

alter table public.notification_deliveries
  add column inhouse_fix_id uuid references public.inhouse_fixes (id) on delete set null;

-- As before (20261117130000), plus inhouse_task: the restaurant's Reporters who can file
-- tickets there, by My categories, with the task's category and area when it has no ticket.
create or replace function public.notification_recipients(p_notification uuid)
returns table (user_id uuid, email text, full_name text, push boolean, send_email boolean)
language sql
stable
security definer
set search_path = public
as $$
  with n as (
    select x.*, coalesce(t.restaurant_id, w.restaurant_id, f.restaurant_id) as restaurant_id,
      t.created_by, t.assignee_id, coalesce(t.category_id, f.category_id) as category_id, t.urgency,
      coalesce(c.area, f.area) as area, a.role as actor_role, w.status as walkthrough_status
    from public.notifications x
    left join public.tickets t on t.id = x.ticket_id
    left join public.inhouse_fixes f on f.id = x.inhouse_fix_id
    left join public.categories c on c.id = coalesce(t.category_id, f.category_id)
    left join public.walkthroughs w on w.id = x.walkthrough_id
    left join public.profiles a on a.id = x.actor_id
    where x.id = p_notification
  ),
  people as (
    select p.id, p.email, p.full_name, p.role, n.actor_id, n.actor_role, n.kind, n.internal, n.created_by,
      n.assignee_id, n.status_to, n.picked_up, n.walkthrough_status, n.urgency,
      coalesce(
        (select r.allowed from public.rights r where r.user_id = p.id and r.key = 'create_tickets'),
        (select r.allowed from public.rights r where r.role = p.role and r.user_id is null and r.key = 'create_tickets'),
        false
      ) as creates_tickets,
      coalesce(
        (select cp.notify from public.category_prefs cp where cp.user_id = p.id and cp.category_id = n.category_id),
        (select ap.notify from public.area_prefs ap where ap.user_id = p.id and ap.area = n.area),
        'all'
      ) as notify
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
  wanted as (
    select *,
      coalesce(id = created_by, false) or coalesce(id = assignee_id, false) as mine
    from people
  ),
  pooled as (
    select *, mine or notify = 'all' or (notify = 'urgent' and urgency is not distinct from 'urgent') as pool
    from wanted
  ),
  chosen as (
    select *,
      not internal and (
        (kind in ('new_ticket', 'reopened') and role = 'ops' and pool)
        or (kind = 'update' and mine)
        or (kind = 'status_change' and status_to is not null and mine)
        or (kind = 'walkthrough_reminder' and role = 'manager' and creates_tickets and walkthrough_status = 'open')
        or (kind = 'inhouse_task' and role = 'manager' and creates_tickets and pool)
      ) as told,
      role = 'ops' and (
        id is not distinct from actor_id
        or (actor_role = 'ops' and kind = 'status_change' and (picked_up or status_to = 'closed') and pool)
      ) as ops_record
    from pooled
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

-- As before (20261102160000), except a ticket closed by hand_back_ticket sends nothing of
-- its own: the task it became is the one notification.
create or replace function public.notify_on_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if new.kind = 'closed' and current_setting('ontrack.hand_back', true) = new.ticket_id::text then
    return new;
  end if;
  if new.kind = 'assigned' then
    -- Nobody on it now is told by its status, which comes with it.
    if new.meta ->> 'to' is null then
      return new;
    end if;
    insert into public.notifications (ticket_id, kind, actor_id, picked_up, created_at)
    values (new.ticket_id, 'status_change', new.author_id, true, new.created_at);
    perform public.notify_send_push();
    return new;
  end if;
  if new.kind in ('status_changed', 'closed') then
    update public.notifications n set status_to = new.meta ->> 'to', body = new.body
    where n.ticket_id = new.ticket_id and n.kind = 'status_change' and n.picked_up and n.status_to is null
      and n.actor_id is not distinct from new.author_id and n.created_at = new.created_at;
    if found then
      return new;
    end if;
  end if;
  if new.kind = 'message' then
    update public.notifications n set body = new.body
    where n.ticket_id = new.ticket_id and n.kind = 'reopened' and n.actor_id is not distinct from new.author_id
      and n.created_at = new.created_at and n.body is null;
    if found then
      return new;
    end if;
  end if;

  v_kind := case new.kind
    when 'created' then 'new_ticket'
    when 'reopened' then 'reopened'
    when 'message' then 'update'
    else 'status_change'
  end;
  insert into public.notifications (ticket_id, kind, actor_id, body, internal, status_to, created_at)
  values (new.ticket_id, v_kind, new.author_id, new.body, new.internal, new.meta ->> 'to', new.created_at);
  perform public.notify_send_push();
  return new;
end;
$$;

-- The walkthrough's in-house count leaves out a fix that became a ticket, which it counts
-- as a ticket instead. As before (20261122120000) otherwise.
create or replace view public.v_walkthrough_summary with (security_invoker = true) as
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
       (select count(*)::int from public.inhouse_fixes f
        where f.walkthrough_id = w.id and f.converted_ticket_id is null) as fixes,
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
-- 3. The functions
-- ---------------------------------------------------------------------------

-- The one notification each of these sends.
create function public.notify_inhouse_task(p_fix uuid, p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (inhouse_fix_id, ticket_id, kind, actor_id)
  values (p_fix, p_ticket, 'inhouse_task', auth.uid());
  perform public.notify_send_push();
end;
$$;
revoke all on function public.notify_inhouse_task(uuid, uuid) from public, anon, authenticated;

-- Add a task to a restaurant's list. A unit brings its category and area; without one, the
-- area may be given.
create function public.add_inhouse_task(
  p_restaurant uuid, p_title text, p_note text default null, p_equipment_id uuid default null,
  p_area public.area default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_area public.area := p_area;
  v_id uuid;
begin
  if p_restaurant is null or not public.can('update_status', p_restaurant) then
    raise exception 'you can''t add a task here' using errcode = '42501';
  end if;
  if p_equipment_id is not null then
    select e.category_id, c.area into v_category, v_area
    from public.equipment e left join public.categories c on c.id = e.category_id
    where e.id = p_equipment_id and e.restaurant_id = p_restaurant and e.retired_at is null;
    if not found then
      raise exception 'that unit is retired or not at this restaurant' using errcode = '22023';
    end if;
  end if;

  insert into public.inhouse_fixes (restaurant_id, title, note, equipment_id, category_id, area, created_by, from_ops)
  values (p_restaurant, btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_note, '')), ''),
          p_equipment_id, v_category, v_area, auth.uid(), true)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'inhouse_task.add', p_restaurant, jsonb_build_object('inhouse_fix_id', v_id, 'title', btrim(p_title)));
  perform public.notify_inhouse_task(v_id, null);
  return v_id;
end;
$$;
revoke all on function public.add_inhouse_task(uuid, text, text, uuid, public.area) from public, anon;
grant execute on function public.add_inhouse_task(uuid, text, text, uuid, public.area) to authenticated;

-- Make an open fix a ticket. It takes the fix's unit and category, else its item's, else the
-- one given; from a walkthrough it carries the tag and takes over the item's check.
create function public.convert_inhouse_fix(
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
    p_category_id, f.category_id,
    (select i.category_id from public.walkthrough_checks c join public.walkthrough_items i on i.id = c.item_id
     where c.id = f.check_id)
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
revoke all on function public.convert_inhouse_fix(uuid, uuid, public.ticket_urgency) from public, anon;
grant execute on function public.convert_inhouse_fix(uuid, uuid, public.ticket_urgency) to authenticated;

-- Close a ticket and hand it back as a task, in one step.
create function public.hand_back_ticket(p_ticket uuid, p_title text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets;
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if t.id is null or not public.can('update_status', t.restaurant_id) then
    raise exception 'no such ticket' using errcode = 'P0002';
  end if;
  if t.status = 'closed' then
    raise exception 'the ticket is closed already' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 140 then
    raise exception 'say what to do, in up to 140 characters' using errcode = '22023';
  end if;

  perform set_config('ontrack.hand_back', t.id::text, true);
  update public.tickets set status = 'closed', resolution = 'Handed back as an in-house task: ' || v_title
  where id = t.id;
  perform set_config('ontrack.hand_back', '', true);

  insert into public.inhouse_fixes (restaurant_id, title, note, equipment_id, category_id, area,
                                    created_by, from_ops, from_ticket_id)
  values (t.restaurant_id, v_title, nullif(btrim(coalesce(p_note, '')), ''), t.equipment_id, t.category_id,
          (select c.area from public.categories c where c.id = t.category_id), auth.uid(), true, t.id)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'ticket.hand_back', t.restaurant_id,
    jsonb_build_object('ticket_id', t.id, 'inhouse_fix_id', v_id, 'title', v_title));
  perform public.notify_inhouse_task(v_id, t.id);
  return v_id;
end;
$$;
revoke all on function public.hand_back_ticket(uuid, text, text) from public, anon;
grant execute on function public.hand_back_ticket(uuid, text, text) to authenticated;

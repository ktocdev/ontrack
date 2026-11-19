-- OT-141 (from feedback, Nov 19, 2026): a ticket from a walkthrough needs no category.
--
-- The category list is what Reporters pick from on Create ticket. A checklist names many
-- things that are no category (caulk, paint, a wall), so an item's category is optional,
-- and a ticket from an item without an active one now takes none and asks for none:
--
-- 1. tickets.category_id may be empty, only on a walkthrough's ticket. Such a ticket keeps
--    the area its category would have given (`tickets.area`, from the item's section, or
--    asked for by the sheet when nothing gives one: a quarterly task, or a section still
--    without one), since the area decides the Front / Back / IT segments, My categories and
--    who is notified, as an in-house task with no category already does. Every walkthrough
--    ticket also keeps where it came from on the checklist (`checklist_place`, "FOH ›
--    Health and Safety › Caulk", or "Q4 · Clean the hood vents"), which the screens show
--    in place of the area and category. Both are written only by the walkthrough's
--    functions; giving such a ticket a category later clears its area.
-- 2. create_walkthrough_ticket and convert_inhouse_fix (for a walkthrough's fix) take the
--    item's active category as before, else none, with the area; a task added by hand
--    still needs a category, as every other ticket does.
-- 3. notification_recipients and hand_back_ticket read the ticket's own area where it has
--    no category.
-- 4. Every section names an area from now on: a new one, an edit and an import are refused
--    without one (a copy of an old section that had none keeps it, so the checklist stays
--    editable). Sections without one get it from their items' categories where they agree.

-- ---------------------------------------------------------------------------
-- 1. The ticket's own area and checklist place
-- ---------------------------------------------------------------------------

alter table public.tickets
  alter column category_id drop not null,
  add column area public.area,
  add column checklist_place text check (char_length(checklist_place) between 1 and 400),
  add constraint tickets_category_or_walkthrough_area check (
    category_id is not null
    or (source = 'walkthrough' and walkthrough_id is not null and area is not null)
  ),
  add constraint tickets_area_only_without_category check (category_id is null or area is null);

comment on column public.tickets.area is
  'Only on a walkthrough ticket with no category: the area its category would have given.';
comment on column public.tickets.checklist_place is
  'A walkthrough ticket''s place on its checklist (section › group › item), as it was made.';

-- A category given later takes the place of the area. Runs before tickets_walkthrough_origin
-- (triggers of one timing fire by name), so that guard sees the area already cleared.
create function public.tickets_area_follows_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null then
    new.area := null;
  end if;
  return new;
end;
$$;
revoke all on function public.tickets_area_follows_category() from public, anon, authenticated;

create trigger tickets_area_follows_category before insert or update on public.tickets
  for each row execute function public.tickets_area_follows_category();

-- As before (20261113160000), and the area and checklist place come only from the
-- walkthrough's functions too; an area may still be cleared, by a category given.
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
                             or new.walkthrough_check_id is not null
                             or new.area is not null or new.checklist_place is not null) then
      raise exception 'a walkthrough ticket is made from the walkthrough' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.walkthrough_check_id is distinct from old.walkthrough_check_id
      or new.walkthrough_id is distinct from old.walkthrough_id
      or (new.source is distinct from old.source and 'walkthrough' in (new.source, old.source))
      or new.checklist_place is distinct from old.checklist_place
      or (new.area is distinct from old.area and new.area is not null)
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

-- The guard also fires on the two new columns.
drop trigger tickets_walkthrough_origin on public.tickets;
create trigger tickets_walkthrough_origin
  before insert or update of source, walkthrough_id, walkthrough_check_id, area, checklist_place on public.tickets
  for each row execute function public.tickets_walkthrough_origin();

-- Where an item or a quarterly task sits on its walkthrough's checklist, and the area its
-- section gives (a quarterly task has none). The task's title is the walkthrough's copy.
create function public.walkthrough_place(
  w public.walkthroughs, p_item_id uuid, p_task_id uuid, out place text, out area public.area
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(s.short_name, s.name) || ' › ' || i.group_name || ' › ' || i.title, s.area
  from public.walkthrough_items i
  join public.walkthrough_sections s on s.id = i.section_id
  where p_item_id is not null and i.id = p_item_id
  union all
  select 'Q' || extract(quarter from w.period) || ' · ' || t.title, null::public.area
  from public.walkthrough_tasks t
  where p_item_id is null and t.walkthrough_id = w.id and t.task_id = p_task_id
  limit 1
$$;
revoke all on function public.walkthrough_place(public.walkthroughs, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tickets from a walkthrough, with or without a category
-- ---------------------------------------------------------------------------

-- As before (20261129120000), except an item with no active category gives its ticket none:
-- the ticket takes the section's area, or the one given when there is none.
drop function public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid);
create function public.create_walkthrough_ticket(
  p_walkthrough_id uuid,
  p_title text,
  p_item_id uuid default null,
  p_task_id uuid default null,
  p_description text default null,
  p_urgency public.ticket_urgency default 'normal',
  p_equipment_id uuid default null,
  p_category_id uuid default null,
  p_area public.area default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  v_target record;
  v_place record;
  v_check uuid;
  v_category uuid;
  v_area public.area;
  v_id uuid;
begin
  select * into v_target from public.walkthrough_target(w, p_item_id, p_task_id);
  select * into v_place from public.walkthrough_place(w, p_item_id, p_task_id);
  v_category := coalesce(
    p_category_id,
    (select c.id from public.categories c where c.id = v_target.category_id and c.active)
  );
  if v_category is null then
    v_area := coalesce(v_place.area, p_area);
    if v_area is null then
      raise exception 'pick an area for this ticket' using errcode = '22023';
    end if;
  end if;
  v_check := public.walkthrough_check_for(w, p_item_id, p_task_id, 'ticket');

  perform set_config('ontrack.walkthrough_ticket', '1', true);
  insert into public.tickets (restaurant_id, category_id, area, checklist_place, equipment_id, title,
                              description, urgency, source, walkthrough_id, walkthrough_check_id, created_by)
  values (w.restaurant_id, v_category, v_area, v_place.place, p_equipment_id, btrim(coalesce(p_title, '')),
          nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_urgency, 'normal'),
          'walkthrough', w.id, v_check, auth.uid())
  returning id into v_id;
  perform set_config('ontrack.walkthrough_ticket', '', true);
  return v_id;
end;
$$;
revoke all on function public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid, public.area)
  from public, anon;
grant execute on function public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid, public.area)
  to authenticated;

-- As before (20261129120000), except a walkthrough's fix with no active category, of its own
-- or its item's, becomes a ticket with none: the fix's area (its section's), or the one
-- given. A task added by hand still needs a category.
drop function public.convert_inhouse_fix(uuid, uuid, public.ticket_urgency);
create function public.convert_inhouse_fix(
  p_id uuid, p_category_id uuid default null, p_urgency public.ticket_urgency default 'normal',
  p_area public.area default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.inhouse_fixes;
  w public.walkthroughs;
  k public.walkthrough_checks;
  v_place text;
  v_place_area public.area;
  v_category uuid;
  v_area public.area;
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
    (select c.id from public.walkthrough_checks x
     join public.walkthrough_items i on i.id = x.item_id
     join public.categories c on c.id = i.category_id and c.active
     where x.id = f.check_id)
  );

  if f.walkthrough_id is not null then
    -- The same lock the walkthrough's own functions take on its checks.
    select * into w from public.walkthroughs where id = f.walkthrough_id for update;
    select * into k from public.walkthrough_checks where id = f.check_id;
    if k.id is not null then
      select p.place, p.area into v_place, v_place_area
      from public.walkthrough_place(w, k.item_id, k.quarterly_task_id) p;
    end if;
  end if;
  if v_category is null then
    if f.walkthrough_id is null then
      raise exception 'pick a category for this ticket' using errcode = '22023';
    end if;
    v_area := coalesce(f.area, v_place_area, p_area);
    if v_area is null then
      raise exception 'pick an area for this ticket' using errcode = '22023';
    end if;
  end if;

  if f.walkthrough_id is not null then
    perform set_config('ontrack.walkthrough_ticket', '1', true);
  end if;
  insert into public.tickets (restaurant_id, category_id, area, checklist_place, equipment_id, title,
                              description, urgency, source, walkthrough_id, walkthrough_check_id, created_by)
  values (f.restaurant_id, v_category, v_area, v_place, f.equipment_id, f.title, f.note,
          coalesce(p_urgency, 'normal'),
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
revoke all on function public.convert_inhouse_fix(uuid, uuid, public.ticket_urgency, public.area) from public, anon;
grant execute on function public.convert_inhouse_fix(uuid, uuid, public.ticket_urgency, public.area) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The ticket's own area where it has no category
-- ---------------------------------------------------------------------------

-- As before (20261123120000), with a ticket's own area after its category's.
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
      coalesce(c.area, t.area, f.area) as area, a.role as actor_role, w.status as walkthrough_status
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

-- As before (20261123120000), with a ticket's own area where it has no category.
create or replace function public.hand_back_ticket(p_ticket uuid, p_title text, p_note text default null)
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
          coalesce((select c.area from public.categories c where c.id = t.category_id), t.area), auth.uid(), true, t.id)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'ticket.hand_back', t.restaurant_id,
    jsonb_build_object('ticket_id', t.id, 'inhouse_fix_id', v_id, 'title', v_title));
  perform public.notify_inhouse_task(v_id, t.id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Every section names an area
-- ---------------------------------------------------------------------------

-- A section without an area makes the quick ticket sheet ask for one, so a new section, an
-- edit and an import need one. A copy of an old section that had none keeps none, so the
-- checklist it is on can still be edited; the service role (migrations, the seed) passes.
create function public.walkthrough_sections_have_area()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.area is not null or public.is_service() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.copied_from is not null
     and exists (select 1 from public.walkthrough_sections s where s.id = new.copied_from and s.area is null) then
    return new;
  end if;
  raise exception 'every section needs an area' using errcode = '22023';
end;
$$;
revoke all on function public.walkthrough_sections_have_area() from public, anon, authenticated;

create trigger walkthrough_sections_have_area before insert or update of area on public.walkthrough_sections
  for each row execute function public.walkthrough_sections_have_area();

-- Sections without one take the area their items' categories agree on.
update public.walkthrough_sections s
set area = x.area
from (
  select i.section_id, (array_agg(distinct c.area))[1] as area
  from public.walkthrough_items i
  join public.categories c on c.id = i.category_id
  group by i.section_id
  having count(distinct c.area) = 1
) x
where s.id = x.section_id and s.area is null;

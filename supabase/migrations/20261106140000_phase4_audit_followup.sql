-- Fixes from the independent Phase 4 audit (OT-84), after OT-73.
--
-- 1. Categories are the group's, shared by every restaurant, so only Ops with
--    edit_equipment and admins change them (decided Nov 6, 2026: Ops knows what is on
--    the ground). can('edit_equipment') alone passed for a manager granted it at one
--    restaurant. No delete through the API: OT-86 adds turning one off, and deleting one
--    nothing has used, as logged functions.
--
-- 2. The database picks a new unit's id. A client could choose one, including a
--    deleted unit's, and so reach files left in that unit's folder.
--
-- 3. A service record is about its ticket's unit, whatever the client sent, and is
--    never deleted (the archive rule: records are corrected, not removed). A record
--    could name a unit at another restaurant, which put spend on it and kept it from
--    being deleted, and could be deleted to clear a unit's history.
--
-- 4. A task once checked off stays on the record: unchecking (a mis-tap) is logged and
--    no longer opens the way to deleting it.
--
-- 5. A new ticket's unit is locked while it is checked, so a unit moving to another
--    restaurant at the same moment can't leave the ticket pointing across restaurants.

-- 1. Categories -----------------------------------------------------------------------

drop policy categories_write on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.is_admin() or (public.my_role() = 'ops' and public.can('edit_equipment')));
create policy categories_update on public.categories
  for update to authenticated
  using (public.is_admin() or (public.my_role() = 'ops' and public.can('edit_equipment')))
  with check (public.is_admin() or (public.my_role() = 'ops' and public.can('edit_equipment')));

-- 2. A unit's id ----------------------------------------------------------------------

create or replace function public.equipment_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_service() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.created_by := auth.uid();
    new.retired_at := null;
    new.retired_by := null;
    -- Files belong under the unit's own folder, which doesn't exist until now.
    new.manual_path := null;
    new.plate_photo_path := null;
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if (new.retired_at, new.retired_by) is distinct from (old.retired_at, old.retired_by)
     and current_setting('ontrack.equipment_retire', true) is distinct from new.id::text then
    raise exception 'retire or restore a unit through set_equipment_retired' using errcode = '42501';
  end if;

  if new.restaurant_id <> old.restaurant_id then
    if exists (select 1 from public.restaurants where id = new.restaurant_id and archived_at is not null) then
      raise exception 'this restaurant is archived' using errcode = '42501';
    end if;
    if coalesce(public.equipment_in_use(old.id), true) then
      raise exception 'this unit has tickets or service records at its restaurant; retire it and add it at the other one'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.equipment_guard() from public, anon;

-- 3. Service records ------------------------------------------------------------------

create or replace function public.service_records_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_service() or new.equipment_id is null then
    select equipment_id into new.equipment_id from public.tickets where id = new.ticket_id;
  end if;
  if tg_op = 'INSERT' and (new.logged_by is null or not public.is_service()) then
    new.logged_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' then
    new.logged_by := old.logged_by;
  end if;
  return new;
end;
$$;

revoke all on function public.service_records_defaults() from public, anon;

drop trigger service_records_defaults on public.service_records;
create trigger service_records_defaults before insert or update on public.service_records
  for each row execute function public.service_records_defaults();

drop policy service_records_write on public.service_records;
create policy service_records_insert on public.service_records
  for insert to authenticated
  with check (public.can('log_cost', public.ticket_restaurant(ticket_id)));
create policy service_records_update on public.service_records
  for update to authenticated
  using (public.can('log_cost', public.ticket_restaurant(ticket_id)))
  with check (public.can('log_cost', public.ticket_restaurant(ticket_id)));

-- 4. In-house tasks -------------------------------------------------------------------

alter table public.inhouse_fixes add column first_done_at timestamptz;
update public.inhouse_fixes set first_done_at = done_at where done_at is not null;

create or replace function public.set_inhouse_fix_done(p_id uuid, p_done boolean)
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
    raise exception 'you can''t change this task' using errcode = '42501';
  end if;
  if (f.done_at is not null) = p_done then
    return;
  end if;

  update public.inhouse_fixes
  set done_at = case when p_done then now() end,
      done_by = case when p_done then auth.uid() end
  where id = p_id;

  if not p_done then
    insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
    values (auth.uid(), 'inhouse_fix.uncheck', f.restaurant_id,
            jsonb_build_object('inhouse_fix_id', p_id, 'title', f.title, 'done_at', f.done_at, 'done_by', f.done_by));
  end if;
end;
$$;

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
end;
$$;

revoke all on function public.set_inhouse_fix_done(uuid, boolean) from public, anon;
grant execute on function public.set_inhouse_fix_done(uuid, boolean) to authenticated;
revoke all on function public.delete_inhouse_fix(uuid) from public, anon;
grant execute on function public.delete_inhouse_fix(uuid) to authenticated;

-- Set whenever a task is checked off, however it was (the seed's too), and never cleared.
create or replace function public.inhouse_fixes_first_done()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.first_done_at := coalesce(case when tg_op = 'UPDATE' then old.first_done_at end, new.first_done_at, new.done_at);
  return new;
end;
$$;

revoke all on function public.inhouse_fixes_first_done() from public, anon;

create trigger inhouse_fixes_first_done before insert or update on public.inhouse_fixes
  for each row execute function public.inhouse_fixes_first_done();

-- A person's insert can't set it (the insert policy already keeps done_at null).
drop policy inhouse_fixes_insert on public.inhouse_fixes;
create policy inhouse_fixes_insert on public.inhouse_fixes
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id)
    and created_by = auth.uid()
    and done_at is null
    and done_by is null
    and first_done_at is null
    and walkthrough_id is null
    and check_id is null
    and origin_label is null
    and converted_ticket_id is null
  );

-- 5. A ticket's unit, locked while checked --------------------------------------------

-- Runs as definer: locking a row for share also applies its update policy, which would
-- skip the lock for a manager without edit_equipment. It reads only the unit's
-- restaurant and retired state; the ticket's own policies decide who may write it.

create or replace function public.tickets_equipment_here()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.equipment_id is not distinct from old.equipment_id then
    return new;
  end if;
  if new.equipment_id is not null then
    -- Waits for a move or retire in flight, then checks what it left.
    perform 1 from public.equipment where id = new.equipment_id for share;
    if not exists (
      select 1 from public.equipment e
      where e.id = new.equipment_id and e.restaurant_id = new.restaurant_id and e.retired_at is null
    ) then
      raise exception 'this equipment is not available at this restaurant' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.tickets_equipment_here() from public, anon;

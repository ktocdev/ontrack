-- Fixes from the Phase 4 security pass (OT-73).
--
-- 1. Files that belong to nothing. can(action, rid) reads a null restaurant as "any",
--    which suits rights with no restaurant (invite_users) but not storage: a file's
--    restaurant comes from the unit or service record named by its first folder, and
--    a folder that names none (junk, a made-up id, a deleted unit) gave null, so anyone
--    with edit_equipment anywhere could write, read and remove files there, and anyone
--    with see_costs or log_cost the same in invoices. Each policy now needs the parent
--    to exist. The tables are safe already: their foreign keys are not null.
--
-- 2. An in-house task added by a person is a task added by hand: no walkthrough, check,
--    origin or converted ticket, so the Walkthrough tag can't be claimed and nothing
--    links across restaurants. Phase 6 adds the walkthrough's own path. A person's task
--    is dated now, whatever the client sent, since "Added by Maya · Nov 6" shows it.
--
-- 3. A unit keeps its id: equipment_guard already keeps who made it and when.

-- 1. Storage --------------------------------------------------------------------------

drop policy "manuals: read in scope" on storage.objects;
drop policy "manuals: write with edit_equipment" on storage.objects;
create policy "manuals: read in scope" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'manuals'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.has_scope(public.equipment_restaurant(public.path_uuid(name)))
  );
create policy "manuals: write with edit_equipment" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'manuals'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'manuals'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  );

drop policy "equipment photos: read in scope" on storage.objects;
drop policy "equipment photos: write with edit_equipment" on storage.objects;
create policy "equipment photos: read in scope" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'equipment-photos'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.has_scope(public.equipment_restaurant(public.path_uuid(name)))
  );
create policy "equipment photos: write with edit_equipment" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'equipment-photos'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'equipment-photos'
    and public.equipment_restaurant(public.path_uuid(name)) is not null
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  );

drop policy "invoices: read with see_costs" on storage.objects;
drop policy "invoices: write with log_cost" on storage.objects;
create policy "invoices: read with see_costs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and public.service_record_restaurant(public.path_uuid(name)) is not null
    and public.can('see_costs', public.service_record_restaurant(public.path_uuid(name)))
  );
create policy "invoices: write with log_cost" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'invoices'
    and public.service_record_restaurant(public.path_uuid(name)) is not null
    and public.can('log_cost', public.service_record_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'invoices'
    and public.service_record_restaurant(public.path_uuid(name)) is not null
    and public.can('log_cost', public.service_record_restaurant(public.path_uuid(name)))
  );

-- 2. In-house tasks -------------------------------------------------------------------

drop policy inhouse_fixes_insert on public.inhouse_fixes;
create policy inhouse_fixes_insert on public.inhouse_fixes
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id)
    and created_by = auth.uid()
    and done_at is null
    and done_by is null
    and walkthrough_id is null
    and check_id is null
    and origin_label is null
    and converted_ticket_id is null
  );

create or replace function public.inhouse_fixes_from_people()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_service() then
    new.created_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.inhouse_fixes_from_people() from public, anon;

create trigger inhouse_fixes_from_people before insert on public.inhouse_fixes
  for each row execute function public.inhouse_fixes_from_people();

-- 3. A unit keeps its id --------------------------------------------------------------

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
    new.created_by := auth.uid();
    new.retired_at := null;
    new.retired_by := null;
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

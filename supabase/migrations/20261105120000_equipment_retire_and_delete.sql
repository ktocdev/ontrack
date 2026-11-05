-- OT-66: retire, restore and delete a unit, following the archive and delete rule,
-- and the data plate photo.
--
-- Retire is for a unit that is gone or replaced: it leaves the lists and the ticket
-- form's picker (tickets_equipment_here already refuses a retired unit on a new
-- link), keeps its history, and can be restored. Delete is for a mistake or a test
-- entry: only while no ticket or service record points to it.
--
-- The update policy let anyone with edit_equipment set retired_at directly, which
-- skipped the log, so retired_at and retired_by now change only through
-- set_equipment_retired. Both functions run as definer because Ops and managers
-- can't write audit_log, and a delete the API could reach directly would skip it;
-- each checks can('edit_equipment') at the unit's restaurant first, as the in-house
-- functions do. There is still no delete policy on equipment.
--
-- A unit may move to another restaurant only while nothing points to it, since a
-- ticket's unit must be at the ticket's restaurant (tickets_equipment_here), and
-- never to an archived one.

alter table public.equipment
  add column retired_by uuid references public.profiles (id) on delete set null,
  add column plate_photo_path text,
  add constraint equipment_text_lengths check (
    char_length(btrim(name)) between 1 and 120
    and coalesce(char_length(brand), 0) <= 120
    and coalesce(char_length(model), 0) <= 120
    and coalesce(char_length(serial), 0) <= 120
    and coalesce(char_length(location_note), 0) <= 200
    and coalesce(char_length(warranty_note), 0) <= 200
  ),
  add constraint equipment_files_here check (
    (manual_path is null or manual_path like id::text || '/%')
    and (plate_photo_path is null or plate_photo_path like id::text || '/%')
  );

-- Whether anything points to a unit. Runs as definer so a manager without
-- see_costs still learns that a service record exists (never what it cost), which
-- the Delete button needs; null for a unit outside the caller's scope.
create or replace function public.equipment_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when public.has_scope(e.restaurant_id) then
    exists (select 1 from public.tickets t where t.equipment_id = e.id)
    or exists (select 1 from public.service_records s where s.equipment_id = e.id)
  end
  from public.equipment e
  where e.id = p_id;
$$;

revoke all on function public.equipment_in_use(uuid) from public, anon;
grant execute on function public.equipment_in_use(uuid) to authenticated;

-- History per unit, for the Delete button. Runs as the caller, so it lists only
-- units the caller can see.
create view public.v_equipment_history
with (security_invoker = true) as
select e.id as equipment_id, public.equipment_in_use(e.id) as in_use
from public.equipment e;

-- Open tickets per unit; the badge on a row of the equipment list. The category
-- badge comes from v_category_equipment_counts.
create view public.v_equipment_open_counts
with (security_invoker = true) as
select t.equipment_id, count(*)::int as open_ticket_count
from public.tickets t
where t.equipment_id is not null and t.status <> 'closed'
group by t.equipment_id;

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

create trigger equipment_guard before insert or update on public.equipment
  for each row execute function public.equipment_guard();

create or replace function public.set_equipment_retired(p_id uuid, p_retired boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.equipment;
begin
  select * into e from public.equipment where id = p_id for update;
  if e.id is null or not public.can('edit_equipment', e.restaurant_id) then
    raise exception 'you can''t change this unit' using errcode = '42501';
  end if;
  if (e.retired_at is not null) = p_retired then
    return; -- already in that state
  end if;
  if not p_retired and exists (
    select 1 from public.restaurants where id = e.restaurant_id and archived_at is not null
  ) then
    raise exception 'this restaurant is archived' using errcode = '42501';
  end if;

  perform set_config('ontrack.equipment_retire', p_id::text, true);
  update public.equipment
  set retired_at = case when p_retired then now() end,
      retired_by = case when p_retired then auth.uid() end
  where id = p_id;
  perform set_config('ontrack.equipment_retire', '', true);

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when p_retired then 'equipment.retire' else 'equipment.restore' end,
          e.restaurant_id, jsonb_build_object('equipment_id', p_id, 'name', e.name));
end;
$$;

create or replace function public.delete_equipment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.equipment;
begin
  select * into e from public.equipment where id = p_id for update;
  if e.id is null or not public.can('edit_equipment', e.restaurant_id) then
    raise exception 'you can''t delete this unit' using errcode = '42501';
  end if;
  if public.equipment_in_use(p_id) then
    raise exception 'this unit has tickets or service records; retire it instead' using errcode = '23503';
  end if;

  -- Logged first: the entry keeps the name once the row is gone.
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'equipment.delete', e.restaurant_id,
          jsonb_build_object('equipment_id', p_id, 'name', e.name, 'serial', e.serial));

  delete from public.equipment where id = p_id;
end;
$$;

revoke all on function public.set_equipment_retired(uuid, boolean) from public, anon;
grant execute on function public.set_equipment_retired(uuid, boolean) to authenticated;
revoke all on function public.delete_equipment(uuid) from public, anon;
grant execute on function public.delete_equipment(uuid) to authenticated;

-- The data plate photo, under its unit like a manual:
--   equipment-photos/<equipment_id>/<uuid>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipment-photos', 'equipment-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "equipment photos: read in scope" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'equipment-photos'
    and public.has_scope(public.equipment_restaurant(public.path_uuid(name)))
  );
create policy "equipment photos: write with edit_equipment" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'equipment-photos'
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'equipment-photos'
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  );

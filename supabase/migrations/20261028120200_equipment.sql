-- OnTrack schema, part 3 of 8: equipment.
-- categories (with area) and equipment, plus their policies.

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  area        public.area not null,
  sort_order  int  not null default 0,
  unique (name, area)
);

create table public.equipment (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  category_id     uuid not null references public.categories (id),
  name            text not null,
  brand           text,
  model           text,
  serial          text,
  -- "Kitchen, north wall"
  location_note   text,
  installed_on    date,
  -- "Parts through Mar 2027" plus the date the app can compare against
  warranty_note   text,
  warranty_until  date,
  -- Path in the manuals bucket
  manual_path     text,
  retired_at      timestamptz,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index equipment_restaurant_idx on public.equipment (restaurant_id) where retired_at is null;
create index equipment_category_idx on public.equipment (category_id);
create index equipment_serial_idx on public.equipment (lower(serial));

create trigger equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.equipment  enable row level security;

-- Categories are shared reference data; anyone signed in reads them.
-- Changing them is an ops job, gated by the same right as editing equipment.
create policy categories_select on public.categories
  for select to authenticated
  using (public.my_role() is not null);
create policy categories_write on public.categories
  for all to authenticated
  using (public.can('edit_equipment')) with check (public.can('edit_equipment'));

-- Equipment: visible within your scope; added and edited only with
-- edit_equipment at that restaurant (ops by default, managers by override).
-- Nothing is deleted; retire_at hides it.
create policy equipment_select on public.equipment
  for select to authenticated
  using (public.has_scope(restaurant_id));
create policy equipment_insert on public.equipment
  for insert to authenticated
  with check (public.can('edit_equipment', restaurant_id));
create policy equipment_update on public.equipment
  for update to authenticated
  using (public.can('edit_equipment', restaurant_id))
  with check (public.can('edit_equipment', restaurant_id));

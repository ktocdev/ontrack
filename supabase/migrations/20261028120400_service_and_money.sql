-- OnTrack schema, part 5 of 8: service and money.
-- contractors, service_records, service_line_items, invoices, and policies.
-- Costs are visible only with see_costs; logging them needs log_cost.

create table public.contractors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  -- Free text matched to the trade chips: Refrigeration, HVAC, Electrical…
  trade            text not null,
  contact_name     text,
  phone            text,
  email            text,
  preferred        boolean not null default false,
  insurance_until  date,
  notes            text,
  archived_at      timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index contractors_name_idx on public.contractors (lower(name)) where archived_at is null;

create table public.service_records (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.tickets (id) on delete cascade,
  -- Copied from the ticket on insert so a unit's history survives a ticket
  -- being re-pointed; nullable for tickets with no unit.
  equipment_id    uuid references public.equipment (id) on delete set null,
  contractor_id   uuid references public.contractors (id) on delete set null,
  kind            public.service_kind not null,
  technician      text,
  service_date    date not null default current_date,
  -- "Condenser fan motor replaced"
  title           text not null,
  notes           text,
  logged_by       uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (kind = 'contractor' or contractor_id is null)
);
create index service_records_ticket_idx on public.service_records (ticket_id);
create index service_records_equipment_idx on public.service_records (equipment_id, service_date desc);
create index service_records_contractor_idx on public.service_records (contractor_id, service_date desc);

create table public.service_line_items (
  id                 uuid primary key default gen_random_uuid(),
  service_record_id  uuid not null references public.service_records (id) on delete cascade,
  kind               public.line_item_kind not null,
  -- "2 hrs", "fan motor, capacitor"
  description        text,
  amount_cents       int not null check (amount_cents >= 0),
  sort_order         int not null default 0
);
create index service_line_items_record_idx on public.service_line_items (service_record_id);

-- One invoice per service record. A record with no invoice row, or a row with
-- status 'missing', shows under the Missing filter.
create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  service_record_id  uuid not null unique references public.service_records (id) on delete cascade,
  number             text,
  amount_cents       int check (amount_cents >= 0),
  status             public.invoice_status not null default 'missing',
  -- Path in the invoices bucket
  path               text,
  attached_by        uuid references public.profiles (id),
  attached_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (status <> 'attached' or path is not null)
);

create trigger contractors_updated_at before update on public.contractors
  for each row execute function public.set_updated_at();
create trigger service_records_updated_at before update on public.service_records
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- Default equipment_id from the ticket so callers need not repeat it.
create or replace function public.service_records_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.equipment_id is null then
    select equipment_id into new.equipment_id from public.tickets where id = new.ticket_id;
  end if;
  if new.logged_by is null then
    new.logged_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger service_records_defaults before insert on public.service_records
  for each row execute function public.service_records_defaults();

-- ---------------------------------------------------------------------------
-- Helpers for policies on child rows
-- ---------------------------------------------------------------------------

create or replace function public.service_record_restaurant(srid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.restaurant_id
  from public.service_records s
  join public.tickets t on t.id = s.ticket_id
  where s.id = srid;
$$;
revoke all on function public.service_record_restaurant(uuid) from public;
grant execute on function public.service_record_restaurant(uuid) to authenticated, service_role;

create or replace function public.ticket_restaurant(tid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.tickets where id = tid;
$$;
revoke all on function public.ticket_restaurant(uuid) from public;
grant execute on function public.ticket_restaurant(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.contractors        enable row level security;
alter table public.service_records    enable row level security;
alter table public.service_line_items enable row level security;
alter table public.invoices           enable row level security;

-- Contractors: the directory needs see_contractors; a manager granted
-- see_costs also sees names, since the closed ticket shows the contractor.
create policy contractors_select on public.contractors
  for select to authenticated
  using (public.can('see_contractors') or public.can('see_costs'));
create policy contractors_write on public.contractors
  for all to authenticated
  using (public.can('log_cost')) with check (public.can('log_cost'));

-- Service records: read with see_costs at the ticket's restaurant; write with
-- log_cost there.
create policy service_records_select on public.service_records
  for select to authenticated
  using (public.can('see_costs', public.ticket_restaurant(ticket_id)));
create policy service_records_write on public.service_records
  for all to authenticated
  using (public.can('log_cost', public.ticket_restaurant(ticket_id)))
  with check (public.can('log_cost', public.ticket_restaurant(ticket_id)));

create policy service_line_items_select on public.service_line_items
  for select to authenticated
  using (public.can('see_costs', public.service_record_restaurant(service_record_id)));
create policy service_line_items_write on public.service_line_items
  for all to authenticated
  using (public.can('log_cost', public.service_record_restaurant(service_record_id)))
  with check (public.can('log_cost', public.service_record_restaurant(service_record_id)));

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.can('see_costs', public.service_record_restaurant(service_record_id)));
create policy invoices_write on public.invoices
  for all to authenticated
  using (public.can('log_cost', public.service_record_restaurant(service_record_id)))
  with check (public.can('log_cost', public.service_record_restaurant(service_record_id)));

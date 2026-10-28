-- OnTrack schema, part 6 of 8: monthly walkthroughs.
-- Landed now, ahead of Phase 6, so tickets.source and walkthrough_id never
-- need reworking. walkthrough_schedules, walkthrough_templates,
-- walkthrough_items, quarterly_tasks, walkthroughs, walkthrough_checks,
-- inhouse_fixes, and policies.

-- Group-wide schedule (restaurant_id null) or a restaurant's own. months is
-- the set of months a walkthrough is due; the default is every month.
create table public.walkthrough_schedules (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid unique references public.restaurants (id) on delete cascade,
  months          int[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  -- Day of month the walkthrough is due
  due_day         int  not null default 25 check (due_day between 1 and 28),
  -- Days before due to send reminders
  reminder_days   int[] not null default '{7,2}',
  active          boolean not null default true,
  updated_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now()
);

-- A checklist template; one active at a time is enough today.
create table public.walkthrough_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Items are grouped by area, then group ("FOH › Electrical › Light bulbs").
create table public.walkthrough_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.walkthrough_templates (id) on delete cascade,
  area         public.area not null,
  group_name   text not null,
  title        text not null,
  directions   text,
  video_url    text,
  sort_order   int not null default 0,
  active       boolean not null default true
);
create index walkthrough_items_template_idx on public.walkthrough_items (template_id, area, sort_order);

-- Quarterly tasks are group-wide (restaurant_id null). A restaurant can
-- override one (overrides_task_id) or remove it (removed = true).
create table public.quarterly_tasks (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid references public.restaurants (id) on delete cascade,
  overrides_task_id  uuid references public.quarterly_tasks (id) on delete cascade,
  title              text not null,
  directions         text,
  video_url          text,
  months             int[] not null default '{1,4,7,10}',
  removed            boolean not null default false,
  sort_order         int not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (restaurant_id is not null or (overrides_task_id is null and removed = false))
);

-- One walkthrough per restaurant per month.
create table public.walkthroughs (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  template_id   uuid references public.walkthrough_templates (id),
  -- First day of the month it covers
  period        date not null check (period = date_trunc('month', period)::date),
  due_on        date not null,
  status        public.walkthrough_status not null default 'open',
  started_by    uuid references public.profiles (id),
  submitted_by  uuid references public.profiles (id),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, period)
);
create index walkthroughs_period_idx on public.walkthroughs (period desc);

-- A check is one item's result in one walkthrough.
create table public.walkthrough_checks (
  id                 uuid primary key default gen_random_uuid(),
  walkthrough_id     uuid not null references public.walkthroughs (id) on delete cascade,
  item_id            uuid references public.walkthrough_items (id) on delete cascade,
  quarterly_task_id  uuid references public.quarterly_tasks (id) on delete cascade,
  result             public.check_result not null,
  note               text,
  ticket_id          uuid references public.tickets (id) on delete set null,
  checked_by         uuid references public.profiles (id),
  checked_at         timestamptz not null default now(),
  check ((item_id is null) <> (quarterly_task_id is null)),
  unique nulls not distinct (walkthrough_id, item_id, quarterly_task_id)
);

-- Something the restaurant fixes itself. Can be converted to a ticket.
create table public.inhouse_fixes (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurants (id) on delete cascade,
  walkthrough_id       uuid references public.walkthroughs (id) on delete set null,
  check_id             uuid references public.walkthrough_checks (id) on delete set null,
  title                text not null,
  note                 text,
  -- "Oct walkthrough · FOH › Electrical › Light bulbs"
  origin_label         text,
  done_at              timestamptz,
  done_by              uuid references public.profiles (id),
  converted_ticket_id  uuid references public.tickets (id) on delete set null,
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index inhouse_fixes_restaurant_idx on public.inhouse_fixes (restaurant_id) where deleted_at is null;

alter table public.tickets
  add constraint tickets_walkthrough_fk
  foreign key (walkthrough_id) references public.walkthroughs (id) on delete set null;

create trigger walkthrough_templates_updated_at before update on public.walkthrough_templates
  for each row execute function public.set_updated_at();
create trigger quarterly_tasks_updated_at before update on public.quarterly_tasks
  for each row execute function public.set_updated_at();

create or replace function public.walkthrough_restaurant(wid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.walkthroughs where id = wid;
$$;
revoke all on function public.walkthrough_restaurant(uuid) from public;
grant execute on function public.walkthrough_restaurant(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.walkthrough_schedules enable row level security;
alter table public.walkthrough_templates enable row level security;
alter table public.walkthrough_items     enable row level security;
alter table public.quarterly_tasks       enable row level security;
alter table public.walkthroughs          enable row level security;
alter table public.walkthrough_checks    enable row level security;
alter table public.inhouse_fixes         enable row level security;

-- Schedules, templates, items and quarterly tasks: read by anyone signed in,
-- changed with set_walkthrough_schedule (ops and admin by default).
create policy walkthrough_schedules_select on public.walkthrough_schedules
  for select to authenticated using (public.my_role() is not null);
create policy walkthrough_schedules_write on public.walkthrough_schedules
  for all to authenticated
  using (public.can('set_walkthrough_schedule')) with check (public.can('set_walkthrough_schedule'));

create policy walkthrough_templates_select on public.walkthrough_templates
  for select to authenticated using (public.my_role() is not null);
create policy walkthrough_templates_write on public.walkthrough_templates
  for all to authenticated
  using (public.can('set_walkthrough_schedule')) with check (public.can('set_walkthrough_schedule'));

create policy walkthrough_items_select on public.walkthrough_items
  for select to authenticated using (public.my_role() is not null);
create policy walkthrough_items_write on public.walkthrough_items
  for all to authenticated
  using (public.can('set_walkthrough_schedule')) with check (public.can('set_walkthrough_schedule'));

create policy quarterly_tasks_select on public.quarterly_tasks
  for select to authenticated using (public.my_role() is not null);
create policy quarterly_tasks_write on public.quarterly_tasks
  for all to authenticated
  using (public.can('set_walkthrough_schedule')) with check (public.can('set_walkthrough_schedule'));

-- Walkthroughs, checks and fixes: seen within scope; done by the people who
-- can create tickets there (managers, ops). Creation of the monthly row is a
-- scheduled job with the service role.
create policy walkthroughs_select on public.walkthroughs
  for select to authenticated using (public.has_scope(restaurant_id));
create policy walkthroughs_update on public.walkthroughs
  for update to authenticated
  using (public.can('create_tickets', restaurant_id))
  with check (public.can('create_tickets', restaurant_id));

create policy walkthrough_checks_select on public.walkthrough_checks
  for select to authenticated
  using (public.has_scope(public.walkthrough_restaurant(walkthrough_id)));
create policy walkthrough_checks_write on public.walkthrough_checks
  for all to authenticated
  using (public.can('create_tickets', public.walkthrough_restaurant(walkthrough_id)))
  with check (public.can('create_tickets', public.walkthrough_restaurant(walkthrough_id)));

create policy inhouse_fixes_select on public.inhouse_fixes
  for select to authenticated using (public.has_scope(restaurant_id));
create policy inhouse_fixes_write on public.inhouse_fixes
  for all to authenticated
  using (public.can('create_tickets', restaurant_id))
  with check (public.can('create_tickets', restaurant_id));

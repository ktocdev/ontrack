-- OnTrack schema, part 4 of 8: tickets.
-- tickets, ticket_updates (the thread, including system events) and
-- ticket_photos, the triggers that write events and guard what a manager may
-- change, and the policies.

create sequence public.ticket_number_seq start with 1;

create table public.tickets (
  id                uuid primary key default gen_random_uuid(),
  -- Assigned by the tickets_guard trigger on insert, never by the client
  number            int  not null unique,
  -- "OT-1042"; padded so early ids like OT-0988 sort and read the same way
  display_id        text generated always as ('OT-' || lpad(number::text, 4, '0')) stored,
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  equipment_id      uuid references public.equipment (id) on delete set null,
  category_id       uuid not null references public.categories (id),
  title             text not null check (length(title) between 1 and 140),
  description       text,
  urgency           public.ticket_urgency not null default 'normal',
  status            public.ticket_status  not null default 'open',
  assignee_id       uuid references public.profiles (id) on delete set null,
  source            public.ticket_source  not null default 'reported',
  -- Set in part 6 once walkthroughs exist
  walkthrough_id    uuid,
  -- "Create ticket from this" on a closed ticket links the new one back
  parent_ticket_id  uuid references public.tickets (id) on delete set null,
  -- Closing comment shown under Resolution
  resolution        text,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz,
  closed_by         uuid references public.profiles (id),
  -- Kept through a reopen so the Closed tab still lists the month it closed
  last_closed_at    timestamptz,
  reopened_at       timestamptz,
  reopen_count      int not null default 0,
  -- Set when a status change schedules work ("Scheduled Thu")
  scheduled_for     date,
  check ((status = 'closed') = (closed_at is not null))
);
create index tickets_restaurant_status_idx on public.tickets (restaurant_id, status);
create index tickets_equipment_idx on public.tickets (equipment_id);
create index tickets_assignee_idx on public.tickets (assignee_id) where status <> 'closed';
create index tickets_closed_at_idx on public.tickets (closed_at desc) where status = 'closed';

create table public.ticket_updates (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  kind        public.update_kind not null default 'message',
  body        text,
  -- Internal notes are Ops only ("Visible to restaurant" off)
  internal    boolean not null default false,
  -- For system events: {"from": "open", "to": "in_progress"}, {"assignee_id": ...}
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  check (kind <> 'message' or body is not null)
);
create index ticket_updates_ticket_idx on public.ticket_updates (ticket_id, created_at);

create table public.ticket_photos (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  update_id   uuid references public.ticket_updates (id) on delete set null,
  -- Path in the ticket-photos bucket: <ticket_id>/<uuid>.jpg
  path        text not null unique,
  width       int,
  height      int,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index ticket_photos_ticket_idx on public.ticket_photos (ticket_id);

create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: what a non-ops user may change on a ticket, on insert and update.
-- Ops (update_status at the restaurant) may set anything. Anyone else who
-- can see the ticket may: create it as a plain open ticket; edit
-- title/description/urgency/equipment/category while it is not closed; close
-- it with a resolution; reopen it within 30 days of closing. They may not
-- touch the assignee, schedule, or pick other statuses, and the close
-- timestamp and closer are always set by the database, never the client.
-- ---------------------------------------------------------------------------

create or replace function public.tickets_guard()
returns trigger
language plpgsql
as $$
declare
  v_ops boolean := public.can('update_status', new.restaurant_id);
  v_status_change boolean;
begin
  if tg_op = 'INSERT' then
    -- Identity comes from the database, whatever the client sent.
    new.number := nextval('public.ticket_number_seq');
    new.created_at := now();
    new.updated_at := now();
    new.reopen_count := 0;
    new.reopened_at := null;
    new.last_closed_at := null;

    if not v_ops then
      new.status := 'open';
      new.assignee_id := null;
      new.scheduled_for := null;
      new.resolution := null;
    end if;

    if new.status = 'closed' then
      new.closed_at := now();
      new.closed_by := auth.uid();
      new.last_closed_at := new.closed_at;
    else
      new.closed_at := null;
      new.closed_by := null;
    end if;

    return new;
  end if;

  v_status_change := new.status is distinct from old.status;

  if new.restaurant_id is distinct from old.restaurant_id
     or new.number is distinct from old.number
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'ticket identity columns cannot change' using errcode = '42501';
  end if;

  -- Bookkeeping that applies to everyone
  if v_status_change and new.status = 'closed' then
    new.closed_at := now();
    new.closed_by := auth.uid();
    new.last_closed_at := new.closed_at;
  elsif v_status_change and old.status = 'closed' then
    -- leaving closed is a reopen
    new.status := 'reopened';
    new.closed_at := null;
    new.closed_by := null;
    new.reopened_at := now();
    new.reopen_count := old.reopen_count + 1;
    new.resolution := null;
  end if;

  if v_ops then
    return new;
  end if;

  -- Non-ops from here on
  if new.assignee_id is distinct from old.assignee_id then
    raise exception 'only ops can assign tickets' using errcode = '42501';
  end if;
  if new.scheduled_for is distinct from old.scheduled_for then
    raise exception 'only ops can schedule tickets' using errcode = '42501';
  end if;

  if v_status_change then
    if old.status = 'closed' then
      if old.closed_at < now() - interval '30 days' then
        raise exception 'tickets closed more than 30 days ago cannot be reopened; create a new ticket'
          using errcode = '42501';
      end if;
    elsif new.status = 'closed' then
      null; -- a manager may close their own restaurant's ticket
    else
      raise exception 'only ops can change ticket status' using errcode = '42501';
    end if;
  elsif old.status = 'closed' then
    raise exception 'closed tickets are read-only' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tickets_guard before insert or update on public.tickets
  for each row execute function public.tickets_guard();

-- ---------------------------------------------------------------------------
-- System events in the thread. Security definer so the row is written even
-- though people may only insert 'message' rows themselves.
-- ---------------------------------------------------------------------------

create or replace function public.tickets_log_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_updates (ticket_id, author_id, kind, meta)
    values (new.id, new.created_by, 'created', jsonb_build_object('source', new.source));
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_updates (ticket_id, author_id, kind, meta)
    values (new.id, auth.uid(), 'assigned',
      jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;

  if new.status is distinct from old.status then
    insert into public.ticket_updates (ticket_id, author_id, kind, body, meta)
    values (
      new.id,
      auth.uid(),
      (case
        when new.status = 'closed' then 'closed'
        when new.status = 'reopened' then 'reopened'
        else 'status_changed'
      end)::public.update_kind,
      case when new.status = 'closed' then new.resolution end,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  return new;
end;
$$;

create trigger tickets_log_events after insert or update on public.tickets
  for each row execute function public.tickets_log_events();

-- ---------------------------------------------------------------------------
-- Visibility helper used by the thread and photo policies
-- ---------------------------------------------------------------------------

create or replace function public.can_see_ticket(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = tid
      and (public.has_scope(t.restaurant_id) or public.can('see_all_tickets'))
  );
$$;
revoke all on function public.can_see_ticket(uuid) from public;
grant execute on function public.can_see_ticket(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.tickets        enable row level security;
alter table public.ticket_updates enable row level security;
alter table public.ticket_photos  enable row level security;

-- See: your scope, or everything with see_all_tickets.
create policy tickets_select on public.tickets
  for select to authenticated
  using (public.has_scope(restaurant_id) or public.can('see_all_tickets'));

-- Create: create_tickets at that restaurant, as yourself.
create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id)
    and created_by = auth.uid()
  );

-- Update: ops anywhere in scope, or the restaurant's own people (the guard
-- trigger narrows what they may change).
create policy tickets_update on public.tickets
  for update to authenticated
  using (
    public.can('update_status', restaurant_id)
    or (public.has_scope(restaurant_id) and public.can('create_tickets', restaurant_id))
  )
  with check (
    public.can('update_status', restaurant_id)
    or (public.has_scope(restaurant_id) and public.can('create_tickets', restaurant_id))
  );

-- Thread: visible with the ticket; internal notes only to ops or their author.
create policy ticket_updates_select on public.ticket_updates
  for select to authenticated
  using (
    public.can_see_ticket(ticket_id)
    and (not internal or author_id = auth.uid() or public.my_role() = 'ops')
  );

-- People write messages only; events come from triggers. Internal needs ops.
create policy ticket_updates_insert on public.ticket_updates
  for insert to authenticated
  with check (
    kind = 'message'
    and author_id = auth.uid()
    and public.can_see_ticket(ticket_id)
    and (not internal or public.my_role() = 'ops')
  );

-- Photos follow the ticket, and the internal flag of the update they sit on.
create policy ticket_photos_select on public.ticket_photos
  for select to authenticated
  using (
    public.can_see_ticket(ticket_id)
    and (
      update_id is null
      or exists (
        select 1 from public.ticket_updates u
        where u.id = update_id
          and (not u.internal or u.author_id = auth.uid() or public.my_role() = 'ops')
      )
    )
  );
create policy ticket_photos_insert on public.ticket_photos
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_ticket(ticket_id));

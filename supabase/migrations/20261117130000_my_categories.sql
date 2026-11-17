-- My categories, the backend (OT-116). Each person chooses, per area and per category,
-- whether the shared pool notifies them (all, urgent only, off) and whether the category
-- shows on their lists. Everyone starts with everything, so only what differs is stored.
--
-- 1. area_prefs and category_prefs: a person's own rows, read and written by them through
--    the API (admins read anyone's, for View as). A category's setting wins over its
--    area's one setting at a time: a null on the category follows the area, so changing a
--    category's Notify leaves it hidden with a hidden area. A category added later has no
--    row and follows its area. Deleting a category takes its rows.
-- 2. notification_recipients filters the pool by them: new and reopened tickets, and Ops'
--    emails about another Ops person picking up or closing a ticket. Never a ticket you
--    filed or are on, whose news always reaches you, and never a walkthrough reminder,
--    which keeps its own switch. The kind switches on Profile still apply on top.

-- ---------------------------------------------------------------------------
-- 1. The settings
-- ---------------------------------------------------------------------------

create type public.notify_level as enum ('all', 'urgent', 'off');

create table public.area_prefs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  area       public.area not null,
  notify     public.notify_level not null default 'all',
  shown      boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, area),
  -- A row at the defaults says nothing; the app deletes it instead.
  constraint area_prefs_not_default check (notify <> 'all' or not shown)
);

create table public.category_prefs (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  notify      public.notify_level,
  shown       boolean,
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id),
  -- Null follows the area; a row with both null says nothing.
  constraint category_prefs_says_something check (notify is not null or shown is not null)
);
create index category_prefs_category_idx on public.category_prefs (category_id);

alter table public.area_prefs enable row level security;
alter table public.category_prefs enable row level security;

create policy area_prefs_read on public.area_prefs
  for select to authenticated
  using ((user_id = auth.uid() and public.my_role() is not null) or public.is_admin());
create policy area_prefs_insert on public.area_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy area_prefs_update on public.area_prefs
  for update to authenticated
  using (user_id = auth.uid() and public.my_role() is not null)
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy area_prefs_delete on public.area_prefs
  for delete to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);

create policy category_prefs_read on public.category_prefs
  for select to authenticated
  using ((user_id = auth.uid() and public.my_role() is not null) or public.is_admin());
create policy category_prefs_insert on public.category_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy category_prefs_update on public.category_prefs
  for update to authenticated
  using (user_id = auth.uid() and public.my_role() is not null)
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy category_prefs_delete on public.category_prefs
  for delete to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);

revoke all on public.area_prefs, public.category_prefs from anon;
grant select, insert, update, delete on public.area_prefs, public.category_prefs to authenticated;

-- updated_at follows each write, whatever the client sent.
create function public.prefs_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.prefs_touch() from public, anon, authenticated;

create trigger area_prefs_touch before insert or update on public.area_prefs
  for each row execute function public.prefs_touch();
create trigger category_prefs_touch before insert or update on public.category_prefs
  for each row execute function public.prefs_touch();

-- ---------------------------------------------------------------------------
-- 2. Who gets what
-- ---------------------------------------------------------------------------

-- As before (20261113130000), plus: the pool (a new or reopened ticket for Ops, and Ops'
-- email about another Ops person picking up or closing one) reaches someone only if their
-- setting for the ticket's category, else its area, is All, or Urgent only on an urgent
-- ticket. Whoever filed the ticket or is on it is told whatever their setting. "Mine" is
-- worked out once as true or false, since assignee_id is often null.
create or replace function public.notification_recipients(p_notification uuid)
returns table (user_id uuid, email text, full_name text, push boolean, send_email boolean)
language sql
stable
security definer
set search_path = public
as $$
  with n as (
    select x.*, coalesce(t.restaurant_id, w.restaurant_id) as restaurant_id, t.created_by, t.assignee_id,
      t.category_id, t.urgency, c.area, a.role as actor_role, w.status as walkthrough_status
    from public.notifications x
    left join public.tickets t on t.id = x.ticket_id
    left join public.categories c on c.id = t.category_id
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
revoke all on function public.notification_recipients(uuid) from public, anon, authenticated;
grant execute on function public.notification_recipients(uuid) to service_role;

-- OT-102: the manager's walkthrough, in the database (Phase 6a).
--
-- 1. The checklist is in sections (Back of House, Front of House, and later Kitchen or
--    Exterior), not the Front / Back area, so 6b's rotation needs no rework. A section may
--    name an area, which a walkthrough's in-house fix takes. An item may name a category,
--    which a ticket made from it takes.
-- 2. A default checklist, the boards' seven groups for each of Back and Front of House, so
--    a project with no seed has one. The group's real list replaces it (6b's import).
-- 3. A schedule may name its checklist, and a due day of null means the last day of the
--    month (decided Nov 12, 2026). One group schedule at most.
-- 4. Walkthroughs, checks and the checklist change only through functions. A check is made
--    by marking an item Good, or by adding an in-house fix or a ticket to it; an item can
--    have several of each, and Good is refused while one is still open. A walkthrough's
--    fix and ticket are made only here, so the Walkthrough tag can't be claimed. A
--    submitted walkthrough takes no more checks. Anyone with create_tickets at the
--    restaurant may do this; Ops' screens are read-only, as the boards draw.
-- 5. Quarterly tasks show in each month of their quarter until done, once per quarter.
-- 6. open_walkthroughs() opens the month's walkthrough for every restaurant from its
--    schedule; pg_cron runs it every morning, so a missed day or a mid-month deploy still
--    opens the month. Safe to run twice.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- The group's day
-- ---------------------------------------------------------------------------

alter table public.group_settings
  add column time_zone text not null default 'America/Chicago'
  check (char_length(time_zone) between 1 and 64);

-- Today where the group is, since a month starts at its midnight, not UTC's.
create or replace function public.group_today()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce((select time_zone from public.group_settings), 'UTC'))::date;
$$;
revoke all on function public.group_today() from public, anon;
grant execute on function public.group_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Sections
-- ---------------------------------------------------------------------------

create table public.walkthrough_sections (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.walkthrough_templates (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  short_name   text check (short_name is null or char_length(btrim(short_name)) between 1 and 12),
  area         public.area,
  sort_order   int not null default 0,
  active       boolean not null default true,
  unique (template_id, name)
);
create index walkthrough_sections_template_idx on public.walkthrough_sections (template_id, sort_order);

alter table public.walkthrough_sections enable row level security;
create policy walkthrough_sections_select on public.walkthrough_sections
  for select to authenticated using (public.my_role() is not null);

alter table public.walkthrough_items
  add column section_id uuid references public.walkthrough_sections (id) on delete cascade,
  add column category_id uuid references public.categories (id);

-- Any items from before become Back and Front of House sections of their checklist.
insert into public.walkthrough_sections (template_id, name, short_name, area, sort_order)
select distinct i.template_id,
       case i.area when 'boh' then 'Back of House' else 'Front of House' end,
       case i.area when 'boh' then 'BOH' else 'FOH' end,
       i.area,
       case i.area when 'boh' then 1 else 2 end
from public.walkthrough_items i;
update public.walkthrough_items i set section_id = s.id
from public.walkthrough_sections s
where s.template_id = i.template_id and s.area = i.area;

drop policy walkthrough_items_select on public.walkthrough_items;
drop policy walkthrough_items_write on public.walkthrough_items;
alter table public.walkthrough_items
  alter column section_id set not null,
  drop column area,
  drop column template_id;
alter table public.walkthrough_items
  add constraint walkthrough_items_title_length check (char_length(btrim(title)) between 1 and 140),
  add constraint walkthrough_items_group_length check (char_length(btrim(group_name)) between 1 and 60);
create index walkthrough_items_section_idx on public.walkthrough_items (section_id, sort_order);
create policy walkthrough_items_select on public.walkthrough_items
  for select to authenticated using (public.my_role() is not null);

-- Nothing writes the checklist, the schedules or the quarterly tasks through the API;
-- 6b gives Ops functions that check the caller and log.
drop policy walkthrough_schedules_write on public.walkthrough_schedules;
drop policy walkthrough_templates_write on public.walkthrough_templates;
drop policy quarterly_tasks_write on public.quarterly_tasks;

-- ---------------------------------------------------------------------------
-- 2. The default checklist (the boards' sample; fixed ids, like the categories)
-- ---------------------------------------------------------------------------

insert into public.walkthrough_templates (id, name)
values ('88888888-8888-4888-8888-000000000001', 'Monthly walkthrough')
on conflict do nothing;

insert into public.walkthrough_sections (id, template_id, name, short_name, area, sort_order) values
  ('cccccccc-cccc-4ccc-8ccc-000000000001', '88888888-8888-4888-8888-000000000001', 'Back of House', 'BOH', 'boh', 1),
  ('cccccccc-cccc-4ccc-8ccc-000000000002', '88888888-8888-4888-8888-000000000001', 'Front of House', 'FOH', 'foh', 2)
on conflict do nothing;

-- The same 24 items in each section; ids …0001NN for Back of House, …0002NN for Front.
-- A category where one plainly fits, so a ticket from the item needs no picking.
with items (n, group_name, title, boh_category, foh_category) as (values
  (1,  'Electrical',        'Appliances (plugs, etc.)',       '33333333-3333-4333-8333-000000000014', '33333333-3333-4333-8333-000000000003'),
  (2,  'Electrical',        'Light bulbs',                    '33333333-3333-4333-8333-000000000015', '33333333-3333-4333-8333-000000000001'),
  (3,  'Electrical',        'Emergency lights and signs',     '33333333-3333-4333-8333-000000000015', '33333333-3333-4333-8333-000000000001'),
  (4,  'Electrical',        'Outlets',                        '33333333-3333-4333-8333-000000000014', '33333333-3333-4333-8333-000000000003'),
  (5,  'Electrical',        'Feature',                        '33333333-3333-4333-8333-000000000014', '33333333-3333-4333-8333-000000000003'),
  (6,  'Plumbing',          'Drains and supplies',            '33333333-3333-4333-8333-000000000013', '33333333-3333-4333-8333-000000000002'),
  (7,  'Plumbing',          'Fixtures',                       '33333333-3333-4333-8333-000000000013', '33333333-3333-4333-8333-000000000002'),
  (8,  'Plumbing',          'Feature',                        '33333333-3333-4333-8333-000000000013', '33333333-3333-4333-8333-000000000002'),
  (9,  'Envelope',          'Windows and doors',              null, null),
  (10, 'Envelope',          'Walls',                          null, null),
  (11, 'Envelope',          'Floors',                         null, null),
  (12, 'Envelope',          'Feature',                        null, null),
  (13, 'Aesthetics',        'Signage',                        null, '33333333-3333-4333-8333-000000000004'),
  (14, 'Aesthetics',        'Paint',                          null, null),
  (15, 'Aesthetics',        'Surfaces and seating',           null, '33333333-3333-4333-8333-000000000005'),
  (16, 'Aesthetics',        'Feature',                        null, '33333333-3333-4333-8333-000000000004'),
  (17, 'HVAC',              'Maintaining temp',               null, '33333333-3333-4333-8333-000000000006'),
  (18, 'HVAC',              'Ventilation clean',              '33333333-3333-4333-8333-000000000017', '33333333-3333-4333-8333-000000000006'),
  (19, 'HVAC',              'Battery check sensor/control',   null, '33333333-3333-4333-8333-000000000006'),
  (20, 'Health and safety', 'Review inspection notes',        null, null),
  (21, 'Health and safety', 'Caulking',                       null, null),
  (22, 'Health and safety', 'Perimeter',                      null, null),
  (23, 'Inventory control', 'Furniture build-to',             null, '33333333-3333-4333-8333-000000000005'),
  (24, 'Inventory control', 'Storage areas',                  '33333333-3333-4333-8333-000000000018', null)
)
insert into public.walkthrough_items (id, section_id, group_name, title, sort_order, category_id)
select format('dddddddd-dddd-4ddd-8ddd-%s', lpad((s.k * 100 + i.n)::text, 12, '0'))::uuid,
       s.id, i.group_name, i.title, i.n,
       -- Only a category that is still there; one deleted leaves the item without.
       (select c.id from public.categories c
        where c.id = (case s.k when 1 then i.boh_category else i.foh_category end)::uuid)
from items i
cross join (values (1, 'cccccccc-cccc-4ccc-8ccc-000000000001'::uuid),
                   (2, 'cccccccc-cccc-4ccc-8ccc-000000000002'::uuid)) as s (k, id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Schedules
-- ---------------------------------------------------------------------------

alter table public.walkthrough_schedules
  alter column due_day drop not null,
  alter column due_day drop default,
  add column template_id uuid references public.walkthrough_templates (id);
update public.walkthrough_schedules set due_day = null where due_day = 25;
create unique index walkthrough_schedules_one_group on public.walkthrough_schedules ((true))
  where restaurant_id is null;
insert into public.walkthrough_schedules (restaurant_id, template_id)
select null, '88888888-8888-4888-8888-000000000001'
where not exists (select 1 from public.walkthrough_schedules where restaurant_id is null);
update public.walkthrough_schedules set template_id = '88888888-8888-4888-8888-000000000001'
where restaurant_id is null and template_id is null;

-- The due date for a month: the schedule's day, or the month's last day.
create or replace function public.walkthrough_due_on(p_period date, p_due_day int)
returns date
language sql
immutable
set search_path = public
as $$
  select case
    when p_due_day is null then (date_trunc('month', p_period) + interval '1 month' - interval '1 day')::date
    else (date_trunc('month', p_period) + make_interval(days => p_due_day - 1))::date
  end;
$$;
revoke all on function public.walkthrough_due_on(date, int) from public, anon;
grant execute on function public.walkthrough_due_on(date, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Walkthroughs, checks, and what links to them
-- ---------------------------------------------------------------------------

alter table public.walkthroughs
  add column submitted_note text check (submitted_note is null or char_length(submitted_note) between 1 and 1000);

-- Nobody changes a walkthrough or a check through the API.
drop policy walkthroughs_update on public.walkthroughs;
drop policy walkthrough_checks_write on public.walkthrough_checks;

alter table public.tickets
  add column walkthrough_check_id uuid references public.walkthrough_checks (id) on delete set null;
create index tickets_walkthrough_check_idx on public.tickets (walkthrough_check_id) where walkthrough_check_id is not null;
create index inhouse_fixes_check_idx on public.inhouse_fixes (check_id) where check_id is not null;

-- A ticket says it came from a walkthrough only when create_walkthrough_ticket made it
-- (or, in 6b, Convert to ticket), and its check is one of its walkthrough's.
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
                             or new.walkthrough_check_id is not null) then
      raise exception 'a walkthrough ticket is made from the walkthrough' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.walkthrough_check_id is distinct from old.walkthrough_check_id then
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
revoke all on function public.tickets_walkthrough_origin() from public, anon;

create trigger tickets_walkthrough_origin
  before insert or update of source, walkthrough_id, walkthrough_check_id on public.tickets
  for each row execute function public.tickets_walkthrough_origin();

-- ---------------------------------------------------------------------------
-- 5. Quarterly tasks for a walkthrough
-- ---------------------------------------------------------------------------

-- The group's tasks for the walkthrough's quarter, with this restaurant's own version
-- in place of one it changed, without one it removed, and with its own additions. A task
-- done in any walkthrough of the quarter is done for the quarter; check_id and
-- check_walkthrough_id say where (this walkthrough's own check first).
create or replace function public.walkthrough_quarter_tasks(p_walkthrough_id uuid)
returns table (
  task_id uuid,
  title text,
  directions text,
  video_url text,
  sort_order int,
  check_id uuid,
  check_walkthrough_id uuid,
  done boolean,
  tickets int,
  fixes int
)
language sql
stable
set search_path = public
as $$
  with w as (
    select id, restaurant_id, period, extract(quarter from period)::int as q
    from public.walkthroughs where id = p_walkthrough_id
  ),
  tasks as (
    select coalesce(o.id, g.id) as id, coalesce(o.title, g.title) as title,
           coalesce(o.directions, g.directions) as directions, coalesce(o.video_url, g.video_url) as video_url,
           coalesce(o.months, g.months) as months, coalesce(o.sort_order, g.sort_order) as sort_order
    from w
    join public.quarterly_tasks g on g.restaurant_id is null and g.active
    left join public.quarterly_tasks o
      on o.overrides_task_id = g.id and o.restaurant_id = w.restaurant_id and not o.removed and o.active
    where not exists (
      select 1 from public.quarterly_tasks x
      where x.overrides_task_id = g.id and x.restaurant_id = w.restaurant_id and x.removed
    )
    union all
    select t.id, t.title, t.directions, t.video_url, t.months, t.sort_order
    from w join public.quarterly_tasks t
      on t.restaurant_id = w.restaurant_id and t.overrides_task_id is null and not t.removed and t.active
  ),
  checks as (
    select c.id, c.walkthrough_id, c.quarterly_task_id, c.result,
           (select count(*)::int from public.tickets k where k.walkthrough_check_id = c.id) as tickets,
           (select count(*)::int from public.inhouse_fixes f where f.check_id = c.id) as fixes
    from w
    join public.walkthroughs other
      on other.restaurant_id = w.restaurant_id
     and date_trunc('quarter', other.period) = date_trunc('quarter', w.period)
    join public.walkthrough_checks c on c.walkthrough_id = other.id and c.quarterly_task_id is not null
  )
  select t.id, t.title, t.directions, t.video_url, t.sort_order,
         c.id, c.walkthrough_id,
         coalesce(c.result = 'good' or c.tickets > 0 or c.fixes > 0, false),
         coalesce(c.tickets, 0), coalesce(c.fixes, 0)
  from w
  join tasks t on exists (select 1 from unnest(t.months) m where (m - 1) / 3 + 1 = w.q)
  left join lateral (
    select * from checks c where c.quarterly_task_id = t.id
    order by (c.walkthrough_id = w.id) desc, (c.result = 'good' or c.tickets > 0 or c.fixes > 0) desc
    limit 1
  ) c on true
  order by t.sort_order, t.title;
$$;
revoke all on function public.walkthrough_quarter_tasks(uuid) from public, anon;
grant execute on function public.walkthrough_quarter_tasks(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Progress per section
-- ---------------------------------------------------------------------------

-- One row per section of each walkthrough's checklist, and one for the quarter's tasks
-- (kind 'quarterly', with no section). An item is done when it is Good or has a fix or a
-- ticket. A turned-off item still counts in a walkthrough that already checked it.
create or replace view public.v_walkthrough_progress
with (security_invoker = true) as
with items as (
  select w.id as walkthrough_id, s.id as section_id, s.name, s.short_name, s.area, s.sort_order,
         c.result,
         (select count(*)::int from public.tickets k where k.walkthrough_check_id = c.id) as tickets,
         (select count(*)::int from public.inhouse_fixes f where f.check_id = c.id) as fixes
  from public.walkthroughs w
  join public.walkthrough_sections s on s.template_id = w.template_id
  join public.walkthrough_items i on i.section_id = s.id
  left join public.walkthrough_checks c on c.walkthrough_id = w.id and c.item_id = i.id
  where (s.active and i.active) or c.id is not null
)
select walkthrough_id, 'section'::text as kind, section_id, name, short_name, area, sort_order,
       count(*)::int as total,
       (count(*) filter (where result = 'good' or tickets > 0 or fixes > 0))::int as done,
       sum(tickets)::int as tickets,
       sum(fixes)::int as fixes
from items
group by walkthrough_id, section_id, name, short_name, area, sort_order
union all
select w.id, 'quarterly', null, null, null, null, 1000,
       count(*)::int, (count(*) filter (where q.done))::int, sum(q.tickets)::int, sum(q.fixes)::int
from public.walkthroughs w
cross join lateral public.walkthrough_quarter_tasks(w.id) q
group by w.id;

-- ---------------------------------------------------------------------------
-- 7. Working a walkthrough
-- ---------------------------------------------------------------------------

-- The walkthrough, locked, if the caller may work it now; started_by on first use.
create or replace function public.walkthrough_for_change(p_walkthrough_id uuid)
returns public.walkthroughs
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs;
begin
  select * into w from public.walkthroughs where id = p_walkthrough_id for update;
  if not found or not public.can('create_tickets', w.restaurant_id) then
    raise exception 'walkthrough not found' using errcode = '42501';
  end if;
  if w.status <> 'open' then
    raise exception 'this walkthrough was submitted' using errcode = '42501';
  end if;
  if exists (select 1 from public.restaurants where id = w.restaurant_id and archived_at is not null) then
    raise exception 'this restaurant is archived' using errcode = '42501';
  end if;
  if w.started_by is null then
    update public.walkthroughs set started_by = auth.uid() where id = w.id returning * into w;
  end if;
  return w;
end;
$$;
revoke all on function public.walkthrough_for_change(uuid) from public, anon, authenticated;

-- What an item or a quarterly task of this walkthrough is: its label for an in-house fix
-- ("Oct walkthrough · BOH › Electrical › Outlets"), its area and its category. Refuses
-- anything that isn't on this walkthrough, and a quarterly task done in an earlier
-- walkthrough of the quarter.
create or replace function public.walkthrough_target(
  w public.walkthroughs, p_item_id uuid, p_task_id uuid,
  out label text, out area public.area, out category_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(w.period, 'Mon') || ' walkthrough · ';
  t record;
begin
  if (p_item_id is null) = (p_task_id is null) then
    raise exception 'name one item or one quarterly task' using errcode = '22023';
  end if;
  if p_item_id is not null then
    select s.short_name, s.name as section, s.area, i.group_name, i.title, i.category_id into t
    from public.walkthrough_items i
    join public.walkthrough_sections s on s.id = i.section_id
    where i.id = p_item_id and s.template_id = w.template_id
      and ((i.active and s.active) or exists (
        select 1 from public.walkthrough_checks c where c.walkthrough_id = w.id and c.item_id = i.id));
    if not found then
      raise exception 'that item is not on this walkthrough' using errcode = '22023';
    end if;
    label := v_month || coalesce(t.short_name, t.section) || ' › ' || t.group_name || ' › ' || t.title;
    area := t.area;
    category_id := t.category_id;
  else
    select q.title, q.check_walkthrough_id, q.done into t
    from public.walkthrough_quarter_tasks(w.id) q where q.task_id = p_task_id;
    if not found then
      raise exception 'that task is not on this walkthrough' using errcode = '22023';
    end if;
    if t.done and t.check_walkthrough_id <> w.id then
      raise exception 'this task was done in an earlier walkthrough this quarter' using errcode = '23514';
    end if;
    label := v_month || 'Q' || extract(quarter from w.period) || ' · ' || t.title;
    area := null;
    category_id := null;
  end if;
end;
$$;
revoke all on function public.walkthrough_target(public.walkthroughs, uuid, uuid) from public, anon, authenticated;

-- The check for an item or task, made if missing. A new flag takes Good off it.
create or replace function public.walkthrough_check_for(
  w public.walkthroughs, p_item_id uuid, p_task_id uuid, p_result public.check_result
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.walkthrough_checks
  where walkthrough_id = w.id and item_id is not distinct from p_item_id
    and quarterly_task_id is not distinct from p_task_id
  for update;
  if v_id is null then
    insert into public.walkthrough_checks (walkthrough_id, item_id, quarterly_task_id, result, checked_by)
    values (w.id, p_item_id, p_task_id, p_result, auth.uid())
    returning id into v_id;
  else
    update public.walkthrough_checks
    set result = p_result, checked_by = auth.uid(), checked_at = now()
    where id = v_id and (result = 'good' or p_result = 'good');
  end if;
  return v_id;
end;
$$;
revoke all on function public.walkthrough_check_for(public.walkthroughs, uuid, uuid, public.check_result)
  from public, anon, authenticated;

-- Mark an item or task Good, or take Good off it. Good waits until its in-house fixes are
-- checked off and its tickets closed, or deleted.
create or replace function public.set_walkthrough_good(
  p_walkthrough_id uuid, p_item_id uuid default null, p_task_id uuid default null, p_good boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  c public.walkthrough_checks;
  v_tickets int;
  v_fixes int;
begin
  perform public.walkthrough_target(w, p_item_id, p_task_id);
  select * into c from public.walkthrough_checks
  where walkthrough_id = w.id and item_id is not distinct from p_item_id
    and quarterly_task_id is not distinct from p_task_id
  for update;

  if p_good then
    if c.id is not null and (
      exists (select 1 from public.inhouse_fixes f where f.check_id = c.id and f.done_at is null)
      or exists (select 1 from public.tickets k where k.walkthrough_check_id = c.id and k.status <> 'closed')
    ) then
      raise exception 'finish or delete its in-house fixes and tickets first' using errcode = '23514';
    end if;
    perform public.walkthrough_check_for(w, p_item_id, p_task_id, 'good');
    return;
  end if;

  if c.id is null or c.result <> 'good' then
    return;
  end if;
  select count(*) into v_tickets from public.tickets where walkthrough_check_id = c.id;
  select count(*) into v_fixes from public.inhouse_fixes where check_id = c.id;
  if v_tickets + v_fixes = 0 then
    delete from public.walkthrough_checks where id = c.id;
  else
    update public.walkthrough_checks
    set result = case when v_tickets > 0 then 'ticket'::public.check_result else 'in_house' end,
        checked_by = auth.uid(), checked_at = now()
    where id = c.id;
  end if;
end;
$$;
revoke all on function public.set_walkthrough_good(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.set_walkthrough_good(uuid, uuid, uuid, boolean) to authenticated;

-- An in-house fix on an item or task; the restaurant's team does it, and nobody is told.
create or replace function public.add_walkthrough_fix(
  p_walkthrough_id uuid, p_title text, p_item_id uuid default null, p_task_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  v_target record;
  v_check uuid;
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) not between 1 and 140 then
    raise exception 'say what to fix, in 140 characters or fewer' using errcode = '22023';
  end if;
  select * into v_target from public.walkthrough_target(w, p_item_id, p_task_id);
  v_check := public.walkthrough_check_for(w, p_item_id, p_task_id, 'in_house');
  insert into public.inhouse_fixes (restaurant_id, walkthrough_id, check_id, title, origin_label, area, created_by)
  values (w.restaurant_id, w.id, v_check, v_title, v_target.label, v_target.area, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_walkthrough_fix(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.add_walkthrough_fix(uuid, text, uuid, uuid) to authenticated;

-- A ticket from an item or task: the Walkthrough tag, linked to the walkthrough and the
-- check, and Ops is told as for any new ticket. Its category is the item's, or the one
-- the sheet sends; photos follow as on Create ticket.
create or replace function public.create_walkthrough_ticket(
  p_walkthrough_id uuid,
  p_title text,
  p_item_id uuid default null,
  p_task_id uuid default null,
  p_description text default null,
  p_urgency public.ticket_urgency default 'normal',
  p_equipment_id uuid default null,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  v_target record;
  v_check uuid;
  v_category uuid;
  v_id uuid;
begin
  select * into v_target from public.walkthrough_target(w, p_item_id, p_task_id);
  v_category := coalesce(p_category_id, v_target.category_id);
  if v_category is null then
    raise exception 'pick a category for this ticket' using errcode = '22023';
  end if;
  v_check := public.walkthrough_check_for(w, p_item_id, p_task_id, 'ticket');

  perform set_config('ontrack.walkthrough_ticket', '1', true);
  insert into public.tickets (restaurant_id, category_id, equipment_id, title, description, urgency,
                              source, walkthrough_id, walkthrough_check_id, created_by)
  values (w.restaurant_id, v_category, p_equipment_id, btrim(coalesce(p_title, '')),
          nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_urgency, 'normal'),
          'walkthrough', w.id, v_check, auth.uid())
  returning id into v_id;
  perform set_config('ontrack.walkthrough_ticket', '', true);
  return v_id;
end;
$$;
revoke all on function public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid)
  from public, anon;
grant execute on function public.create_walkthrough_ticket(uuid, text, uuid, uuid, text, public.ticket_urgency, uuid, uuid)
  to authenticated;

-- Submit, finished or not, with an optional note for Ops.
create or replace function public.submit_walkthrough(p_walkthrough_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.walkthroughs := public.walkthrough_for_change(p_walkthrough_id);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if char_length(v_note) > 1000 then
    raise exception 'keep the note to 1000 characters' using errcode = '22023';
  end if;
  update public.walkthroughs
  set status = 'submitted', submitted_by = auth.uid(), submitted_at = now(), submitted_note = v_note
  where id = w.id;
end;
$$;
revoke all on function public.submit_walkthrough(uuid, text) from public, anon;
grant execute on function public.submit_walkthrough(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Opening the month
-- ---------------------------------------------------------------------------

-- Opens a month's walkthrough for each restaurant in use, from its own schedule or the
-- group's: none in a month the schedule leaves out, due on its day or the month's last.
-- Returns how many it opened; one that exists is left alone. The service role and the
-- scheduled job only.
create or replace function public.open_walkthroughs(p_period date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', coalesce(p_period, public.group_today()))::date;
  v_group public.walkthrough_schedules;
  v_count int;
begin
  if not public.is_service() then
    raise exception 'only the scheduled job opens walkthroughs' using errcode = '42501';
  end if;
  select * into v_group from public.walkthrough_schedules where restaurant_id is null;

  with plan as (
    select r.id as restaurant_id,
           coalesce(own.active, v_group.active, true) as active,
           coalesce(own.months, v_group.months, '{1,2,3,4,5,6,7,8,9,10,11,12}') as months,
           case when own.id is not null then own.due_day else v_group.due_day end as due_day,
           coalesce(own.template_id, v_group.template_id,
                    (select t.id from public.walkthrough_templates t where t.active
                     order by t.created_at desc limit 1)) as template_id
    from public.restaurants r
    left join public.walkthrough_schedules own on own.restaurant_id = r.id
    where r.archived_at is null
  ),
  opened as (
    insert into public.walkthroughs (restaurant_id, template_id, period, due_on)
    select restaurant_id, template_id, v_period, public.walkthrough_due_on(v_period, due_day)
    from plan
    where active and template_id is not null and extract(month from v_period)::int = any (months)
    on conflict (restaurant_id, period) do nothing
    returning 1
  )
  select count(*)::int into v_count from opened;
  return v_count;
end;
$$;
revoke all on function public.open_walkthroughs(date) from public, anon, authenticated;
grant execute on function public.open_walkthroughs(date) to service_role;

-- Every morning at 11:00 UTC (early morning in the US); opening is safe to repeat.
select cron.schedule('open-walkthroughs', '0 11 * * *', 'select public.open_walkthroughs()');

-- And this month now, so a deploy mid-month doesn't wait for tomorrow.
select public.open_walkthroughs();

-- OT-169: leadership files tickets (from feedback, Nov 23, 2026).
--
-- 1. Create tickets is on for the leadership role by default, so leadership files a ticket
--    at any restaurant (their scope is all of them) and, since writing in a thread follows
--    that right, posts in any open ticket's thread (decided Nov 23, 2026). Internal notes
--    stay Ops' only, to read and to write, as before.
-- 2. Leadership changes only the tickets they filed (decided Nov 23, 2026): edit, close and
--    reopen. A Reporter may change any ticket at their own restaurant; leadership's scope is
--    the whole group, so the update policy holds them to their own. The thread's touch of
--    updated_at is security definer and passes, so posting on anyone's ticket still works.
-- 3. The right also opens a restaurant's walkthrough and its In-house list, which are the
--    Reporters' work; leadership's screens offer neither, and the database now refuses them
--    to leadership too, so the right means filing and posting for them and nothing more.
-- 4. Whoever filed a ticket hears what happens to it, whatever their role:
--    notification_recipients read only Ops and Reporters, so leadership heard nothing.
--
-- A deployment whose admin turned Create tickets off for leadership on purpose before this
-- can turn it off again on Roles & rights; the default row is the only one changed.

-- ---------------------------------------------------------------------------
-- 1. The default
-- ---------------------------------------------------------------------------

update public.rights set allowed = true
where role = 'leadership' and user_id is null and key = 'create_tickets';

-- ---------------------------------------------------------------------------
-- 2. Leadership changes only their own tickets
-- ---------------------------------------------------------------------------

drop policy tickets_update on public.tickets;
create policy tickets_update on public.tickets
  for update to authenticated
  using (
    public.can('update_status', restaurant_id)
    or (
      public.has_scope(restaurant_id) and public.can('create_tickets', restaurant_id)
      and (public.my_role() is distinct from 'leadership' or created_by = auth.uid())
    )
  )
  with check (
    public.can('update_status', restaurant_id)
    or (
      public.has_scope(restaurant_id) and public.can('create_tickets', restaurant_id)
      and (public.my_role() is distinct from 'leadership' or created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Walkthroughs and the In-house list stay the Reporters' (and Ops')
-- ---------------------------------------------------------------------------

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
  if not found or not public.can('create_tickets', w.restaurant_id)
     or public.my_role() is not distinct from 'leadership' then
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

drop policy inhouse_fixes_insert on public.inhouse_fixes;
create policy inhouse_fixes_insert on public.inhouse_fixes
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id) and created_by = auth.uid()
    and public.my_role() is distinct from 'leadership'
    and done_at is null and done_by is null and first_done_at is null
    and walkthrough_id is null and check_id is null and origin_label is null and converted_ticket_id is null
    and equipment_id is null and category_id is null and from_ticket_id is null and not from_ops
  );

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
  if f.id is null or not public.can('create_tickets', f.restaurant_id)
     or public.my_role() is not distinct from 'leadership' then
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
revoke all on function public.set_inhouse_fix_done(uuid, boolean) from public, anon;
grant execute on function public.set_inhouse_fix_done(uuid, boolean) to authenticated;

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
  if f.id is null or not public.can('create_tickets', f.restaurant_id)
     or public.my_role() is not distinct from 'leadership' then
    raise exception 'you can''t delete this task' using errcode = '42501';
  end if;
  if f.first_done_at is not null then
    raise exception 'a task that was checked off stays on the record' using errcode = '23514';
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'inhouse_fix.delete', f.restaurant_id,
          jsonb_build_object('title', f.title, 'origin', f.origin_label));

  delete from public.inhouse_fixes where id = p_id;

  if f.check_id is not null then
    -- The lock the walkthrough's own functions take, so a fix or ticket being added to
    -- this item at the same moment is seen before its check is judged empty.
    perform 1 from public.walkthroughs where id = f.walkthrough_id for update;
    delete from public.walkthrough_checks c
    where c.id = f.check_id
      and c.result <> 'good'
      and not exists (select 1 from public.inhouse_fixes x where x.check_id = c.id)
      and not exists (select 1 from public.tickets k where k.walkthrough_check_id = c.id);
  end if;
end;
$$;
revoke all on function public.delete_inhouse_fix(uuid) from public, anon;
grant execute on function public.delete_inhouse_fix(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Whoever filed a ticket hears of it (as 20261130120000, with leadership's own tickets)
-- ---------------------------------------------------------------------------

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
      and (p.role in ('ops', 'manager') or (p.role = 'leadership' and p.id = n.created_by))
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
revoke all on function public.notification_recipients(uuid) from public, anon, authenticated;
grant execute on function public.notification_recipients(uuid) to service_role;

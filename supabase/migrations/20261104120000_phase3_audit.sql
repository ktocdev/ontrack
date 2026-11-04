-- OT-55: fixes from the security audit of what Phase 3 added (Nov 4, 2026).
--
-- 1. Writing in a thread needed only to see the ticket, so an admin, a manager with
--    see_all_tickets and an Ops manager narrowed to one restaurant could post messages,
--    internal notes and photos on tickets outside their scope, and anyone could upload a
--    file under a closed ticket. can_post_on_ticket() is the one rule now: in scope at the
--    restaurant, holding create_tickets or update_status there, and the ticket open unless
--    update_status. Reading is unchanged.
-- 2. tickets_guard kept a manager off the assignee, the date and other statuses, but not
--    off the bookkeeping: reopen_count, reopened_at, last_closed_at, closed_by, and
--    closed_at for Ops. Those now change only through the guard's own status logic, for
--    everyone but the service role (seed, migrations).
-- 3. A reopen needed no reason: a bare status change out of closed skipped reopen_ticket,
--    for Ops too, though the plan says Ops can't bring a ticket back. Leaving closed now
--    needs the mark reopen_ticket sets for that transaction.
-- 4. A ticket could link to another restaurant's ticket or walkthrough, and a manager could
--    change where a ticket came from. Links must stay at the ticket's restaurant, checked
--    as equipment is; source, walkthrough and parent change only by Ops.
-- 5. A message's created_at and meta were the client's, so a manager could backdate a
--    message into the thread's past or give it a system event's meta. The database sets both.
-- 6. The push endpoint guard had no end anchor, so a URL with a newline or spaces after the
--    host was accepted. It is anchored now and refuses whitespace and control characters.
--
-- Not here: pg_net grants net.http_post and schema usage to anon and authenticated. Those
-- grants are the extension's own, owned by supabase_admin, and a migration runs as postgres,
-- which cannot take them back (the revoke is a no-op with a warning). The net schema is not
-- among the API's exposed schemas, so nothing reaches them from outside; accepted, and noted
-- in the plan.

-- ---------------------------------------------------------------------------
-- 1. Who may write in a thread
-- ---------------------------------------------------------------------------

create or replace function public.can_post_on_ticket(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = tid
      and public.has_scope(t.restaurant_id)
      and (public.can('create_tickets', t.restaurant_id) or public.can('update_status', t.restaurant_id))
      and (t.status <> 'closed' or public.can('update_status', t.restaurant_id))
  );
$$;
revoke all on function public.can_post_on_ticket(uuid) from public, anon;
grant execute on function public.can_post_on_ticket(uuid) to authenticated, service_role;

drop policy ticket_updates_insert on public.ticket_updates;
create policy ticket_updates_insert on public.ticket_updates
  for insert to authenticated
  with check (
    kind = 'message'
    and author_id = auth.uid()
    and public.can_post_on_ticket(ticket_id)
    and (not internal or public.my_role() = 'ops')
  );

drop policy ticket_photos_insert on public.ticket_photos;
create policy ticket_photos_insert on public.ticket_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_post_on_ticket(ticket_id)
    and (
      update_id is null
      or exists (
        select 1 from public.ticket_updates u
        where u.id = update_id and u.ticket_id = ticket_photos.ticket_id and u.author_id = auth.uid()
      )
    )
  );

drop policy "ticket photos: upload with ticket" on storage.objects;
create policy "ticket photos: upload with ticket" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and owner_id = auth.uid()::text
    and public.can_post_on_ticket(public.path_uuid(name))
  );

-- ---------------------------------------------------------------------------
-- 5. A message's time and meta come from the database
-- ---------------------------------------------------------------------------

create or replace function public.ticket_updates_from_people()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'message' and not public.is_service() then
    new.created_at := now();
    new.meta := '{}'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.ticket_updates_from_people() from public, anon;

create trigger ticket_updates_from_people before insert on public.ticket_updates
  for each row execute function public.ticket_updates_from_people();

-- ---------------------------------------------------------------------------
-- 2, 3, 4. The guard
-- ---------------------------------------------------------------------------

create or replace function public.reopen_ticket(p_id uuid, p_note text, p_paths text[] default '{}')
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if nullif(btrim(p_note), '') is null then
    raise exception 'a reopen needs a reason' using errcode = '22023';
  end if;

  -- The guard lets a ticket leave closed only with this mark, so a reopen always has its reason.
  perform set_config('ontrack.reopen_with_reason', p_id::text, true);
  update public.tickets set status = 'reopened' where id = p_id and status = 'closed';
  if not found then
    raise exception 'no closed ticket to reopen' using errcode = 'P0002';
  end if;

  perform public.post_ticket_update(p_id, p_note, p_paths);
end;
$$;

create or replace function public.tickets_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ops boolean := public.can('update_status', new.restaurant_id);
  v_service boolean := public.is_service();
  v_status_change boolean;
  v_reopening boolean;
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
  v_reopening := v_status_change and old.status = 'closed';

  if new.restaurant_id is distinct from old.restaurant_id
     or new.number is distinct from old.number
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'ticket identity columns cannot change' using errcode = '42501';
  end if;

  if not v_service then
    -- The record of closing and reopening is written here, never by a client.
    if new.closed_at is distinct from old.closed_at
       or new.closed_by is distinct from old.closed_by
       or new.last_closed_at is distinct from old.last_closed_at
       or new.reopened_at is distinct from old.reopened_at
       or new.reopen_count is distinct from old.reopen_count then
      raise exception 'when a ticket closed or reopened is kept by the database' using errcode = '42501';
    end if;
    if v_reopening and current_setting('ontrack.reopen_with_reason', true) is distinct from new.id::text then
      raise exception 'a closed ticket is reopened through Reopen, with a reason' using errcode = '42501';
    end if;
  end if;

  -- Bookkeeping that applies to everyone
  if v_status_change and new.status = 'closed' then
    new.closed_at := now();
    new.closed_by := auth.uid();
    new.last_closed_at := new.closed_at;
  elsif v_reopening then
    -- leaving closed is a reopen
    new.status := 'reopened';
    new.closed_at := null;
    new.closed_by := null;
    new.reopened_at := now();
    new.reopen_count := old.reopen_count + 1;
    new.resolution := null;
    new.assignee_id := null;
    new.scheduled_for := null;
  end if;

  if v_ops or v_service then
    return new;
  end if;

  -- Non-ops from here on
  if new.assignee_id is distinct from old.assignee_id and not v_reopening then
    raise exception 'only ops can assign tickets' using errcode = '42501';
  end if;
  if new.scheduled_for is distinct from old.scheduled_for and not v_reopening then
    raise exception 'only ops can schedule tickets' using errcode = '42501';
  end if;
  if new.source is distinct from old.source
     or new.walkthrough_id is distinct from old.walkthrough_id
     or new.parent_ticket_id is distinct from old.parent_ticket_id then
    raise exception 'only ops can change where a ticket came from' using errcode = '42501';
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

-- A ticket's links stay at its restaurant, as its equipment does. It runs as the caller,
-- so a ticket or walkthrough they cannot see is refused the same way.
create or replace function public.tickets_links_here()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_ticket_id is not null
     and (tg_op = 'INSERT' or new.parent_ticket_id is distinct from old.parent_ticket_id)
     and not exists (
       select 1 from public.tickets p where p.id = new.parent_ticket_id and p.restaurant_id = new.restaurant_id
     ) then
    raise exception 'a ticket links only to a ticket at the same restaurant' using errcode = '23514';
  end if;
  if new.walkthrough_id is not null
     and (tg_op = 'INSERT' or new.walkthrough_id is distinct from old.walkthrough_id)
     and not exists (
       select 1 from public.walkthroughs w where w.id = new.walkthrough_id and w.restaurant_id = new.restaurant_id
     ) then
    raise exception 'a ticket links only to a walkthrough at the same restaurant' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.tickets_links_here() from public, anon;

create trigger tickets_links_here before insert or update of parent_ticket_id, walkthrough_id on public.tickets
  for each row execute function public.tickets_links_here();

-- ---------------------------------------------------------------------------
-- 6. The endpoint guard, anchored
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions drop constraint push_endpoint_known;
alter table public.push_subscriptions
  add constraint push_endpoint_known check (
    length(endpoint) <= 2048
    and endpoint ~ '^https://(fcm\.googleapis\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/[^[:space:][:cntrl:]]*$'
  );

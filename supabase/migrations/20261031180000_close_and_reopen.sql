-- OT-29: closing and reopening a ticket.
--
-- A reopen needs a reason, and it belongs in the thread. reopen_ticket() does both
-- in one step as the caller, so tickets_guard still decides who may reopen and when
-- (a manager within 30 days). The reason goes in as a message with any photos, just
-- after the Reopened line the trigger writes.
--
-- Closed tickets are read-only for anyone without update_status, so a manager's
-- message or photo is refused there. Ops keeps the right, for what Phase 3 builds.
--
-- A unit retired after a ticket was linked to it must not stop that ticket being
-- saved. "update of equipment_id" fires whenever the column is in the statement, so
-- the check now looks at whether the link really changed.

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

  update public.tickets set status = 'reopened' where id = p_id and status = 'closed';
  if not found then
    raise exception 'no closed ticket to reopen' using errcode = 'P0002';
  end if;

  perform public.post_ticket_update(p_id, p_note, p_paths);
end;
$$;

revoke all on function public.reopen_ticket(uuid, text, text[]) from public, anon;
grant execute on function public.reopen_ticket(uuid, text, text[]) to authenticated;

drop policy ticket_updates_insert on public.ticket_updates;
create policy ticket_updates_insert on public.ticket_updates
  for insert to authenticated
  with check (
    kind = 'message'
    and author_id = auth.uid()
    and public.can_see_ticket(ticket_id)
    and (not internal or public.my_role() = 'ops')
    and public.my_role() is distinct from 'leadership'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and (t.status <> 'closed' or public.can('update_status', t.restaurant_id))
    )
  );

drop policy ticket_photos_insert on public.ticket_photos;
create policy ticket_photos_insert on public.ticket_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_see_ticket(ticket_id)
    and public.my_role() is distinct from 'leadership'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and (t.status <> 'closed' or public.can('update_status', t.restaurant_id))
    )
    and (
      update_id is null
      or exists (
        select 1 from public.ticket_updates u
        where u.id = update_id and u.ticket_id = ticket_photos.ticket_id and u.author_id = auth.uid()
      )
    )
  );

create or replace function public.tickets_equipment_here()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.equipment_id is not distinct from old.equipment_id then
    return new;
  end if;
  if new.equipment_id is not null and not exists (
    select 1 from public.equipment e
    where e.id = new.equipment_id and e.restaurant_id = new.restaurant_id and e.retired_at is null
  ) then
    raise exception 'this equipment is not available at this restaurant' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.tickets_equipment_here() from public, anon;

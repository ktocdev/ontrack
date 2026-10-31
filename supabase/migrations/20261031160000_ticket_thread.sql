-- OT-27: what the ticket thread needs from the database.
--
-- A message is activity, so it moves the ticket up the lists and "Updated" follows
-- it. Security definer because a manager may not otherwise write the ticket, and
-- the update only touches updated_at. Internal notes stay quiet, since the people
-- who can't read them would see the ticket move for no reason. So do closed
-- tickets, which tickets_guard keeps read-only, and system events, which already
-- come from a change to the ticket.
--
-- Messages get a length limit, as names and phones have.

create or replace function public.ticket_updates_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'message' and not new.internal then
    update public.tickets set updated_at = now()
    where id = new.ticket_id and status <> 'closed';
  end if;
  return new;
end;
$$;

revoke all on function public.ticket_updates_touch_ticket() from public, anon;

create trigger ticket_updates_touch_ticket after insert on public.ticket_updates
  for each row execute function public.ticket_updates_touch_ticket();

alter table public.ticket_updates
  add constraint ticket_updates_body_len check (char_length(body) <= 4000);

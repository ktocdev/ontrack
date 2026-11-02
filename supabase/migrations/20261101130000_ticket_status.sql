-- OT-39: Ops changes a ticket's status, and nobody assigns a ticket. Who is on a ticket
-- follows from its status, so the rule lives here in one step: back to Open takes the
-- person off, In progress puts you on it, and Waiting on parts or Scheduled keeps whoever
-- has it, or you if nobody does. A date belongs only to Scheduled.
--
-- take_ticket is for a ticket someone else has. These run as the caller, so RLS and
-- tickets_guard still apply, and the thread's events still come from tickets_log_events.
-- Closing and reopening have their own paths, so neither is a status here.

create or replace function public.set_ticket_status(
  p_id uuid,
  p_status public.ticket_status,
  p_scheduled_for date default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_status not in ('open', 'in_progress', 'waiting_parts', 'scheduled') then
    raise exception 'that status has its own step' using errcode = '22023';
  end if;
  if (p_status = 'scheduled') <> (p_scheduled_for is not null) then
    raise exception 'a date goes with Scheduled, and only with Scheduled' using errcode = '22023';
  end if;

  update public.tickets t
  set status = p_status,
      scheduled_for = p_scheduled_for,
      assignee_id = case p_status
        when 'open' then null
        when 'in_progress' then auth.uid()
        else coalesce(t.assignee_id, auth.uid())
      end
  where t.id = p_id
    and t.status <> 'closed'
    and public.can('update_status', t.restaurant_id);
  if not found then
    raise exception 'no ticket to change' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.take_ticket(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.tickets t
  set assignee_id = auth.uid(),
      status = case when t.status in ('open', 'reopened') then 'in_progress' else t.status end
  where t.id = p_id
    and t.status <> 'closed'
    and public.can('update_status', t.restaurant_id);
  if not found then
    raise exception 'no ticket to take' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_ticket_status(uuid, public.ticket_status, date) from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status, date) to authenticated;
revoke all on function public.take_ticket(uuid) from public, anon;
grant execute on function public.take_ticket(uuid) to authenticated;

-- OT-42: Start work on a reopened ticket, with a note for the restaurant, in one step, so a
-- failure leaves neither. Start work anyway does the same from a closed ticket: leaving
-- closed is always a reopen in tickets_guard, so that step comes first. It runs as the
-- caller, so set_ticket_status checks update_status and any failure undoes the whole step.

create function public.start_ticket_work(p_id uuid, p_note text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if nullif(btrim(p_note), '') is null then
    raise exception 'starting work needs a note' using errcode = '22023';
  end if;

  update public.tickets set status = 'reopened' where id = p_id and status = 'closed';
  perform public.set_ticket_status(p_id, 'in_progress');
  perform public.post_ticket_update(p_id, p_note);
end;
$$;

revoke all on function public.start_ticket_work(uuid, text) from public, anon;
grant execute on function public.start_ticket_work(uuid, text) to authenticated;

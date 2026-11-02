-- OT-52, from feedback: reopening stays simple, and a reopened ticket acts like a new one
-- apart from its Reopened badge. So nobody is on it and no date is set until Ops picks it
-- up. The database does this, since a manager can't touch either field themselves.

create or replace function public.tickets_guard()
returns trigger
language plpgsql
as $$
declare
  v_ops boolean := public.can('update_status', new.restaurant_id);
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

  if v_ops then
    return new;
  end if;

  -- Non-ops from here on
  if new.assignee_id is distinct from old.assignee_id and not v_reopening then
    raise exception 'only ops can assign tickets' using errcode = '42501';
  end if;
  if new.scheduled_for is distinct from old.scheduled_for and not v_reopening then
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

-- OT-45: who gets told what. Every thread event that matters writes one row to an outbox,
-- in the same step as the event, then asks send-push to deliver it. send-push takes nothing
-- from its caller but a shared secret: what it sends comes from these tables. A failed call
-- only delays things, since the next call delivers whatever is still waiting.
--
-- The call needs two values no migration can hold, set once per project in the SQL editor:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'send_push_url');
--   select vault.create_secret('<a long random value>', 'send_push_secret');
-- with the same random value as the SEND_PUSH_SECRET function secret. Until then, nothing is
-- sent and rows wait; rows older than a day are dropped when sending starts.

create extension if not exists pg_net;

-- Email is a switch of its own, as well as one per kind.
alter table public.notification_prefs drop constraint notification_prefs_kind_check;
alter table public.notification_prefs add constraint notification_prefs_kind_check
  check (kind in ('new_ticket', 'reopened', 'status_change', 'update', 'email'));

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  -- Events in one step share a timestamp, and this keeps them in order.
  seq          bigint generated always as identity,
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  kind         text not null check (kind in ('new_ticket', 'reopened', 'status_change', 'update')),
  actor_id     uuid references public.profiles (id) on delete set null,
  body         text,
  internal     boolean not null default false,
  status_to    text,
  -- Someone new is on the ticket, with or without a status change.
  picked_up    boolean not null default false,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
create index notifications_waiting_idx on public.notifications (seq) where processed_at is null;
-- Only the service role reads the outbox, which skips RLS.
alter table public.notifications enable row level security;
create policy notifications_none on public.notifications for select to authenticated using (false);

-- What was sent to whom, which the done test reads, and each person may read their own.
create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  ticket_id       uuid not null references public.tickets (id) on delete cascade,
  kind            text not null,
  channel         text not null check (channel in ('push', 'email')),
  status          text not null check (status in ('sent', 'gone', 'failed')),
  created_at      timestamptz not null default now()
);
create index notification_deliveries_user_idx on public.notification_deliveries (user_id, created_at desc);
alter table public.notification_deliveries enable row level security;
create policy notification_deliveries_read on public.notification_deliveries
  for select to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);

-- Never stops the ticket change that called it.
create function public.notify_send_push()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'send_push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
exception when others then
  raise warning 'send-push was not called: %', sqlerrm;
end;
$$;
revoke all on function public.notify_send_push() from public, anon, authenticated;

-- A status change and someone taking the ticket in one step are one row, told by the status;
-- taking it with no status change is a row with no status. A reopen's reason is a message
-- posted in the same step, so it becomes the reopen's words, not an update.
create function public.notify_on_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if new.kind = 'assigned' then
    -- Nobody on it now is told by its status, which comes with it.
    if new.meta ->> 'to' is null then
      return new;
    end if;
    insert into public.notifications (ticket_id, kind, actor_id, picked_up, created_at)
    values (new.ticket_id, 'status_change', new.author_id, true, new.created_at);
    perform public.notify_send_push();
    return new;
  end if;
  if new.kind in ('status_changed', 'closed') then
    update public.notifications n set status_to = new.meta ->> 'to', body = new.body
    where n.ticket_id = new.ticket_id and n.kind = 'status_change' and n.picked_up and n.status_to is null
      and n.actor_id is not distinct from new.author_id and n.created_at = new.created_at;
    if found then
      return new;
    end if;
  end if;
  if new.kind = 'message' then
    update public.notifications n set body = new.body
    where n.ticket_id = new.ticket_id and n.kind = 'reopened' and n.actor_id is not distinct from new.author_id
      and n.created_at = new.created_at and n.body is null;
    if found then
      return new;
    end if;
  end if;

  v_kind := case new.kind
    when 'created' then 'new_ticket'
    when 'reopened' then 'reopened'
    when 'message' then 'update'
    else 'status_change'
  end;
  insert into public.notifications (ticket_id, kind, actor_id, body, internal, status_to, created_at)
  values (new.ticket_id, v_kind, new.author_id, new.body, new.internal, new.meta ->> 'to', new.created_at);
  perform public.notify_send_push();
  return new;
end;
$$;
revoke all on function public.notify_on_ticket_update() from public, anon, authenticated;

create trigger notify_on_ticket_update after insert on public.ticket_updates
  for each row execute function public.notify_on_ticket_update();

-- Takes waiting rows so that two calls never send the same one. A call that dies part way
-- loses what it took, rather than sending it twice.
create function public.claim_notifications(p_limit int default 20)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications n
  set processed_at = now()
  where n.id in (
    select w.id from public.notifications w
    where w.processed_at is null
    order by w.seq
    limit p_limit
    for update skip locked
  )
  returning n.*;
$$;
revoke all on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;

-- Who gets what, in one place.
--   New ticket, reopen: every Ops manager covering the restaurant.
--   Status change, update: whoever opened the ticket and whoever is on it.
--   Internal note: nobody but its author.
-- Push never goes to whoever did it. Email is the same list, plus an Ops manager's own
-- actions, since Ops keeps their inbox as the record of their work, and another Ops manager
-- picking up or closing a ticket at a restaurant they cover. Taking a ticket with no status
-- change reaches only Ops. Everyone must still be active, a manager or Ops manager, and
-- covering the restaurant, and their switches apply.
create function public.notification_recipients(p_notification uuid)
returns table (user_id uuid, email text, full_name text, push boolean, send_email boolean)
language sql
stable
security definer
set search_path = public
as $$
  with n as (
    select x.*, t.restaurant_id, t.created_by, t.assignee_id, a.role as actor_role
    from public.notifications x
    join public.tickets t on t.id = x.ticket_id
    left join public.profiles a on a.id = x.actor_id
    where x.id = p_notification
  ),
  people as (
    select p.id, p.email, p.full_name, p.role, n.actor_id, n.actor_role, n.kind, n.internal, n.created_by,
      n.assignee_id, n.status_to, n.picked_up
    from public.profiles p
    cross join n
    where p.deactivated_at is null
      and p.role in ('ops', 'manager')
      and exists (
        select 1 from public.memberships m
        where m.user_id = p.id and (m.restaurant_id is null or m.restaurant_id = n.restaurant_id)
      )
  ),
  chosen as (
    select *,
      not internal and (
        (kind in ('new_ticket', 'reopened') and role = 'ops')
        or (kind = 'update' and id in (created_by, assignee_id))
        or (kind = 'status_change' and status_to is not null and id in (created_by, assignee_id))
      ) as told,
      role = 'ops' and (
        id is not distinct from actor_id
        or (actor_role = 'ops' and kind = 'status_change' and (picked_up or status_to = 'closed'))
      ) as ops_record
    from people
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

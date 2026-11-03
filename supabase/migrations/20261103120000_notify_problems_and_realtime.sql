-- OT-58, from trying OT-45 live. A mistake in the vault's URL stopped every notification with
-- no sign of why, since a failed call must never stop the ticket change that made it. It now
-- says why in a table, one row per different problem, which an admin can read:
--   select message, last_at, times from public.notify_problems order by last_at desc;
--
-- Also from trying it live: lists should change as tickets do. Realtime sends a signal for
-- each change to tickets, RLS decides who gets it, and the app rereads through its usual queries.

create table public.notify_problems (
  message  text primary key,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  times    int not null default 1
);
alter table public.notify_problems enable row level security;
create policy notify_problems_read on public.notify_problems
  for select to authenticated
  using (public.is_admin());

-- Never stops what called it, even if it can't write.
create function public.notify_problem(p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notify_problems (message) values (left(p_message, 500))
  on conflict (message) do update set last_at = now(), times = notify_problems.times + 1;
exception when others then
  raise warning 'send-push problem not recorded: %', p_message;
end;
$$;
revoke all on function public.notify_problem(text) from public, anon, authenticated;

create or replace function public.notify_send_push()
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
    perform public.notify_problem('send_push_url or send_push_secret is not in the vault, so nothing is being sent');
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
exception when others then
  perform public.notify_problem('send-push was not called: ' || sqlerrm);
end;
$$;
revoke all on function public.notify_send_push() from public, anon, authenticated;

alter publication supabase_realtime add table public.tickets;

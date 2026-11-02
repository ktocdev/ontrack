-- OT-44: push on a device. One row per device, whoever is signed in on it now, and one
-- switch per person for each kind of notification, on unless turned off.
--
-- The function that sends a push posts to the endpoint stored here with no further check,
-- so the table only takes the browsers' own push services. Otherwise anyone signed in
-- could make it post to an address of their choosing. A new push service needs adding here.

-- The table has waited since the first schema. Its per-device prefs move to one row per
-- person and kind, below, since someone wants the same switches on every device.
alter table public.push_subscriptions drop column prefs;
alter table public.push_subscriptions
  add constraint push_endpoint_known check (
    length(endpoint) <= 2048
    and endpoint ~ '^https://(fcm\.googleapis\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  ),
  add constraint push_keys_size check (length(p256dh) between 1 and 200 and length(auth) between 1 and 100);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Saved through save_push_subscription, since a device may hold someone else's row.
drop policy push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_read on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);

-- A phone handed to someone else keeps its endpoint, so the newest sign-in takes it over:
-- a device gets one person's notifications, never a past owner's.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_role() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, last_seen_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

create table public.notification_prefs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('new_ticket', 'reopened', 'status_change', 'update')),
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.notification_prefs enable row level security;

create policy notification_prefs_read on public.notification_prefs
  for select to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);
create policy notification_prefs_insert on public.notification_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy notification_prefs_update on public.notification_prefs
  for update to authenticated
  using (user_id = auth.uid() and public.my_role() is not null)
  with check (user_id = auth.uid() and public.my_role() is not null);

-- Someone deactivated stops getting notifications on every device.
create function public.push_forget_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.push_forget_on_deactivate() from public, anon, authenticated;

create trigger push_forget_on_deactivate after update of deactivated_at on public.profiles
  for each row
  when (new.deactivated_at is not null and old.deactivated_at is null)
  execute function public.push_forget_on_deactivate();

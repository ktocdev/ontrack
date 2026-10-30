-- Phase 1, OT-10: what the invite-user function relies on.
--
-- 1. One live invite per address. A second invite to someone still pending is a
--    mistake; an expired one is revoked by the function before a new one is made.
-- 2. renewal_requested_at limits "Ask admin for a new invite" on the Link expired
--    screen, which anyone holding an old link can press, to one email a day.
-- 3. A manager who accepts takes over any of their restaurants with no manager,
--    so the Restaurants list keeps showing a name after the invite is gone.

create unique index invites_one_pending on public.invites (lower(email)) where status = 'pending';

alter table public.invites add column renewal_requested_at timestamptz;

create or replace function public.invite_accepted_set_manager()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.restaurants
  set manager_id = new.user_id
  where id = any (new.restaurant_ids) and manager_id is null;
  return new;
end;
$$;

create trigger invites_accepted_set_manager after update of status on public.invites
  for each row
  when (new.status = 'accepted' and old.status <> 'accepted' and new.role = 'manager')
  execute function public.invite_accepted_set_manager();

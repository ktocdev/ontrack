-- Phase 1, OT-21: the rest of the audit's findings on what outlives a change of trust.
--
-- A new password or a deactivation should end what was trusted before it: remembered
-- phones and passes. Triggers, so every path is covered, including the reset link, the
-- dashboard and an admin's SQL. Backup codes stay: they are the person's own recovery,
-- and they are useless without the current password.

create or replace function public.two_step_forget_trust(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.two_step_devices where user_id = p_user;
  delete from public.two_step_passes where user_id = p_user;
$$;
revoke all on function public.two_step_forget_trust(uuid) from public, anon, authenticated;

create or replace function public.two_step_forget_on_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.two_step_forget_trust(new.id);
  return new;
end;
$$;
revoke all on function public.two_step_forget_on_password() from public, anon, authenticated;

-- No column list: it fires on any way of writing the row, and the condition does the work.
create trigger two_step_forget_on_password after update on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.two_step_forget_on_password();

create or replace function public.two_step_forget_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.two_step_forget_trust(new.id);
  return new;
end;
$$;
revoke all on function public.two_step_forget_on_deactivate() from public, anon, authenticated;

create trigger two_step_forget_on_deactivate after update of deactivated_at on public.profiles
  for each row
  when (new.deactivated_at is not null and old.deactivated_at is null)
  execute function public.two_step_forget_on_deactivate();

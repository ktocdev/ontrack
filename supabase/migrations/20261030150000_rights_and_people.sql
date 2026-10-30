-- Phase 1, OT-12: Roles & rights, User profile and View as.
--
-- 1. rights_guard: what the board calls locked, and what stops someone who holds
--    manage_rights without being an admin from raising themselves. Admin rights
--    cannot change, so there is always someone who can manage access. Anyone but
--    an admin cannot touch manage_rights, invite_users or see_all_tickets, their
--    own overrides or their own role's defaults.
-- 2. One function per action, each checking the caller and logging in one step:
--    save_role_defaults, set_person_rights, set_person_access, log_view_as. They
--    run as the caller, so RLS and rights_guard still apply to every write.
-- 3. v_person_history is what Delete account checks: an account can go only while
--    nothing points to it. The revoke-user function does the delete, since it
--    takes the auth user with it.
-- 4. A deactivated manager no longer holds a restaurant, so a new manager can take
--    it over when they accept their invite.

create or replace function public.rights_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_row public.rights%rowtype;
begin
  if public.is_service() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if v_row.role = 'admin'
    or exists (select 1 from public.profiles p where p.id = v_row.user_id and p.role = 'admin')
  then
    raise exception 'admin rights cannot be changed' using errcode = '42501';
  end if;

  if not public.is_admin() then
    if v_row.key in ('manage_rights', 'invite_users', 'see_all_tickets') then
      raise exception 'only an admin can change %', v_row.key using errcode = '42501';
    end if;
    if v_row.user_id = auth.uid() or v_row.role = public.my_role() then
      raise exception 'nobody can change their own rights' using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger rights_guard before insert or update or delete on public.rights
  for each row execute function public.rights_guard();

-- changes: [{ "role": "manager", "key": "see_costs", "allowed": true }, ...]
create or replace function public.save_role_defaults(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  c jsonb;
begin
  if not public.can('manage_rights') then
    raise exception 'you cannot manage rights' using errcode = '42501';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    insert into public.rights (role, key, allowed, updated_by)
    values ((c ->> 'role')::public.app_role, c ->> 'key', (c ->> 'allowed')::boolean, auth.uid())
    on conflict (role, user_id, key) do update
      set allowed = excluded.allowed, updated_by = excluded.updated_by;
  end loop;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'rights.defaults', jsonb_build_object('changes', p_changes));
end;
$$;

-- rights: [{ "key": "see_costs", "allowed": true }, ...]; a null allowed goes back
-- to the role's default.
create or replace function public.set_person_rights(p_user uuid, p_rights jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
begin
  if not public.can('manage_rights') then
    raise exception 'you cannot manage rights' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such person' using errcode = 'P0002';
  end if;

  for r in select * from jsonb_array_elements(p_rights) loop
    if r ->> 'allowed' is null then
      delete from public.rights where user_id = p_user and key = r ->> 'key';
    else
      insert into public.rights (user_id, key, allowed, updated_by)
      values (p_user, r ->> 'key', (r ->> 'allowed')::boolean, auth.uid())
      on conflict (role, user_id, key) do update
        set allowed = excluded.allowed, updated_by = excluded.updated_by;
    end if;
  end loop;

  insert into public.audit_log (actor_id, action, target_user_id, meta)
  values (auth.uid(), 'rights.override', p_user, jsonb_build_object('rights', p_rights));
end;
$$;

-- No restaurants means all of them, which a manager may not have.
create or replace function public.set_person_access(p_user uuid, p_role public.app_role, p_restaurants uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from public.app_role;
  v_home uuid;
  v_rid uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a role' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'nobody can change their own role' using errcode = '42501';
  end if;
  if p_role = 'manager' and cardinality(p_restaurants) = 0 then
    raise exception 'a manager must have at least one restaurant' using errcode = '23514';
  end if;
  if (select count(*) from public.restaurants where id = any (p_restaurants) and archived_at is null)
    <> cardinality(p_restaurants)
  then
    raise exception 'a restaurant is archived or does not exist' using errcode = '22023';
  end if;

  select role, home_restaurant_id into v_from, v_home from public.profiles where id = p_user;
  if v_from is null then
    raise exception 'no such person' using errcode = 'P0002';
  end if;

  -- Admin rights are locked, so an override carried into the role could never be
  -- removed. Done before the role changes, while rights_guard still allows it.
  if p_role = 'admin' then
    delete from public.rights where user_id = p_user;
  end if;

  update public.profiles
  set role = p_role,
      home_restaurant_id = case
        when p_role <> 'manager' then null
        when v_home = any (p_restaurants) then v_home
        else p_restaurants[1]
      end
  where id = p_user;

  delete from public.memberships where user_id = p_user;
  if cardinality(p_restaurants) = 0 then
    insert into public.memberships (user_id, restaurant_id) values (p_user, null);
  else
    foreach v_rid in array p_restaurants loop
      insert into public.memberships (user_id, restaurant_id) values (p_user, v_rid)
      on conflict do nothing;
    end loop;
  end if;

  -- Whoever manages a restaurant stays in step: a restaurant they left, or every
  -- one if they are no longer a manager, is free, and one with nobody is theirs.
  update public.restaurants
  set manager_id = null
  where manager_id = p_user and (p_role <> 'manager' or not id = any (p_restaurants));
  if p_role = 'manager' then
    update public.restaurants set manager_id = p_user
    where id = any (p_restaurants) and manager_id is null;
  end if;

  insert into public.audit_log (actor_id, action, target_user_id, meta)
  values (auth.uid(), 'user.access', p_user,
    jsonb_build_object('from', v_from, 'to', p_role, 'restaurants', p_restaurants));
end;
$$;

create or replace function public.log_view_as(p_user uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can view as someone' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_user and role <> 'admin' and deactivated_at is null
  ) then
    raise exception 'only an active person who is not an admin can be viewed' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, target_user_id)
  values (auth.uid(), 'view_as.start', p_user);
end;
$$;

-- Runs as the caller, so it only counts what the caller can see (admins see all).
create view public.v_person_history
with (security_invoker = true) as
select
  p.id as user_id,
  (
    (select count(*) from public.tickets t where p.id in (t.created_by, t.closed_by, t.assignee_id))
    + (select count(*) from public.ticket_updates u where u.author_id = p.id)
    + (select count(*) from public.ticket_photos f where f.created_by = p.id)
    + (select count(*) from public.equipment e where e.created_by = p.id)
    + (select count(*) from public.contractors c where c.created_by = p.id)
    + (select count(*) from public.service_records s where s.logged_by = p.id)
    + (select count(*) from public.invoices i where i.attached_by = p.id)
    + (select count(*) from public.walkthrough_schedules w where w.updated_by = p.id)
    + (select count(*) from public.walkthroughs w where p.id in (w.started_by, w.submitted_by))
    + (select count(*) from public.walkthrough_checks w where w.checked_by = p.id)
    + (select count(*) from public.inhouse_fixes x where p.id in (x.done_by, x.created_by))
    + (select count(*) from public.invites i where i.invited_by = p.id)
  )::int as records
from public.profiles p;

create or replace function public.free_restaurants_of_deactivated()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.restaurants set manager_id = null where manager_id = new.id;
  return new;
end;
$$;

create trigger profiles_free_restaurants after update of deactivated_at on public.profiles
  for each row
  when (new.deactivated_at is not null and old.deactivated_at is null)
  execute function public.free_restaurants_of_deactivated();

revoke all on function public.save_role_defaults(jsonb) from public, anon;
grant execute on function public.save_role_defaults(jsonb) to authenticated;
revoke all on function public.set_person_rights(uuid, jsonb) from public, anon;
grant execute on function public.set_person_rights(uuid, jsonb) to authenticated;
revoke all on function public.set_person_access(uuid, public.app_role, uuid[]) from public, anon;
grant execute on function public.set_person_access(uuid, public.app_role, uuid[]) to authenticated;
revoke all on function public.log_view_as(uuid) from public, anon;
grant execute on function public.log_view_as(uuid) to authenticated;

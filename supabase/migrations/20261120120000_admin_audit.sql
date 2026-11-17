-- Security pass over Admin on any role (OT-124). Admin used to be an account that did
-- nothing else; now it is held by someone on the Support Team, on a phone all day. Three
-- ways round the checked, logged functions are closed:
--
-- 1. An admin could write any profile's role, home restaurant or status straight through
--    the API (profiles_update lets admins write any row, and protect_profile_columns
--    passed them), so they could change their own role, which set_person_access refuses,
--    and anyone's with no audit row. Role and home restaurant now change only inside
--    set_person_access; status only through revoke-user (the service role), which also
--    bans the account and ends its sessions.
-- 2. The same for memberships: an admin could change anyone's restaurants, their own too.
--    No direct writes now; set_person_access and handle_new_user write them.
-- 3. Someone holding Manage rights but not Admin could change the overrides of someone who
--    holds Admin, as they never could for the Admin role. Only an admin may now.

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Admin changes only through set_admin, so it is always checked and logged.
  if new.is_admin is distinct from old.is_admin
    and not public.is_service()
    and coalesce(current_setting('ontrack.set_admin', true), '') <> 'on'
  then
    raise exception 'Admin is given and taken only through set_admin' using errcode = '42501';
  end if;
  if public.is_service() then
    return new;
  end if;
  if (new.role is distinct from old.role or new.home_restaurant_id is distinct from old.home_restaurant_id)
    and coalesce(current_setting('ontrack.person_access', true), '') <> 'on'
  then
    raise exception 'a role or restaurant changes only through set_person_access' using errcode = '42501';
  end if;
  if new.deactivated_at is distinct from old.deactivated_at then
    raise exception 'an account is deactivated only through revoke-user' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'only an admin can change an email' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- As before (20261118120000), reading the one setting set_person_access now sets.
create or replace function public.profiles_job_title_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_title_id is distinct from old.job_title_id
    and not public.is_service()
    and coalesce(current_setting('ontrack.person_access', true), '') <> 'on'
  then
    raise exception 'a job title is given only through set_person_access' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- As before (20261119120000), with the setting renamed, since it now covers role and home
-- restaurant as well as the job title.
create or replace function public.set_person_access(
  p_user uuid, p_role public.app_role, p_restaurants uuid[], p_job_title uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.app_role;
  v_home uuid;
  v_title uuid;
  v_rid uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a role' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'nobody can change their own role' using errcode = '42501';
  end if;
  if p_role is null or p_restaurants is null then
    raise exception 'say the role and the restaurants' using errcode = '22004';
  end if;
  if p_role = 'manager' and cardinality(p_restaurants) = 0 then
    raise exception 'a manager must have at least one restaurant' using errcode = '23514';
  end if;
  if (select count(*) from public.restaurants where id = any (p_restaurants) and archived_at is null)
    <> cardinality(p_restaurants)
  then
    raise exception 'a restaurant is archived or does not exist' using errcode = '22023';
  end if;

  select role, home_restaurant_id, job_title_id into v_from, v_home, v_title
  from public.profiles where id = p_user for update;
  if v_from is null then
    raise exception 'no such person' using errcode = 'P0002';
  end if;
  if p_role = 'admin' and v_from <> 'admin' then
    raise exception 'Admin is given with the Admin switch, not as a role' using errcode = '22023';
  end if;
  if p_job_title is distinct from v_title
    and p_job_title is not null
    and not exists (select 1 from public.job_titles where id = p_job_title and active)
  then
    raise exception 'that job title is turned off or does not exist' using errcode = '22023';
  end if;

  perform set_config('ontrack.person_access', 'on', true);
  update public.profiles
  set role = p_role,
      job_title_id = p_job_title,
      home_restaurant_id = case
        when p_role <> 'manager' then null
        when v_home = any (p_restaurants) then v_home
        else p_restaurants[1]
      end
  where id = p_user;
  perform set_config('ontrack.person_access', '', true);

  if p_job_title is distinct from v_title and p_job_title is not null then
    perform public.apply_job_title_view(p_user, p_job_title);
  end if;

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
    jsonb_build_object('from', v_from, 'to', p_role, 'restaurants', p_restaurants,
      'job_title_from', v_title, 'job_title_to', p_job_title));
end;
$$;
revoke all on function public.set_person_access(uuid, public.app_role, uuid[], uuid) from public, anon;
grant execute on function public.set_person_access(uuid, public.app_role, uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Memberships
-- ---------------------------------------------------------------------------

drop policy memberships_write on public.memberships;

-- add_restaurant gives its new manager a membership there, which it did through that
-- policy. It checks for an admin before anything else, so it runs as its owner now, like
-- set_person_access.
alter function public.add_restaurant(text, text, text, text, uuid) security definer;

-- ---------------------------------------------------------------------------
-- 3. Rights of someone holding Admin
-- ---------------------------------------------------------------------------

-- As before (20261119120000), plus: anyone but an admin keeps off the overrides of someone
-- who holds Admin.
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

  if v_row.user_id = auth.uid() then
    raise exception 'nobody can change their own rights' using errcode = '42501';
  end if;

  if not public.is_admin() then
    if v_row.key in ('manage_rights', 'invite_users', 'see_all_tickets') then
      raise exception 'only an admin can change %', v_row.key using errcode = '42501';
    end if;
    if v_row.role = public.my_role() then
      raise exception 'nobody can change their own rights' using errcode = '42501';
    end if;
    if exists (select 1 from public.profiles p where p.id = v_row.user_id and p.is_admin) then
      raise exception 'only an admin can change an admin''s rights' using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

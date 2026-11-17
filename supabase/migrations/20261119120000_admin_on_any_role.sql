-- Admin on any role (OT-122, planned in OT-121). The group's admin is its head ops
-- manager, who stays on the Support Team and works tickets under their own name. So Admin
-- becomes something a person holds on top of their role: profiles.is_admin.
--
-- 1. profiles.is_admin and invites.is_admin. Everyone whose role is admin holds it, and
--    always will (profiles_admin_role_holds_admin); the plain Admin role stays for an
--    account that does nothing else.
-- 2. is_admin() reads the flag, which moves every policy and function that asks it. The
--    few places that tested the role move too: two_step_required(), rights_guard,
--    log_view_as. can() answers invite_users and manage_rights for anyone holding Admin,
--    whatever their restaurants; every other right follows their role, as before.
-- 3. set_admin(): only an admin gives or takes it, never their own, logged. Nothing else
--    changes the flag (protect_profile_columns), and the last active admin can't lose it,
--    be deactivated or be deleted, whoever tries (profiles_keep_an_admin).
-- 4. set_person_access no longer gives the Admin role, which the Admin switch replaces, and
--    an invite carries Admin into handle_new_user.

-- ---------------------------------------------------------------------------
-- 1. The flag
-- ---------------------------------------------------------------------------

alter table public.profiles add column is_admin boolean not null default false;
update public.profiles set is_admin = true where role = 'admin';
alter table public.profiles
  add constraint profiles_admin_role_holds_admin check (role <> 'admin' or is_admin);

alter table public.invites add column is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Who is an admin
-- ---------------------------------------------------------------------------

-- my_role() is null for someone deactivated or owing their second step, so this is false
-- for them too, as before.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.my_role() is not null
      and (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.two_step_required(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.is_admin)
    or exists (select 1 from public.two_step_resets r where r.user_id = p_user and r.answered_at is null)
    or exists (select 1 from public.two_step_codes c where c.user_id = p_user);
$$;
revoke all on function public.two_step_required(uuid) from public, anon, authenticated;

-- Admin's own two rights are the group's, so they don't follow restaurants: an admin who
-- is a Reporter at one restaurant still invites and manages anyone.
create or replace function public.can(action text, rid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.two_step_ok() and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.deactivated_at is null
      and (
        (p.is_admin and action in ('invite_users', 'manage_rights'))
        or (
          (rid is null or public.has_scope(rid))
          and coalesce(
            (select r.allowed from public.rights r
              where r.user_id = p.id and r.key = action),
            (select r.allowed from public.rights r
              where r.role = p.role and r.user_id is null and r.key = action),
            false
          )
        )
      )
  );
$$;

-- As before (20261030150000): the Admin role's rights are locked, and anyone but an admin
-- keeps off the three rights that grant access and off their own role's defaults. New:
-- nobody changes their own overrides, admins included, now that an admin has a working
-- role whose rights mean something.
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
  end if;

  return coalesce(new, old);
end;
$$;

-- Nobody is viewed as while they hold Admin, as an admin couldn't be before.
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
    where id = p_user and not is_admin and deactivated_at is null
  ) then
    raise exception 'only an active person who is not an admin can be viewed' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, target_user_id)
  values (auth.uid(), 'view_as.start', p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Giving and taking Admin
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
  if public.is_service() or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.home_restaurant_id is distinct from old.home_restaurant_id
    or new.deactivated_at is distinct from old.deactivated_at
    or new.email is distinct from old.email
  then
    raise exception 'only an admin can change role, restaurant, email or status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- There is always an active admin, so someone can always manage access. It holds for the
-- service role too, since revoke-user deactivates and deletes with it.
create function public.profiles_keep_an_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_admin and old.deactivated_at is null
    and (tg_op = 'DELETE' or not new.is_admin or new.deactivated_at is not null)
  then
    -- Two admins taking each other's away at once wait for each other here.
    perform 1 from public.profiles where is_admin and deactivated_at is null for update;
    if not exists (
      select 1 from public.profiles
      where is_admin and deactivated_at is null and id <> old.id
    ) then
      raise exception 'the last admin cannot lose Admin, be deactivated or be deleted'
        using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.profiles_keep_an_admin() from public, anon, authenticated;

create trigger profiles_keep_an_admin before update of is_admin, deactivated_at or delete on public.profiles
  for each row execute function public.profiles_keep_an_admin();

create function public.set_admin(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'only an admin can give or take Admin' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'nobody can change their own Admin' using errcode = '42501';
  end if;
  if p_on is null then
    raise exception 'say whether they hold Admin' using errcode = '22004';
  end if;

  select * into v_person from public.profiles where id = p_user for update;
  if v_person.id is null then
    raise exception 'no such person' using errcode = 'P0002';
  end if;
  if p_on and v_person.deactivated_at is not null then
    raise exception 'a deactivated person cannot be given Admin' using errcode = '22023';
  end if;
  if v_person.is_admin = p_on then
    return;
  end if;
  if not p_on and v_person.role = 'admin' then
    raise exception 'their role is Admin; give them another role first' using errcode = '22023';
  end if;

  perform set_config('ontrack.set_admin', 'on', true);
  update public.profiles set is_admin = p_on where id = p_user;
  perform set_config('ontrack.set_admin', '', true);

  insert into public.audit_log (actor_id, action, target_user_id, meta)
  values (auth.uid(), 'user.admin', p_user, jsonb_build_object('on', p_on));
end;
$$;
revoke all on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Roles and invites
-- ---------------------------------------------------------------------------

-- As before (20261118120000), except the Admin role is no longer given here: Admin is the
-- switch (set_admin), held on top of a role. Someone whose role is already Admin may keep
-- it, and moving them to another role leaves them holding Admin.
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

  perform set_config('ontrack.job_title', 'on', true);
  update public.profiles
  set role = p_role,
      job_title_id = p_job_title,
      home_restaurant_id = case
        when p_role <> 'manager' then null
        when v_home = any (p_restaurants) then v_home
        else p_restaurants[1]
      end
  where id = p_user;
  perform set_config('ontrack.job_title', '', true);

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

-- As before (20261118120000), plus Admin from the invite. Only an admin can put it on one
-- (invite-user checks), and the Admin role always holds it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_invite_id uuid;
  v_token text;
  v_role public.app_role;
  v_restaurants uuid[];
  v_name text;
  v_title uuid;
  v_admin boolean := false;
  v_rid uuid;
begin
  v_invite_id := nullif(new.raw_app_meta_data ->> 'invite_id', '')::uuid;
  v_token := nullif(new.raw_user_meta_data ->> 'invite_token', '');

  if v_invite_id is null and v_token is not null then
    select i.id into v_invite_id
    from public.invites i
    where i.token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
    if v_invite_id is null then
      raise exception 'OnTrack is invite only: that invite link is not valid for %', new.email
        using errcode = '42501';
    end if;
  end if;

  if v_invite_id is not null then
    select * into v_invite
    from public.invites i
    where i.id = v_invite_id
      and lower(i.email) = lower(new.email)
      and i.status = 'pending'
      and i.expires_at > now();
    if not found then
      raise exception 'OnTrack is invite only: invite % is not pending for %', v_invite_id, new.email
        using errcode = '42501';
    end if;
    v_role := v_invite.role;
    v_restaurants := v_invite.restaurant_ids;
    v_name := v_invite.full_name;
    v_admin := v_invite.is_admin;
    -- A title turned off since the invite went out is given to nobody new.
    v_title := (select id from public.job_titles where id = v_invite.job_title_id and active);
  elsif new.raw_app_meta_data ? 'role' then
    v_role := (new.raw_app_meta_data ->> 'role')::public.app_role;
    v_restaurants := coalesce(
      (select array_agg(x::uuid) from jsonb_array_elements_text(
        coalesce(new.raw_app_meta_data -> 'restaurant_ids', '[]'::jsonb)) as t(x)),
      '{}'::uuid[]
    );
  else
    raise exception 'OnTrack is invite only: % was not created from an invite', new.email
      using errcode = '42501';
  end if;

  if v_role = 'manager' and cardinality(v_restaurants) = 0 then
    raise exception 'a manager invite must name at least one restaurant'
      using errcode = '23514';
  end if;

  -- The display name is harmless, so user metadata may supply it.
  v_name := left(coalesce(
    nullif(v_name, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  ), 120);

  insert into public.profiles (id, full_name, email, role, home_restaurant_id, job_title_id, is_admin)
  values (
    new.id,
    v_name,
    new.email,
    v_role,
    case when v_role = 'manager' then v_restaurants[1] end,
    v_title,
    v_admin or v_role = 'admin'
  );

  if v_title is not null then
    perform public.apply_job_title_view(new.id, v_title);
  end if;

  if cardinality(v_restaurants) = 0 then
    insert into public.memberships (user_id, restaurant_id) values (new.id, null);
  else
    foreach v_rid in array v_restaurants loop
      insert into public.memberships (user_id, restaurant_id) values (new.id, v_rid)
      on conflict do nothing;
    end loop;
  end if;

  -- After the profile exists, since invites.user_id points at it.
  if v_invite.id is not null then
    update public.invites
      set status = 'accepted', accepted_at = now(), user_id = new.id
      where id = v_invite.id;
  end if;

  return new;
end;
$$;

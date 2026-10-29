-- Phase 1, OT-7: access hardening from the security audit of OT-2 and OT-6.
--
-- 1. handle_new_user claimed a pending invite by email alone, so the
--    invite-only rule rested on the hosted project's "Allow new users to
--    sign up" toggle (and email confirmations are off). An invite is now
--    claimed only when the row that creates the auth user names it in
--    app_metadata.invite_id, which only the service role can write, and the
--    email matches. role and restaurant_ids in app_metadata stay for the seed
--    and for accounts made by hand.
-- 2. Anyone holding invite_users could write invites directly: an admin
--    invite for a second address of their own, or a pending invite re-pointed
--    at another role or a longer expiry. Invites are now read with
--    invite_users and written only by the service role (the invite-user and
--    revoke-user functions), which must refuse an admin invite from a caller
--    who is not an admin.
-- 3. protect_profile_columns refused the service role as well, because
--    is_admin() is false with no signed-in user, so revoke-user could never
--    set deactivated_at. is_service() lets the service role and the database
--    owner through; a signed-in person is still limited to name, phone, photo.
-- 4. avatar_path could point at any object; it must sit in the owner's
--    folder. Name and phone get length limits.
-- 5. A deactivated person could still edit their own profile row and push
--    subscriptions. Both now need an active profile, like every read path.
-- 6. Anyone signed in could write audit_log rows about themselves. Writers
--    are admins and holders of manage_rights or invite_users, and a rights
--    write must record its author.

-- ---------------------------------------------------------------------------
-- 3. The service role (Edge Functions) and the database owner (migrations,
--    seed) act with no signed-in user. Triggers that gate on is_admin() let
--    them through with this; RLS already does, since service_role bypasses it.
-- ---------------------------------------------------------------------------

create or replace function public.is_service()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is null
    and (auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin'));
$$;
revoke all on function public.is_service() from public;
grant execute on function public.is_service() to authenticated, service_role;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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

-- ---------------------------------------------------------------------------
-- 4. Column rules on profiles.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_avatar_in_own_folder
    check (avatar_path is null or avatar_path like id::text || '/%'),
  add constraint profiles_full_name_length
    check (char_length(full_name) between 1 and 120),
  add constraint profiles_phone_length
    check (phone is null or char_length(phone) <= 40);

-- ---------------------------------------------------------------------------
-- 5. Deactivation closes the write paths too.
-- ---------------------------------------------------------------------------

drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using ((id = auth.uid() and public.my_role() is not null) or public.is_admin())
  with check ((id = auth.uid() and public.my_role() is not null) or public.is_admin());

drop policy push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.my_role() is not null)
  with check (user_id = auth.uid() and public.my_role() is not null);

-- ---------------------------------------------------------------------------
-- 2. Invites: read with invite_users, written by the service role only.
-- ---------------------------------------------------------------------------

drop policy invites_all on public.invites;
create policy invites_select on public.invites
  for select to authenticated
  using (public.can('invite_users'));

-- ---------------------------------------------------------------------------
-- 6. Audit trail integrity.
-- ---------------------------------------------------------------------------

drop policy audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (public.is_admin() or public.can('manage_rights') or public.can('invite_users'))
  );

drop policy rights_write on public.rights;
create policy rights_write on public.rights
  for all to authenticated
  using (public.can('manage_rights'))
  with check (public.can('manage_rights') and updated_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 1. New users. Role and restaurants come from the invite named in
--    app_metadata.invite_id (the accept step of the invite-user function
--    creates the auth user with it), or from role and restaurant_ids in
--    app_metadata (seed, accounts made by hand). Only the service role can
--    write app_metadata; user metadata is the client's and never carries
--    privilege. With neither, the insert fails, so a sign-up against the
--    hosted project cannot create an account even if sign-ups were turned on.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_invite_id uuid;
  v_role public.app_role;
  v_restaurants uuid[];
  v_name text;
  v_rid uuid;
begin
  v_invite_id := nullif(new.raw_app_meta_data ->> 'invite_id', '')::uuid;

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

  insert into public.profiles (id, full_name, email, role, home_restaurant_id)
  values (
    new.id,
    v_name,
    new.email,
    v_role,
    case when v_role = 'manager' then v_restaurants[1] end
  );

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

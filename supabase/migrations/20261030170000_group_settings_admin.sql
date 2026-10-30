-- Phase 1, OT-14: an admin edits the group's name and turns profile photos off or on.
--
-- group_settings stays unwritable through the API, so nothing can skip the log: both
-- changes go through a function here that checks the caller and logs in one step.
--
-- Off refuses new photos, in the avatars policies and on profiles.avatar_path, and
-- stops anyone reading someone else's. Files and paths are kept, so on restores them.
-- A person can still remove their own: they may be turning it off to get rid of it,
-- and Storage has to read a file to remove it, so their own stays readable to them.
-- A signed URL handed out before the switch works until it expires, within the hour;
-- the app stops asking for or showing photos on its next read of the setting.
-- Ticket and equipment photos are in other buckets and are not affected.

alter table public.group_settings add column profile_photos boolean not null default true;

create or replace function public.profile_photos_on()
returns boolean
language sql
stable
set search_path = public
as $$
  select profile_photos from public.group_settings;
$$;
revoke all on function public.profile_photos_on() from public, anon;
grant execute on function public.profile_photos_on() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The switch, enforced
-- ---------------------------------------------------------------------------

drop policy "avatars: read when active" on storage.objects;
create policy "avatars: read when active" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars' and public.my_role() is not null
    and (public.profile_photos_on() or public.path_uuid(name) = auth.uid())
  );

drop policy "avatars: owner uploads" on storage.objects;
create policy "avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.my_role() is not null
    and public.profile_photos_on()
    and public.path_uuid(name) = auth.uid()
    and owner_id = auth.uid()::text
  );

drop policy "avatars: owner replaces" on storage.objects;
create policy "avatars: owner replaces" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars' and public.my_role() is not null
    and public.profile_photos_on()
    and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text
  )
  with check (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text);

create or replace function public.profile_photo_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
    and not public.profile_photos_on()
  then
    raise exception 'profile photos are turned off' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_photo_guard before update of avatar_path on public.profiles
  for each row execute function public.profile_photo_guard();

-- ---------------------------------------------------------------------------
-- The two admin actions
-- ---------------------------------------------------------------------------

-- A blank short name means none. The table's checks refuse a bad length (23514).
create or replace function public.save_group_name(p_name text, p_short_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.group_settings%rowtype;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'only an admin can rename the group' using errcode = '42501';
  end if;
  select * into v_old from public.group_settings;
  update public.group_settings
  set name = btrim(p_name), short_name = nullif(btrim(p_short_name), '')
  where id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'group.rename', jsonb_build_object(
    'from', jsonb_build_object('name', v_old.name, 'short_name', v_old.short_name),
    'to', jsonb_build_object('name', btrim(p_name), 'short_name', nullif(btrim(p_short_name), ''))
  ));
end;
$$;

create or replace function public.set_profile_photos(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'only an admin can change this' using errcode = '42501';
  end if;
  if p_on is null then
    raise exception 'on or off' using errcode = '22023';
  end if;
  update public.group_settings set profile_photos = p_on where id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'group.profile_photos', jsonb_build_object('on', p_on));
end;
$$;

revoke all on function public.save_group_name(text, text) from public, anon;
grant execute on function public.save_group_name(text, text) to authenticated;
revoke all on function public.set_profile_photos(boolean) from public, anon;
grant execute on function public.set_profile_photos(boolean) to authenticated;

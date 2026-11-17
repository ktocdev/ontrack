-- Job titles (OT-117): the group's list of what people are called (Chef, IT, Ops manager,
-- General manager), picked rather than typed. A title grants nothing; it says who someone
-- is, and starts them on a view in My categories (OT-116).
--
-- 1. job_titles and job_title_areas (each area's starting Notify and Show, stored only off
--    the defaults, as area_prefs is). Read by anyone signed in; changed only by an admin
--    through add_job_title, save_job_title, set_job_title_active and delete_job_title,
--    each logged, by the archive and delete rule: a turned-off title is given to nobody
--    new, and a title is deleted only while nobody has it and no pending invite names it.
-- 2. profiles.job_title_id and invites.job_title_id. The title is given by an admin through
--    set_person_access, which now takes it as a fourth argument, or by an invite, which
--    handle_new_user takes. job_title_id changes in no other way (profiles_job_title_guard).
-- 3. Giving a title writes its starting view into the person's area_prefs in the same
--    step, replacing their area settings; their category settings stay. Keeping the same
--    title writes nothing, removing it leaves their settings, and editing a title on the
--    Job titles screen changes nobody who has it already.
-- 4. The four titles.

-- ---------------------------------------------------------------------------
-- 1. The list
-- ---------------------------------------------------------------------------

create table public.job_titles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  constraint job_titles_name_length check (char_length(btrim(name)) between 1 and 40)
);
create unique index job_titles_name_idx on public.job_titles (lower(btrim(name)));

create table public.job_title_areas (
  job_title_id uuid not null references public.job_titles (id) on delete cascade,
  area         public.area not null,
  notify       public.notify_level not null default 'all',
  shown        boolean not null default true,
  primary key (job_title_id, area),
  constraint job_title_areas_not_default check (notify <> 'all' or not shown)
);

alter table public.job_titles enable row level security;
alter table public.job_title_areas enable row level security;

create policy job_titles_select on public.job_titles
  for select to authenticated
  using (public.my_role() is not null);
create policy job_title_areas_select on public.job_title_areas
  for select to authenticated
  using (public.my_role() is not null);

revoke all on public.job_titles, public.job_title_areas from anon;
revoke insert, update, delete, truncate on public.job_titles, public.job_title_areas from authenticated;
grant select on public.job_titles, public.job_title_areas to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Who has one
-- ---------------------------------------------------------------------------

alter table public.profiles add column job_title_id uuid references public.job_titles (id) on delete restrict;
alter table public.invites add column job_title_id uuid references public.job_titles (id) on delete set null;
create index profiles_job_title_idx on public.profiles (job_title_id) where job_title_id is not null;
create index invites_job_title_idx on public.invites (job_title_id) where job_title_id is not null;

-- Only set_person_access changes a title, inside its own transaction, or the service role
-- (the seed, accounts made by hand). An admin's direct update would skip the log and the
-- starting view.
create function public.profiles_job_title_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_title_id is distinct from old.job_title_id
    and not public.is_service()
    and coalesce(current_setting('ontrack.job_title', true), '') <> 'on'
  then
    raise exception 'a job title is given only through set_person_access' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_job_title_guard() from public, anon, authenticated;

create trigger profiles_job_title_guard before update of job_title_id on public.profiles
  for each row execute function public.profiles_job_title_guard();

-- ---------------------------------------------------------------------------
-- 3. The starting view
-- ---------------------------------------------------------------------------

-- A title's areas from what the Job titles sheet sends: {"foh": {"notify": "off",
-- "shown": false}, ...}. An area left out is at the defaults. Internal.
create function public.job_title_write_view(p_id uuid, p_view jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_key text;
begin
  if p_view is null then
    p_view := '{}'::jsonb;
  end if;
  if jsonb_typeof(p_view) <> 'object' then
    raise exception 'a starting view is an object of areas' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_view) loop
    if v_key not in (select unnest(enum_range(null::public.area))::text)
      or jsonb_typeof(p_view -> v_key) <> 'object'
    then
      raise exception 'no such area: %', v_key using errcode = '22023';
    end if;
  end loop;

  delete from public.job_title_areas where job_title_id = p_id;
  insert into public.job_title_areas (job_title_id, area, notify, shown)
  select p_id, a.area, a.notify, a.shown
  from (
    select k::public.area as area,
           coalesce(p_view -> k ->> 'notify', 'all')::public.notify_level as notify,
           coalesce((p_view -> k ->> 'shown')::boolean, true) as shown
    from jsonb_object_keys(p_view) as k
  ) a
  where a.notify <> 'all' or not a.shown;
end;
$$;
revoke all on function public.job_title_write_view(uuid, jsonb) from public, anon, authenticated;

-- A title's view as the log keeps it.
create function public.job_title_view(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(area, jsonb_build_object('notify', notify, 'shown', shown)), '{}'::jsonb)
  from public.job_title_areas where job_title_id = p_id;
$$;
revoke all on function public.job_title_view(uuid) from public, anon, authenticated;

-- Writes a title's starting view as the person's area settings. Called by
-- set_person_access and handle_new_user only. Internal.
create function public.apply_job_title_view(p_user uuid, p_title uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.area_prefs where user_id = p_user;
  insert into public.area_prefs (user_id, area, notify, shown)
  select p_user, area, notify, shown from public.job_title_areas where job_title_id = p_title;
$$;
revoke all on function public.apply_job_title_view(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The list's functions
-- ---------------------------------------------------------------------------

create function public.job_title_name_taken(p_name text, p_except uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.job_titles
    where lower(btrim(name)) = lower(btrim(p_name)) and id is distinct from p_except
  );
$$;
revoke all on function public.job_title_name_taken(text, uuid) from public, anon, authenticated;

-- Whether anyone (deactivated too) has a title or a pending invite names it, for the
-- Delete button. Null for anyone but an admin.
create function public.job_title_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then
    exists (select 1 from public.profiles where job_title_id = p_id)
    or exists (select 1 from public.invites where job_title_id = p_id and status = 'pending')
  end;
$$;
revoke all on function public.job_title_in_use(uuid) from public, anon;
grant execute on function public.job_title_in_use(uuid) to authenticated;

create view public.v_job_title_history
with (security_invoker = true) as
select t.id as job_title_id, public.job_title_in_use(t.id) as in_use
from public.job_titles t;
grant select on public.v_job_title_history to authenticated;

create function public.add_job_title(p_name text, p_view jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can add a job title' using errcode = '42501';
  end if;
  if public.job_title_name_taken(p_name, null) then
    raise exception 'that job title already exists' using errcode = '23505';
  end if;

  insert into public.job_titles (name, sort_order)
  values (btrim(p_name), coalesce((select max(sort_order) + 1 from public.job_titles), 1))
  returning id into v_id;
  perform public.job_title_write_view(v_id, p_view);

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'job_title.add',
    jsonb_build_object('job_title_id', v_id, 'name', btrim(p_name), 'view', public.job_title_view(v_id)));
  return v_id;
end;
$$;

-- Renames a title and sets its starting view. People who have it keep their settings.
create function public.save_job_title(p_id uuid, p_name text, p_view jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.job_titles;
  v_from jsonb;
  v_to jsonb;
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a job title' using errcode = '42501';
  end if;
  select * into t from public.job_titles where id = p_id for update;
  if t.id is null then
    raise exception 'no such job title' using errcode = 'P0002';
  end if;
  if public.job_title_name_taken(p_name, p_id) then
    raise exception 'that job title already exists' using errcode = '23505';
  end if;

  v_from := public.job_title_view(p_id);
  update public.job_titles set name = btrim(p_name) where id = p_id;
  perform public.job_title_write_view(p_id, p_view);
  v_to := public.job_title_view(p_id);

  if t.name = btrim(p_name) and v_from = v_to then
    return;
  end if;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'job_title.save', jsonb_build_object(
    'job_title_id', p_id, 'from', t.name, 'to', btrim(p_name), 'view_from', v_from, 'view_to', v_to));
end;
$$;

create function public.set_job_title_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.job_titles;
begin
  if not public.is_admin() then
    raise exception 'only an admin can turn a job title off or on' using errcode = '42501';
  end if;
  select * into t from public.job_titles where id = p_id for update;
  if t.id is null then
    raise exception 'no such job title' using errcode = 'P0002';
  end if;
  if t.active = p_active then
    return;
  end if;

  update public.job_titles set active = p_active where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), case when p_active then 'job_title.turn_on' else 'job_title.turn_off' end,
          jsonb_build_object('job_title_id', p_id, 'name', t.name));
end;
$$;

create function public.delete_job_title(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.job_titles;
begin
  if not public.is_admin() then
    raise exception 'only an admin can delete a job title' using errcode = '42501';
  end if;
  select * into t from public.job_titles where id = p_id for update;
  if t.id is null then
    raise exception 'no such job title' using errcode = 'P0002';
  end if;
  if public.job_title_in_use(p_id) then
    raise exception 'someone has this job title; turn it off instead' using errcode = '23503';
  end if;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'job_title.delete', jsonb_build_object('job_title_id', p_id, 'name', t.name));

  delete from public.job_titles where id = p_id;
end;
$$;

revoke all on function public.add_job_title(text, jsonb) from public, anon;
grant execute on function public.add_job_title(text, jsonb) to authenticated;
revoke all on function public.save_job_title(uuid, text, jsonb) from public, anon;
grant execute on function public.save_job_title(uuid, text, jsonb) to authenticated;
revoke all on function public.set_job_title_active(uuid, boolean) from public, anon;
grant execute on function public.set_job_title_active(uuid, boolean) to authenticated;
revoke all on function public.delete_job_title(uuid) from public, anon;
grant execute on function public.delete_job_title(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Giving a title: set_person_access
-- ---------------------------------------------------------------------------

-- As before (20261030150000), plus the job title. Definer now, since giving a title writes
-- the person's area_prefs, which only they can write through the API; every check below
-- is on the caller, as before.
drop function public.set_person_access(uuid, public.app_role, uuid[]);

create function public.set_person_access(
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
  if p_job_title is distinct from v_title
    and p_job_title is not null
    and not exists (select 1 from public.job_titles where id = p_job_title and active)
  then
    raise exception 'that job title is turned off or does not exist' using errcode = '22023';
  end if;

  -- Admin rights are locked, so an override carried into the role could never be
  -- removed. Done before the role changes, while rights_guard still allows it.
  if p_role = 'admin' then
    delete from public.rights where user_id = p_user;
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
revoke all on function public.set_person_access(uuid, public.app_role, uuid[], uuid) from public, anon;
grant execute on function public.set_person_access(uuid, public.app_role, uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Giving a title: an invite (handle_new_user, as in 20261030140300, plus the title)
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
  v_token text;
  v_role public.app_role;
  v_restaurants uuid[];
  v_name text;
  v_title uuid;
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

  insert into public.profiles (id, full_name, email, role, home_restaurant_id, job_title_id)
  values (
    new.id,
    v_name,
    new.email,
    v_role,
    case when v_role = 'manager' then v_restaurants[1] end,
    v_title
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

-- ---------------------------------------------------------------------------
-- 4. This group's titles (from the ops manager, Nov 16, 2026). Fixed ids for the seed.
-- ---------------------------------------------------------------------------

insert into public.job_titles (id, name, sort_order) values
  ('eeeeeeee-eeee-4eee-8eee-000000000001', 'General manager', 1),
  ('eeeeeeee-eeee-4eee-8eee-000000000002', 'Chef', 2),
  ('eeeeeeee-eeee-4eee-8eee-000000000003', 'Ops manager', 3),
  ('eeeeeeee-eeee-4eee-8eee-000000000004', 'IT', 4);

insert into public.job_title_areas (job_title_id, area, notify, shown) values
  ('eeeeeeee-eeee-4eee-8eee-000000000002', 'foh', 'off', false),
  ('eeeeeeee-eeee-4eee-8eee-000000000003', 'it', 'off', true),
  ('eeeeeeee-eeee-4eee-8eee-000000000004', 'foh', 'off', false),
  ('eeeeeeee-eeee-4eee-8eee-000000000004', 'boh', 'off', false);

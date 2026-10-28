-- OnTrack schema, part 2 of 8: org and access.
-- restaurants, profiles, memberships, rights, invites, push_subscriptions,
-- audit_log, the can() function every policy uses, and the policies for
-- these tables.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  phone       text,
  -- Accent shown as the color square before the name. Hex, validated.
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- The manager shown on the Restaurants screen. Nullable: a restaurant can
  -- exist before its manager accepts an invite.
  manager_id  uuid,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text not null,
  email               text not null unique,
  phone               text,
  role                public.app_role not null,
  -- The restaurant a manager calls home; drives the Profile screen and the
  -- default scope of their lists. Null for roles that span restaurants.
  home_restaurant_id  uuid references public.restaurants (id),
  deactivated_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.restaurants
  add constraint restaurants_manager_fk
  foreign key (manager_id) references public.profiles (id) on delete set null;

-- One row per person per restaurant they can act in. restaurant_id null means
-- every restaurant, which is the default for ops, leadership and admin.
create table public.memberships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  restaurant_id  uuid references public.restaurants (id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique nulls not distinct (user_id, restaurant_id)
);
create index memberships_restaurant_idx on public.memberships (restaurant_id);

-- The Roles & rights grid. A row with role set and user_id null is a role
-- default; a row with user_id set is a per-person override of that key.
create table public.rights (
  id        uuid primary key default gen_random_uuid(),
  role      public.app_role,
  user_id   uuid references public.profiles (id) on delete cascade,
  key       text not null check (key in (
              'create_tickets',
              'see_all_tickets',
              'update_status',
              'log_cost',
              'see_costs',
              'edit_equipment',
              'see_contractors',
              'set_walkthrough_schedule',
              'invite_users',
              'manage_rights'
            )),
  allowed   boolean not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  check ((role is null) <> (user_id is null)),
  unique nulls not distinct (role, user_id, key)
);

create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  full_name       text not null,
  role            public.app_role not null,
  -- Restaurants the invitee will be a member of; empty means all.
  restaurant_ids  uuid[] not null default '{}',
  -- Only the hash is stored; the link carries the token.
  token_hash      text not null unique,
  status          public.invite_status not null default 'pending',
  invited_by      uuid references public.profiles (id),
  sent_at         timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '72 hours',
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  user_id         uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index invites_email_idx on public.invites (lower(email));

-- One row per device that accepted push. prefs holds the per-kind switches
-- from the Notifications section on Profile.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  prefs       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Who did what, for the few actions that need a trail: View as, rights
-- changes, invites, revocations.
create table public.audit_log (
  id                    bigint generated always as identity primary key,
  actor_id              uuid references public.profiles (id) on delete set null,
  action                text not null,
  target_user_id        uuid references public.profiles (id) on delete set null,
  target_restaurant_id  uuid references public.restaurants (id) on delete set null,
  meta                  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger rights_updated_at before update on public.rights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permission functions. The JWT carries only the user id; everything else is
-- read from these tables. Every policy in the schema goes through can().
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and deactivated_at is null;
$$;

-- True when the caller may act in this restaurant: a membership for it, or
-- an all-restaurants membership.
create or replace function public.has_scope(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and (m.restaurant_id is null or m.restaurant_id = rid)
  );
$$;

-- The one permission check. A per-person override wins over the role default;
-- no row at all means no. With a restaurant id, the caller must also have
-- scope there. With null, only the right itself is checked.
create or replace function public.can(action text, rid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.deactivated_at is null
      and (rid is null or public.has_scope(rid))
      and coalesce(
        (select r.allowed from public.rights r
          where r.user_id = p.id and r.key = action),
        (select r.allowed from public.rights r
          where r.role = p.role and r.user_id is null and r.key = action),
        false
      )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role() = 'admin';
$$;

revoke all on function public.can(text, uuid) from public;
grant execute on function public.can(text, uuid) to authenticated, service_role;
revoke all on function public.has_scope(uuid) from public;
grant execute on function public.has_scope(uuid) to authenticated, service_role;
revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated, service_role;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New users. Auth creates the user (invite accepted, or seed); this trigger
-- creates the profile and memberships from the metadata the invite carried.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_restaurants uuid[];
  v_rid uuid;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'manager');
  v_restaurants := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data -> 'restaurant_ids', '[]'::jsonb)) as t(x)),
    '{}'::uuid[]
  );

  insert into public.profiles (id, full_name, email, role, home_restaurant_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    case when v_role = 'manager' and cardinality(v_restaurants) > 0 then v_restaurants[1] end
  )
  on conflict (id) do nothing;

  if cardinality(v_restaurants) = 0 then
    insert into public.memberships (user_id, restaurant_id) values (new.id, null)
    on conflict do nothing;
  else
    foreach v_rid in array v_restaurants loop
      insert into public.memberships (user_id, restaurant_id) values (new.id, v_rid)
      on conflict do nothing;
    end loop;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- People may edit their own name and phone, nothing else. Admins may change
-- role and home restaurant through the User profile screen.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and (
    new.role is distinct from old.role
    or new.home_restaurant_id is distinct from old.home_restaurant_id
    or new.deactivated_at is distinct from old.deactivated_at
    or new.email is distinct from old.email
  ) then
    raise exception 'only an admin can change role, restaurant, email or status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.restaurants       enable row level security;
alter table public.profiles          enable row level security;
alter table public.memberships       enable row level security;
alter table public.rights            enable row level security;
alter table public.invites           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_log         enable row level security;

-- Restaurants: you see the ones you have scope in; admins manage them.
create policy restaurants_select on public.restaurants
  for select to authenticated
  using (public.has_scope(id));
create policy restaurants_insert on public.restaurants
  for insert to authenticated
  with check (public.is_admin());
create policy restaurants_update on public.restaurants
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy restaurants_delete on public.restaurants
  for delete to authenticated
  using (public.is_admin());

-- Profiles: names and roles are visible to everyone signed in (assignees,
-- "Opened by", the Users list). Edits are own row or admin; the trigger
-- above limits which columns a non-admin may change.
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.my_role() is not null);
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Inserts come only from the auth trigger (security definer) or the service role.

-- Memberships: readable by all signed in; written by admins.
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.my_role() is not null);
create policy memberships_write on public.memberships
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Rights: readable by all signed in (the app hides controls from them);
-- written only with manage_rights.
create policy rights_select on public.rights
  for select to authenticated
  using (public.my_role() is not null);
create policy rights_write on public.rights
  for all to authenticated
  using (public.can('manage_rights')) with check (public.can('manage_rights'));

-- Invites: only people who may invite see or touch them. The token hash is
-- never needed by the app; the invite-user function compares it server side.
create policy invites_all on public.invites
  for all to authenticated
  using (public.can('invite_users')) with check (public.can('invite_users'));

-- Push subscriptions: strictly your own devices.
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit log: anyone can write a row about their own action; admins read.
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid());
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_admin());

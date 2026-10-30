-- Phase 1, OT-13: 2-step verification. Supabase Auth holds the authenticator
-- factors and raises a session to aal2 when a code checks out. This adds what the
-- boards draw that Auth does not have, and makes the database enforce it, since a
-- redirect in the app would not stop someone calling the API with a stolen password.
--
-- 1. two_step_ok() is false for a session that still owes its second step: anyone
--    with a verified factor at aal1, and any admin at aal1, factor or not. my_role(),
--    has_scope() and can() answer through it, the same way they honor deactivation,
--    so every policy does too. A manager with no factor is unaffected.
-- 2. Backup codes and "Don't ask again on this phone" cannot raise a token to aal2,
--    so each records a pass for that one session (the JWT's session_id, which only
--    Auth can sign). two_step_ok() accepts it. Auth itself still wants a real aal2
--    to change a password, so those flows ask for an authenticator code.
-- 3. two_step_status() is how the app finds out what is owed, since a session that
--    owes a step cannot read even its own profile.
-- 4. two_step_resets marks someone an admin has reset: they set it up again at next
--    sign-in, whatever their role. The reset-two-step function writes it.
--
-- Only the hash of a code or a device token is stored. These tables refuse everyone
-- through row-level security: only the functions here and the service role touch them.

create table public.two_step_codes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  primary key (user_id, code_hash)
);

create table public.two_step_devices (
  token_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 days'
);
create index two_step_devices_user_idx on public.two_step_devices (user_id);

-- Twelve hours matches the sign-in cap, so a pass never outlives its session's use.
create table public.two_step_passes (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index two_step_passes_user_idx on public.two_step_passes (user_id);

create table public.two_step_resets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reset_at timestamptz not null default now()
);

alter table public.two_step_codes enable row level security;
alter table public.two_step_devices enable row level security;
alter table public.two_step_passes enable row level security;
alter table public.two_step_resets enable row level security;
create policy two_step_codes_none on public.two_step_codes for all to authenticated using (false);
create policy two_step_devices_none on public.two_step_devices for all to authenticated using (false);
create policy two_step_passes_none on public.two_step_passes for all to authenticated using (false);
create policy two_step_resets_none on public.two_step_resets for all to authenticated using (false);

-- ---------------------------------------------------------------------------
-- The check
-- ---------------------------------------------------------------------------

create or replace function public.two_step_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or exists (
      select 1 from public.two_step_passes p
      where p.user_id = auth.uid()
        and p.session_id::text = auth.jwt() ->> 'session_id'
        and p.expires_at > now()
    )
    or not (
      exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
$$;

revoke all on function public.two_step_ok() from public, anon;
grant execute on function public.two_step_ok() to authenticated, service_role;

create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and deactivated_at is null and public.two_step_ok();
$$;

create or replace function public.has_scope(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.two_step_ok() and exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and p.deactivated_at is null
      and (m.restaurant_id is null or m.restaurant_id = rid)
  );
$$;

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

-- These three answered on the id alone, so they did not go through the check.
drop policy "avatars: owner replaces" on storage.objects;
create policy "avatars: owner replaces" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars' and public.my_role() is not null
    and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text
  );
drop policy "avatars: owner removes" on storage.objects;
create policy "avatars: owner removes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars' and public.my_role() is not null
    and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text
  );
drop policy support_reports_select on public.support_reports;
create policy support_reports_select on public.support_reports
  for select to authenticated
  using ((user_id = auth.uid() and public.my_role() is not null) or public.is_admin());

-- ---------------------------------------------------------------------------
-- What is owed
-- ---------------------------------------------------------------------------

-- gate: 'challenge' (has a factor, owes a code), 'setup' (must add one) or null.
create or replace function public.two_step_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_on boolean;
  v_required boolean;
begin
  select role into v_role from public.profiles where id = v_uid and deactivated_at is null;
  if v_role is null then
    return jsonb_build_object('gate', null, 'on', false, 'required', false, 'codes_left', 0);
  end if;
  v_on := exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified');
  v_required := v_role = 'admin' or exists (select 1 from public.two_step_resets r where r.user_id = v_uid);
  return jsonb_build_object(
    'gate', case
      when v_on and not public.two_step_ok() then 'challenge'
      when not v_on and v_required then 'setup'
    end,
    'on', v_on,
    'required', v_required,
    'codes_left', (select count(*) from public.two_step_codes c where c.user_id = v_uid and c.used_at is null)
  );
end;
$$;

-- For an admin's User profile; factors and codes are not otherwise readable.
create or replace function public.person_two_step(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can see this' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'on', exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified'),
    'required', exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
      or exists (select 1 from public.two_step_resets r where r.user_id = p_user),
    'codes_left', (select count(*) from public.two_step_codes c where c.user_id = p_user and c.used_at is null)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Backup codes
-- ---------------------------------------------------------------------------

create or replace function public.two_step_code_hash(p_user uuid, p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(
    p_user::text || ':' || upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

-- Eight new codes, replacing any old ones, shown this once. A real aal2 only: a
-- password with a remembered phone or one backup code cannot mint more.
create or replace function public.new_backup_codes()
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- 32 symbols, so a byte mod 32 is uniform; no 0, O, 1 or I to misread.
  c_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_uid uuid := auth.uid();
  v_codes text[] := array[]::text[];
  v_bytes bytea;
  v_code text;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' or public.my_role() is null then
    raise exception 'an authenticator code is needed first' using errcode = '42501';
  end if;

  delete from public.two_step_codes where user_id = v_uid;
  for i in 1..8 loop
    v_bytes := gen_random_bytes(8);
    v_code := '';
    for j in 0..7 loop
      v_code := v_code || substr(c_alphabet, get_byte(v_bytes, j) % 32 + 1, 1);
    end loop;
    v_code := left(v_code, 4) || '-' || right(v_code, 4);
    insert into public.two_step_codes (user_id, code_hash)
    values (v_uid, public.two_step_code_hash(v_uid, v_code));
    v_codes := v_codes || v_code;
  end loop;

  -- Having codes means setup finished, so a reset has been answered.
  delete from public.two_step_resets where user_id = v_uid;
  insert into public.audit_log (actor_id, action) values (v_uid, 'two_step.new_codes');
  return v_codes;
end;
$$;

-- 'ok', 'wrong', or 'locked' after ten wrong tries in 15 minutes. It returns rather
-- than raises on a wrong code, so the failed attempt it logs is kept.
create or replace function public.use_backup_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  if v_session is null or not exists (select 1 from public.profiles where id = v_uid and deactivated_at is null) then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if (
    select count(*) from public.audit_log
    where actor_id = v_uid and action = 'two_step.code_failed' and created_at > now() - interval '15 minutes'
  ) >= 10 then
    return 'locked';
  end if;

  update public.two_step_codes
  set used_at = now()
  where user_id = v_uid and code_hash = public.two_step_code_hash(v_uid, p_code) and used_at is null;
  if not found then
    insert into public.audit_log (actor_id, action) values (v_uid, 'two_step.code_failed');
    return 'wrong';
  end if;

  insert into public.two_step_passes (session_id, user_id) values (v_session, v_uid)
  on conflict (session_id) do update set expires_at = excluded.expires_at
    where two_step_passes.user_id = excluded.user_id;
  insert into public.audit_log (actor_id, action) values (v_uid, 'two_step.backup_code');
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Don't ask again on this phone for 30 days
-- ---------------------------------------------------------------------------

create or replace function public.remember_device()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if public.my_role() is null
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
  then
    raise exception 'no second step to remember' using errcode = '42501';
  end if;
  delete from public.two_step_devices where user_id = v_uid and expires_at <= now();
  insert into public.two_step_devices (token_hash, user_id) values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid);
  return v_token;
end;
$$;

-- Good only for the person it was given to, so a password is still needed first.
create or replace function public.use_remembered_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := (auth.jwt() ->> 'session_id')::uuid;
begin
  if v_session is null or not exists (
    select 1 from public.two_step_devices d
    join public.profiles p on p.id = d.user_id
    where d.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and d.user_id = v_uid and d.expires_at > now() and p.deactivated_at is null
  ) then
    return false;
  end if;
  insert into public.two_step_passes (session_id, user_id) values (v_session, v_uid)
  on conflict (session_id) do update set expires_at = excluded.expires_at
    where two_step_passes.user_id = excluded.user_id;
  return true;
end;
$$;

revoke all on function public.two_step_status() from public, anon;
grant execute on function public.two_step_status() to authenticated;
revoke all on function public.person_two_step(uuid) from public, anon;
grant execute on function public.person_two_step(uuid) to authenticated;
revoke all on function public.two_step_code_hash(uuid, text) from public, anon, authenticated;
revoke all on function public.new_backup_codes() from public, anon;
grant execute on function public.new_backup_codes() to authenticated;
revoke all on function public.use_backup_code(text) from public, anon;
grant execute on function public.use_backup_code(text) to authenticated;
revoke all on function public.remember_device() from public, anon;
grant execute on function public.remember_device() to authenticated;
revoke all on function public.use_remembered_device(text) from public, anon;
grant execute on function public.use_remembered_device(text) to authenticated;

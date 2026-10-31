-- Phase 1, OT-20: what the security audit of 2-step verification confirmed.
--
-- 1. A token from before a reset is dead. Auth lowers the session but the old access
--    token still says aal2 for up to an hour, so two_step_ok() compares the token's
--    iat with two_step_resets.reset_at. A reset row now stays, with answered_at set
--    once the person has set up again, so the cut-off outlives that setup.
-- 2. aal2 and passes count only with a verified factor, since a token's claim says
--    nothing about what has been removed since it was issued.
-- 3. Required means required at the database: an admin, anyone with an unanswered
--    reset, and anyone with backup codes but no factor. The last is what stops someone
--    turning 2-step off through Auth's own API, with no trigger on Auth's tables.
-- 4. Remembering a phone takes a real aal2, and spending that token takes a password
--    sign-in, so an inbox and that browser are not enough.
-- 5. end_sessions() is how reset-two-step removes refresh tokens. Without it, a live
--    attacker could refresh to a new aal1 token and enroll their own authenticator.

--
-- 6. is_admin() always answers true or false. It was null for anyone my_role() has no
--    answer for, deactivated or owing a step, so `if not is_admin()` let them through.
--    Row-level security stopped that in every function that runs as the caller, but
--    person_two_step runs as the owner, and showed them someone's 2-step state.

alter table public.two_step_resets add column answered_at timestamptz;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.two_step_required(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
    or exists (select 1 from public.two_step_resets r where r.user_id = p_user and r.answered_at is null)
    or exists (select 1 from public.two_step_codes c where c.user_id = p_user);
$$;
revoke all on function public.two_step_required(uuid) from public, anon, authenticated;

create or replace function public.two_step_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified') as has_factor
  )
  select
    not exists (
      select 1 from public.two_step_resets r
      where r.user_id = auth.uid()
        -- Whole seconds, so a token from the same second as the reset counts as before it.
        and coalesce((auth.jwt() ->> 'iat')::bigint, 0) <= extract(epoch from r.reset_at)::bigint
    )
    and (
      (me.has_factor and (
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or exists (
          select 1 from public.two_step_passes p
          where p.user_id = auth.uid()
            and p.session_id::text = auth.jwt() ->> 'session_id'
            and p.expires_at > now()
        )
      ))
      or (not me.has_factor and not public.two_step_required(auth.uid()))
    )
  from me;
$$;

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
  v_required := public.two_step_required(v_uid);
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
    'required', public.two_step_required(p_user),
    'codes_left', (select count(*) from public.two_step_codes c where c.user_id = p_user and c.used_at is null)
  );
end;
$$;

-- Also ends remembered phones and passes: new codes answer a reset or a removed
-- authenticator, and whatever was trusted before that should not carry over.
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
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    or public.my_role() is null
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
  then
    raise exception 'an authenticator code is needed first' using errcode = '42501';
  end if;

  delete from public.two_step_codes where user_id = v_uid;
  delete from public.two_step_devices where user_id = v_uid;
  delete from public.two_step_passes where user_id = v_uid;
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

  -- Having codes means setup finished, so a reset has been answered. The row stays:
  -- its reset_at keeps tokens from before the reset dead.
  update public.two_step_resets set answered_at = now() where user_id = v_uid and answered_at is null;
  insert into public.audit_log (actor_id, action) values (v_uid, 'two_step.new_codes');
  return v_codes;
end;
$$;

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
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    or public.my_role() is null
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
  then
    raise exception 'an authenticator code is needed first' using errcode = '42501';
  end if;
  delete from public.two_step_devices where user_id = v_uid and expires_at <= now();
  insert into public.two_step_devices (token_hash, user_id) values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid);
  return v_token;
end;
$$;

-- Good only for the person it was given to, in a session they signed in to with their
-- password. A reset link's session carries otp, so it cannot spend one.
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
  if v_session is null
    or not coalesce(auth.jwt() -> 'amr' @> '[{"method": "password"}]'::jsonb, false)
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')
    or not exists (
      select 1 from public.two_step_devices d
      join public.profiles p on p.id = d.user_id
      where d.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
        and d.user_id = v_uid and d.expires_at > now() and p.deactivated_at is null
    )
  then
    return false;
  end if;
  insert into public.two_step_passes (session_id, user_id) values (v_session, v_uid)
  on conflict (session_id) do update set expires_at = excluded.expires_at
    where two_step_passes.user_id = excluded.user_id;
  return true;
end;
$$;

-- Refresh tokens go with their session.
create or replace function public.end_sessions(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions where user_id = p_user;
$$;
revoke all on function public.end_sessions(uuid) from public, anon, authenticated;
grant execute on function public.end_sessions(uuid) to service_role;

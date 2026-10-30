-- Phase 1, OT-10: claim an invite with its token.
--
-- OT-7 had the accept step name the invite in app_metadata.invite_id. Supabase
-- Auth's admin API writes app_metadata only after it has inserted the user, so
-- this trigger never saw it and every real accept was refused. The pgTAP tests
-- missed it because they insert into auth.users directly; the invite flow test
-- in e2e/stack found it.
--
-- What is present at insert is user_metadata, which clients can write, so nothing
-- in it is believed as a claim. But the invite's token is a secret only the
-- invitee and this hash comparison know, so presenting it proves what the link
-- already proves: even with sign-ups left on, a sign-up with the right token and
-- the invited email gets exactly the invited role and nothing else, and anything
-- else is refused. Role and restaurants still come only from the invite row. The
-- invite-user function removes the token from the metadata straight after.
--
-- app_metadata.invite_id stays for accounts made by hand with an insert, and
-- role and restaurant_ids for the seed.

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

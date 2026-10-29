-- Phase 1, OT-9: Add restaurant.
--
-- An admin adds a restaurant in one step: the row, the chosen manager's
-- membership (so the manager shown can see it) and an audit entry. The
-- function runs as the caller, so every write still goes through RLS
-- (restaurants_insert, memberships_write and audit_log_insert all need an
-- admin); the is_admin() check up front just gives a clear error.
--
-- No two restaurants share an accent color: the square before the name is how
-- people tell them apart. Exact matches are refused here; near matches are
-- warned about on the form.

create unique index restaurants_color_unique on public.restaurants (lower(color));

alter table public.restaurants
  add constraint restaurants_name_len check (char_length(btrim(name)) between 1 and 80),
  add constraint restaurants_address_len check (char_length(address) <= 200),
  add constraint restaurants_phone_len check (char_length(phone) <= 40);

create or replace function public.add_restaurant(
  p_name text,
  p_address text,
  p_phone text,
  p_color text,
  p_manager_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can add a restaurant' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'a restaurant needs a name' using errcode = '22023';
  end if;

  if p_manager_id is not null and not exists (
    select 1 from public.profiles
    where id = p_manager_id and role = 'manager' and deactivated_at is null
  ) then
    raise exception 'the manager must be an active manager' using errcode = '22023';
  end if;

  insert into public.restaurants (name, address, phone, color, manager_id, sort_order)
  values (
    btrim(p_name),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_phone), ''),
    lower(p_color),
    p_manager_id,
    coalesce((select max(sort_order) from public.restaurants), 0) + 1
  )
  returning id into v_id;

  if p_manager_id is not null then
    insert into public.memberships (user_id, restaurant_id)
    values (p_manager_id, v_id)
    on conflict do nothing;
  end if;

  insert into public.audit_log (actor_id, action, target_user_id, target_restaurant_id, meta)
  values (auth.uid(), 'restaurant.add', p_manager_id, v_id, jsonb_build_object('name', btrim(p_name), 'color', lower(p_color)));

  return v_id;
end;
$$;

revoke all on function public.add_restaurant(text, text, text, text, uuid) from public, anon;
grant execute on function public.add_restaurant(text, text, text, text, uuid) to authenticated;

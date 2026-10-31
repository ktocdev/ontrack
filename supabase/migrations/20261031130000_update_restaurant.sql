-- OT-23: Edit restaurant (admins only).
--
-- Changes a restaurant's name, address, phone and color, and logs what changed
-- from what. Saving with nothing changed writes nothing. An archived restaurant
-- can be edited too, since it keeps its color and name out of use until it is.
-- The function runs as the caller, so RLS still guards every write; the unique
-- indexes refuse a name or an exact color another restaurant has.

create or replace function public.update_restaurant(
  p_id uuid,
  p_name text,
  p_address text,
  p_phone text,
  p_color text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.restaurants;
  v_new public.restaurants;
begin
  if not public.is_admin() then
    raise exception 'only an admin can edit a restaurant' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'a restaurant needs a name' using errcode = '22023';
  end if;

  select * into v_old from public.restaurants where id = p_id;
  if not found then
    raise exception 'no such restaurant' using errcode = 'P0002';
  end if;

  update public.restaurants
  set name = btrim(p_name),
      address = nullif(btrim(p_address), ''),
      phone = nullif(btrim(p_phone), ''),
      color = lower(p_color)
  where id = p_id
    and (name, address, phone, lower(color)) is distinct from
        (btrim(p_name), nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''), lower(p_color))
  returning * into v_new;

  if not found then
    return; -- nothing changed
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  select auth.uid(), 'restaurant.update', p_id, jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
  from jsonb_each(to_jsonb(v_old)) o
  join jsonb_each(to_jsonb(v_new)) n using (key)
  where o.key in ('name', 'address', 'phone', 'color')
    and o.value is distinct from n.value;
end;
$$;

revoke all on function public.update_restaurant(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_restaurant(uuid, text, text, text, text) to authenticated;

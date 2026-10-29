-- Phase 1, OT-9: archive and delete a restaurant (admins only).
--
-- Archive is for a restaurant that closes: it leaves everyone's lists, and no
-- new tickets, equipment, walkthroughs or in-house fixes can be added there,
-- but its history and memberships stay and it can be restored.
--
-- Delete is for a mistake or a test entry: only while the restaurant has no
-- history (tickets, equipment, walkthroughs, in-house fixes) and nobody calls
-- it home. Walkthrough schedules and quarterly task overrides are settings,
-- not history, and go with it.
--
-- All three functions run as the caller, so RLS still guards every write.

alter table public.restaurants
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null;

-- History per restaurant, for the Delete button and the delete check. Runs as
-- the caller, so it only counts what the caller can see (admins see all).
create view public.v_restaurant_history
with (security_invoker = true) as
select
  r.id as restaurant_id,
  (select count(*) from public.tickets t where t.restaurant_id = r.id)::int as tickets,
  (select count(*) from public.equipment e where e.restaurant_id = r.id)::int as equipment,
  (select count(*) from public.walkthroughs w where w.restaurant_id = r.id)::int as walkthroughs,
  (select count(*) from public.inhouse_fixes f where f.restaurant_id = r.id)::int as inhouse_fixes,
  (select count(*) from public.profiles p where p.home_restaurant_id = r.id)::int as home_of
from public.restaurants r;

-- Nothing new at an archived restaurant.
create or replace function public.refuse_archived_restaurant()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.restaurants where id = new.restaurant_id and archived_at is not null) then
    raise exception 'this restaurant is archived' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tickets_not_archived before insert on public.tickets
  for each row execute function public.refuse_archived_restaurant();
create trigger equipment_not_archived before insert on public.equipment
  for each row execute function public.refuse_archived_restaurant();
create trigger walkthroughs_not_archived before insert on public.walkthroughs
  for each row execute function public.refuse_archived_restaurant();
create trigger inhouse_fixes_not_archived before insert on public.inhouse_fixes
  for each row execute function public.refuse_archived_restaurant();

create or replace function public.set_restaurant_archived(p_id uuid, p_archived boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'only an admin can archive a restaurant' using errcode = '42501';
  end if;

  update public.restaurants
  set archived_at = case when p_archived then now() end,
      archived_by = case when p_archived then auth.uid() end
  where id = p_id and (archived_at is not null) <> p_archived
  returning name into v_name;

  if v_name is null then
    if not exists (select 1 from public.restaurants where id = p_id) then
      raise exception 'no such restaurant' using errcode = 'P0002';
    end if;
    return; -- already in that state
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when p_archived then 'restaurant.archive' else 'restaurant.restore' end,
          p_id, jsonb_build_object('name', v_name));
end;
$$;

create or replace function public.delete_restaurant(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  h public.v_restaurant_history;
begin
  if not public.is_admin() then
    raise exception 'only an admin can delete a restaurant' using errcode = '42501';
  end if;

  select name into v_name from public.restaurants where id = p_id;
  if v_name is null then
    raise exception 'no such restaurant' using errcode = 'P0002';
  end if;

  select * into h from public.v_restaurant_history where restaurant_id = p_id;
  if h.tickets + h.equipment + h.walkthroughs + h.inhouse_fixes > 0 then
    raise exception 'this restaurant has history; archive it instead' using errcode = '23503';
  end if;
  if h.home_of > 0 then
    raise exception 'someone has this restaurant as their home' using errcode = '23503';
  end if;

  -- Logged first: the entry keeps the name once the row is gone.
  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'restaurant.delete', p_id, jsonb_build_object('name', v_name));

  delete from public.restaurants where id = p_id;
end;
$$;

revoke all on function public.set_restaurant_archived(uuid, boolean) from public, anon;
grant execute on function public.set_restaurant_archived(uuid, boolean) to authenticated;
revoke all on function public.delete_restaurant(uuid) from public, anon;
grant execute on function public.delete_restaurant(uuid) to authenticated;

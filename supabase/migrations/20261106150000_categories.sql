-- OT-86: Categories for Ops and admins, by the archive and delete rule.
--
-- Categories are the group's, shared by every restaurant, and Ops looks after them
-- (decided Nov 6, 2026), with admins able to as well. A category is added, renamed,
-- turned off and on again, and deleted only while no ticket or unit has ever used it.
-- A turned-off one leaves the pickers and takes nothing new; what already uses it
-- keeps it.
--
-- Every change goes through a function that checks the caller and logs it, so the
-- direct write policies from OT-84 go. The functions run as definer because Ops can't
-- write audit_log, as the equipment functions do.

alter table public.categories
  add column active boolean not null default true,
  add constraint categories_name_length check (char_length(btrim(name)) between 1 and 60);

drop policy categories_insert on public.categories;
drop policy categories_update on public.categories;

-- Who looks after categories: Ops with edit_equipment, and admins.
create or replace function public.can_edit_categories()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin() or (public.my_role() = 'ops' and public.can('edit_equipment'));
$$;

revoke all on function public.can_edit_categories() from public, anon;
grant execute on function public.can_edit_categories() to authenticated;

-- Whether a ticket or a unit (retired or not) has ever used a category, at any
-- restaurant. Definer so the answer doesn't depend on the caller's scope; it says
-- nothing but yes or no.
create or replace function public.category_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tickets where category_id = p_id)
      or exists (select 1 from public.equipment where category_id = p_id);
$$;

revoke all on function public.category_in_use(uuid) from public, anon;
grant execute on function public.category_in_use(uuid) to authenticated;

create view public.v_category_history
with (security_invoker = true) as
select c.id as category_id, public.category_in_use(c.id) as in_use
from public.categories c;

grant select on public.v_category_history to authenticated;

-- A name already taken in that area, ignoring case and spaces at the ends.
create or replace function public.category_name_taken(p_name text, p_area public.area, p_except uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.categories
    where area = p_area and lower(btrim(name)) = lower(btrim(p_name)) and id is distinct from p_except
  );
$$;

revoke all on function public.category_name_taken(text, public.area, uuid) from public, anon;

create or replace function public.add_category(p_name text, p_area public.area)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_edit_categories() then
    raise exception 'only Ops or an admin can add a category' using errcode = '42501';
  end if;
  if public.category_name_taken(p_name, p_area, null) then
    raise exception 'that category already exists' using errcode = '23505';
  end if;

  insert into public.categories (name, area, sort_order)
  values (btrim(p_name), p_area,
          coalesce((select max(sort_order) from public.categories where area = p_area), 0) + 1)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'category.add', jsonb_build_object('category_id', v_id, 'name', btrim(p_name), 'area', p_area));
  return v_id;
end;
$$;

create or replace function public.rename_category(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.categories;
begin
  if not public.can_edit_categories() then
    raise exception 'only Ops or an admin can rename a category' using errcode = '42501';
  end if;
  select * into c from public.categories where id = p_id for update;
  if c.id is null then
    raise exception 'no such category' using errcode = 'P0002';
  end if;
  if public.category_name_taken(p_name, c.area, p_id) then
    raise exception 'that category already exists' using errcode = '23505';
  end if;
  if c.name = btrim(p_name) then
    return;
  end if;

  update public.categories set name = btrim(p_name) where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'category.rename', jsonb_build_object('category_id', p_id, 'from', c.name, 'to', btrim(p_name)));
end;
$$;

create or replace function public.set_category_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.categories;
begin
  if not public.can_edit_categories() then
    raise exception 'only Ops or an admin can turn a category off or on' using errcode = '42501';
  end if;
  select * into c from public.categories where id = p_id for update;
  if c.id is null then
    raise exception 'no such category' using errcode = 'P0002';
  end if;
  if c.active = p_active then
    return;
  end if;

  update public.categories set active = p_active where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), case when p_active then 'category.turn_on' else 'category.turn_off' end,
          jsonb_build_object('category_id', p_id, 'name', c.name));
end;
$$;

create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.categories;
begin
  if not public.can_edit_categories() then
    raise exception 'only Ops or an admin can delete a category' using errcode = '42501';
  end if;
  select * into c from public.categories where id = p_id for update;
  if c.id is null then
    raise exception 'no such category' using errcode = 'P0002';
  end if;
  if public.category_in_use(p_id) then
    raise exception 'this category has tickets or equipment; turn it off instead' using errcode = '23503';
  end if;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'category.delete', jsonb_build_object('category_id', p_id, 'name', c.name, 'area', c.area));

  delete from public.categories where id = p_id;
end;
$$;

revoke all on function public.add_category(text, public.area) from public, anon;
grant execute on function public.add_category(text, public.area) to authenticated;
revoke all on function public.rename_category(uuid, text) from public, anon;
grant execute on function public.rename_category(uuid, text) to authenticated;
revoke all on function public.set_category_active(uuid, boolean) from public, anon;
grant execute on function public.set_category_active(uuid, boolean) to authenticated;
revoke all on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;

-- A turned-off category takes no new ticket or unit, and nothing moves onto it.
create or replace function public.refuse_inactive_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_service() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.category_id is not distinct from old.category_id then
    return new;
  end if;
  if exists (select 1 from public.categories where id = new.category_id and not active) then
    raise exception 'this category is turned off' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.refuse_inactive_category() from public, anon;

create trigger tickets_category_active before insert or update of category_id on public.tickets
  for each row execute function public.refuse_inactive_category();
create trigger equipment_category_active before insert or update of category_id on public.equipment
  for each row execute function public.refuse_inactive_category();

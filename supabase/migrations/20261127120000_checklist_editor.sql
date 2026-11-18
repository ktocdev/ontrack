-- The checklist editor (OT-136, 6b; no board draws it, like Categories): a checklist's
-- sections, groups and items with directions, video link and category; add, rename,
-- reorder, turn off and on, delete only if never used, each checked (set_walkthrough_schedule,
-- the group's, as rotations go) and logged. Nothing writes the checklist through the API.
--
-- A walkthrough keeps the checklist it opened with (the plan, OT-102): it reads its
-- template's sections and items, so an edit to a checklist a walkthrough has had is made on
-- a new version of it. The first change after a month has opened copies the checklist
-- (copied_from on each part), marks the old one replaced_by the copy, and moves every
-- rotation month on it to the copy, so the next month opens with the edit and every
-- walkthrough so far keeps its own, submitted ones included. Further changes go to the copy
-- until a month opens with it. Each function returns the checklist's id after the change,
-- which the app follows.

-- ---------------------------------------------------------------------------
-- 1. Lineage and limits
-- ---------------------------------------------------------------------------

alter table public.walkthrough_templates
  add column copied_from uuid references public.walkthrough_templates (id) on delete set null,
  add column replaced_by uuid references public.walkthrough_templates (id) on delete set null,
  add constraint walkthrough_templates_name_length check (char_length(btrim(name)) between 1 and 60);
alter table public.walkthrough_sections
  add column copied_from uuid references public.walkthrough_sections (id) on delete set null;
alter table public.walkthrough_items
  add column copied_from uuid references public.walkthrough_items (id) on delete set null,
  add constraint walkthrough_items_directions_length check (directions is null or char_length(directions) <= 2000);

-- A month goes on the newest version of a checklist, never one an edit has replaced.
create function public.rotation_months_current()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.walkthrough_templates where id = new.template_id and replaced_by is not null) then
    raise exception 'that checklist has a newer version' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.rotation_months_current() from public, anon, authenticated;
create trigger rotation_months_current before insert on public.walkthrough_rotation_months
  for each row execute function public.rotation_months_current();

-- ---------------------------------------------------------------------------
-- 2. Copying a checklist
-- ---------------------------------------------------------------------------

-- A copy of a checklist with every section and item, each pointing back to what it copies.
create function public.copy_checklist(p_template uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.walkthrough_templates (name, description, short_name, active, copied_from)
  select coalesce(p_name, name), description, short_name, active, id
  from public.walkthrough_templates where id = p_template
  returning id into v_id;
  insert into public.walkthrough_sections (template_id, name, short_name, area, sort_order, active, copied_from)
  select v_id, name, short_name, area, sort_order, active, id
  from public.walkthrough_sections where template_id = p_template;
  insert into public.walkthrough_items (section_id, group_name, title, directions, video_url, sort_order, active,
                                        category_id, copied_from)
  select n.id, i.group_name, i.title, i.directions, i.video_url, i.sort_order, i.active, i.category_id, i.id
  from public.walkthrough_items i
  join public.walkthrough_sections o on o.id = i.section_id and o.template_id = p_template
  join public.walkthrough_sections n on n.template_id = v_id and n.copied_from = o.id;
  return v_id;
end;
$$;
revoke all on function public.copy_checklist(uuid, text) from public, anon, authenticated;

-- The checklist a change is made on: checks the caller, refuses one an edit has replaced
-- (the app reloads), and copies one a walkthrough has had, moving its rotation months on.
create function public.checklist_for_change(p_template uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.walkthrough_templates;
  v_id uuid;
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  select * into t from public.walkthrough_templates where id = p_template for update;
  if t.id is null then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  if t.replaced_by is not null then
    raise exception 'this checklist has a newer version; reload it' using errcode = '40001';
  end if;
  if not exists (select 1 from public.walkthroughs where template_id = t.id) then
    return t.id;
  end if;
  v_id := public.copy_checklist(t.id, null);
  update public.walkthrough_templates set replaced_by = v_id, updated_at = now() where id = t.id;
  update public.walkthrough_rotation_months set template_id = v_id where template_id = t.id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'checklist.version', jsonb_build_object('from', t.id, 'to', v_id, 'name', t.name));
  return v_id;
end;
$$;
revoke all on function public.checklist_for_change(uuid) from public, anon, authenticated;

-- A section or item of the checklist being changed, named by its id there or in the
-- version it was copied from; null if it is not on that checklist.
create function public.checklist_section(p_template uuid, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.walkthrough_sections
  where template_id = p_template and (id = p_id or copied_from = p_id)
  order by (id = p_id) desc limit 1;
$$;
revoke all on function public.checklist_section(uuid, uuid) from public, anon, authenticated;

create function public.checklist_item(p_template uuid, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select i.id from public.walkthrough_items i
  join public.walkthrough_sections s on s.id = i.section_id and s.template_id = p_template
  where i.id = p_id or i.copied_from = p_id
  order by (i.id = p_id) desc limit 1;
$$;
revoke all on function public.checklist_item(uuid, uuid) from public, anon, authenticated;

create function public.checklist_log(p_action text, p_template uuid, p_meta jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), p_action, jsonb_build_object('checklist', p_template) || coalesce(p_meta, '{}'));
$$;
revoke all on function public.checklist_log(text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A checklist
-- ---------------------------------------------------------------------------

-- A new checklist, empty or a copy of another (a copy stands on its own; nothing moves to it).
create function public.add_checklist(p_name text, p_description text, p_short_name text, p_copy_from uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  if p_copy_from is not null then
    if not exists (select 1 from public.walkthrough_templates where id = p_copy_from) then
      raise exception 'no such checklist' using errcode = 'P0002';
    end if;
    v_id := public.copy_checklist(p_copy_from, btrim(p_name));
    -- A copy to change is new: its parts have no history of their own.
    update public.walkthrough_templates set copied_from = null, active = true where id = v_id;
    update public.walkthrough_sections set copied_from = null where template_id = v_id;
    update public.walkthrough_items i set copied_from = null
    from public.walkthrough_sections s where s.id = i.section_id and s.template_id = v_id;
    update public.walkthrough_templates
    set description = nullif(btrim(coalesce(p_description, '')), ''), short_name = nullif(btrim(coalesce(p_short_name, '')), '')
    where id = v_id;
  else
    insert into public.walkthrough_templates (name, description, short_name)
    values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_description, '')), ''),
            nullif(btrim(coalesce(p_short_name, '')), ''))
    returning id into v_id;
  end if;
  perform public.checklist_log('checklist.add', v_id, jsonb_build_object('name', btrim(p_name), 'copy_of', p_copy_from));
  return v_id;
end;
$$;
revoke all on function public.add_checklist(text, text, text, uuid) from public, anon;
grant execute on function public.add_checklist(text, text, text, uuid) to authenticated;

-- Its name, its line ("A closer look") and its short name ("BOH + FOH").
create function public.save_checklist(p_template uuid, p_name text, p_description text, p_short_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
begin
  update public.walkthrough_templates
  set name = btrim(coalesce(p_name, '')), description = nullif(btrim(coalesce(p_description, '')), ''),
      short_name = nullif(btrim(coalesce(p_short_name, '')), ''), updated_at = now()
  where id = v_id;
  perform public.checklist_log('checklist.save', v_id, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end;
$$;
revoke all on function public.save_checklist(uuid, text, text, text) from public, anon;
grant execute on function public.save_checklist(uuid, text, text, text) to authenticated;

-- Turn a checklist off or on: off goes on no new month, and a rotation that has it keeps it.
-- No copy is needed: being picked is all it changes.
create function public.set_checklist_active(p_template uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  update public.walkthrough_templates set active = p_active, updated_at = now()
  where id = p_template and replaced_by is null and p_active is not null;
  if not found then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  perform public.checklist_log(case when p_active then 'checklist.turn_on' else 'checklist.turn_off' end, p_template, null);
end;
$$;
revoke all on function public.set_checklist_active(uuid, boolean) from public, anon;
grant execute on function public.set_checklist_active(uuid, boolean) to authenticated;

-- Delete a checklist no walkthrough has had and no rotation uses.
create function public.delete_checklist(p_template uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.can('set_walkthrough_schedule') then
    raise exception 'you cannot change the walkthrough checklists' using errcode = '42501';
  end if;
  select name into v_name from public.walkthrough_templates where id = p_template for update;
  if v_name is null then
    raise exception 'no such checklist' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.walkthroughs where template_id = p_template)
     or exists (select 1 from public.walkthrough_rotation_months where template_id = p_template) then
    raise exception 'a walkthrough or a rotation uses this checklist; turn it off instead' using errcode = '23503';
  end if;
  delete from public.walkthrough_templates where id = p_template;
  perform public.checklist_log('checklist.delete', p_template, jsonb_build_object('name', v_name));
end;
$$;
revoke all on function public.delete_checklist(uuid) from public, anon;
grant execute on function public.delete_checklist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Its sections, groups and items
-- ---------------------------------------------------------------------------

-- Add (no id) or change a section: its name, short name and area, if it has one.
create function public.save_checklist_section(
  p_template uuid, p_id uuid, p_name text, p_short_name text, p_area public.area
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_section uuid;
begin
  if exists (select 1 from public.walkthrough_sections
             where template_id = v_id and lower(btrim(name)) = lower(btrim(p_name))
               and id is distinct from public.checklist_section(v_id, p_id)) then
    raise exception 'this checklist has a section by that name' using errcode = '23505';
  end if;
  if p_id is null then
    insert into public.walkthrough_sections (template_id, name, short_name, area, sort_order)
    values (v_id, btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_short_name, '')), ''), p_area,
            coalesce((select max(sort_order) + 1 from public.walkthrough_sections where template_id = v_id), 1))
    returning id into v_section;
  else
    v_section := public.checklist_section(v_id, p_id);
    if v_section is null then
      raise exception 'that section is not on this checklist' using errcode = '22023';
    end if;
    update public.walkthrough_sections
    set name = btrim(coalesce(p_name, '')), short_name = nullif(btrim(coalesce(p_short_name, '')), ''), area = p_area
    where id = v_section;
  end if;
  perform public.checklist_log('checklist.section', v_id, jsonb_build_object('section', v_section, 'name', btrim(p_name)));
  return v_id;
end;
$$;
revoke all on function public.save_checklist_section(uuid, uuid, text, text, public.area) from public, anon;
grant execute on function public.save_checklist_section(uuid, uuid, text, text, public.area) to authenticated;

-- Add (no id) or change an item: its section and group, title, directions, how-to video
-- link and category. A new item goes at the end of its group.
create function public.save_checklist_item(
  p_template uuid, p_id uuid, p_section uuid, p_group text, p_title text, p_directions text,
  p_video_url text, p_category uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_section uuid := public.checklist_section(v_id, p_section);
  v_group text := btrim(coalesce(p_group, ''));
  v_item uuid;
begin
  if v_section is null then
    raise exception 'that section is not on this checklist' using errcode = '22023';
  end if;
  if p_category is not null and not exists (select 1 from public.categories where id = p_category) then
    raise exception 'no such category' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.walkthrough_items (section_id, group_name, title, directions, video_url, category_id, sort_order)
    values (v_section, v_group, btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_directions, '')), ''),
            nullif(btrim(coalesce(p_video_url, '')), ''), p_category,
            coalesce((select max(sort_order) + 1 from public.walkthrough_items where section_id = v_section), 1))
    returning id into v_item;
  else
    v_item := public.checklist_item(v_id, p_id);
    if v_item is null then
      raise exception 'that item is not on this checklist' using errcode = '22023';
    end if;
    update public.walkthrough_items
    set section_id = v_section, group_name = v_group, title = btrim(coalesce(p_title, '')),
        directions = nullif(btrim(coalesce(p_directions, '')), ''), video_url = nullif(btrim(coalesce(p_video_url, '')), ''),
        category_id = p_category
    where id = v_item;
  end if;
  perform public.checklist_log('checklist.item', v_id, jsonb_build_object('item', v_item, 'title', btrim(p_title)));
  return v_id;
end;
$$;
revoke all on function public.save_checklist_item(uuid, uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.save_checklist_item(uuid, uuid, uuid, text, text, text, text, uuid) to authenticated;

-- Rename a group: every item in the section with that group name.
create function public.rename_checklist_group(p_template uuid, p_section uuid, p_from text, p_to text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_section uuid := public.checklist_section(v_id, p_section);
begin
  if v_section is null then
    raise exception 'that section is not on this checklist' using errcode = '22023';
  end if;
  update public.walkthrough_items set group_name = btrim(coalesce(p_to, ''))
  where section_id = v_section and group_name = p_from;
  if not found then
    raise exception 'no such group in that section' using errcode = '22023';
  end if;
  perform public.checklist_log('checklist.group', v_id, jsonb_build_object('from', p_from, 'to', btrim(p_to)));
  return v_id;
end;
$$;
revoke all on function public.rename_checklist_group(uuid, uuid, text, text) from public, anon;
grant execute on function public.rename_checklist_group(uuid, uuid, text, text) to authenticated;

-- Turn a section or item off or on. Off, it goes on no new walkthrough.
create function public.set_checklist_part_active(p_template uuid, p_kind text, p_id uuid, p_active boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_part uuid;
begin
  if p_active is null then
    raise exception 'say on or off' using errcode = '22023';
  end if;
  if p_kind = 'section' then
    v_part := public.checklist_section(v_id, p_id);
    update public.walkthrough_sections set active = p_active where id = v_part;
  elsif p_kind = 'item' then
    v_part := public.checklist_item(v_id, p_id);
    update public.walkthrough_items set active = p_active where id = v_part;
  end if;
  if v_part is null then
    raise exception 'that is not on this checklist' using errcode = '22023';
  end if;
  perform public.checklist_log(case when p_active then 'checklist.turn_on' else 'checklist.turn_off' end, v_id,
    jsonb_build_object(p_kind, v_part));
  return v_id;
end;
$$;
revoke all on function public.set_checklist_part_active(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.set_checklist_part_active(uuid, text, uuid, boolean) to authenticated;

-- Delete a section or item only while it has no history: added since the last month opened,
-- so no walkthrough has had it or the part it was copied from. A section goes only with
-- items that have none either.
create function public.delete_checklist_part(p_template uuid, p_kind text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_part uuid;
begin
  if p_kind = 'section' then
    v_part := public.checklist_section(v_id, p_id);
    if v_part is null then
      raise exception 'that is not on this checklist' using errcode = '22023';
    end if;
    if exists (select 1 from public.walkthrough_sections where id = v_part and copied_from is not null)
       or exists (select 1 from public.walkthrough_items where section_id = v_part and copied_from is not null) then
      raise exception 'a walkthrough has had this section; turn it off instead' using errcode = '23503';
    end if;
    delete from public.walkthrough_sections where id = v_part;
  elsif p_kind = 'item' then
    v_part := public.checklist_item(v_id, p_id);
    if v_part is null then
      raise exception 'that is not on this checklist' using errcode = '22023';
    end if;
    if exists (select 1 from public.walkthrough_items where id = v_part and copied_from is not null) then
      raise exception 'a walkthrough has had this item; turn it off instead' using errcode = '23503';
    end if;
    delete from public.walkthrough_items where id = v_part;
  else
    raise exception 'a section or an item' using errcode = '22023';
  end if;
  perform public.checklist_log('checklist.delete_part', v_id, jsonb_build_object(p_kind, v_part));
  return v_id;
end;
$$;
revoke all on function public.delete_checklist_part(uuid, text, uuid) from public, anon;
grant execute on function public.delete_checklist_part(uuid, text, uuid) to authenticated;

-- Put the sections in order (no section), or a section's items (the app sends them group
-- by group, so the groups' order follows). The ids are all of them, in their new order.
create function public.order_checklist(p_template uuid, p_section uuid, p_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  v_section uuid;
  v_mapped uuid[];
  v_all uuid[];
begin
  if p_section is null then
    select array_agg(public.checklist_section(v_id, x) order by n) into v_mapped
    from unnest(p_ids) with ordinality as u (x, n);
    select array_agg(id) into v_all from public.walkthrough_sections where template_id = v_id;
  else
    v_section := public.checklist_section(v_id, p_section);
    select array_agg(public.checklist_item(v_id, x) order by n) into v_mapped
    from unnest(p_ids) with ordinality as u (x, n);
    select array_agg(id) into v_all from public.walkthrough_items where section_id = v_section;
  end if;
  if v_mapped is null or array_position(v_mapped, null) is not null
     or cardinality(v_mapped) <> coalesce(cardinality(v_all), 0)
     or not (v_mapped @> v_all and v_all @> v_mapped) then
    raise exception 'list every one of them, once' using errcode = '22023';
  end if;
  if p_section is null then
    update public.walkthrough_sections s set sort_order = u.n
    from unnest(v_mapped) with ordinality as u (id, n) where s.id = u.id;
  else
    update public.walkthrough_items i set sort_order = u.n
    from unnest(v_mapped) with ordinality as u (id, n) where i.id = u.id;
  end if;
  perform public.checklist_log('checklist.order', v_id, jsonb_build_object('section', v_section));
  return v_id;
end;
$$;
revoke all on function public.order_checklist(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.order_checklist(uuid, uuid, uuid[]) to authenticated;

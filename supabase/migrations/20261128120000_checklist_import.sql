-- Import a checklist from a spreadsheet (OT-137, 6b): the rows the app read from the file
-- replace the checklist's sections and items in one logged step. Like every editor change
-- (OT-136) it goes through checklist_for_change, so a checklist a walkthrough has had gets a
-- new version and every walkthrough so far keeps its own.
--
-- Each row is {section, section_short, area, group, title, directions, video_url,
-- category_id}, in the order the file has them. A section is matched by name, and an item
-- by its section, group and title, ignoring case: a matched one is changed in place (and
-- turned back on), the rest are added, and what the file leaves out is deleted if it has no
-- history, else turned off, as the editor does. Sections and items take the file's order.

create function public.import_checklist(p_template uuid, p_rows jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.checklist_for_change(p_template);
  r record;
  v_section uuid;
  v_item uuid;
  v_sections uuid[] := '{}'::uuid[];
  v_items uuid[] := '{}'::uuid[];
  v_added int := 0;
  v_changed int := 0;
  v_off int := 0;
  v_deleted int := 0;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then
    raise exception 'a checklist has 1 to 1000 items' using errcode = '22023';
  end if;

  for r in
    select n,
           btrim(coalesce(x ->> 'section', '')) as section,
           nullif(btrim(coalesce(x ->> 'section_short', '')), '') as section_short,
           nullif(x ->> 'area', '')::public.area as area,
           btrim(coalesce(x ->> 'group', '')) as grp,
           btrim(coalesce(x ->> 'title', '')) as title,
           nullif(btrim(coalesce(x ->> 'directions', '')), '') as directions,
           nullif(btrim(coalesce(x ->> 'video_url', '')), '') as video_url,
           nullif(x ->> 'category_id', '')::uuid as category_id
    from jsonb_array_elements(p_rows) with ordinality as e (x, n)
    order by n
  loop
    if r.category_id is not null and not exists (select 1 from public.categories where id = r.category_id) then
      raise exception 'row %: no such category', r.n using errcode = '22023';
    end if;

    -- The section: the one by that name, else a new one; it takes its first row's details.
    select id into v_section from public.walkthrough_sections
    where template_id = v_id and lower(name) = lower(r.section);
    if v_section is null then
      insert into public.walkthrough_sections (template_id, name, short_name, area, sort_order)
      values (v_id, r.section, r.section_short, r.area, cardinality(v_sections) + 1)
      returning id into v_section;
    end if;
    if not v_section = any (v_sections) then
      v_sections := v_sections || v_section;
      update public.walkthrough_sections
      set short_name = r.section_short, area = r.area, sort_order = cardinality(v_sections), active = true
      where id = v_section;
    end if;

    -- The item: the one by that group and title in the section, else a new one.
    select i.id into v_item from public.walkthrough_items i
    where i.section_id = v_section and lower(i.group_name) = lower(r.grp) and lower(i.title) = lower(r.title)
      and not i.id = any (v_items)
    order by i.sort_order limit 1;
    if v_item is null then
      insert into public.walkthrough_items (section_id, group_name, title, directions, video_url, category_id, sort_order)
      values (v_section, r.grp, r.title, r.directions, r.video_url, r.category_id, r.n)
      returning id into v_item;
      v_added := v_added + 1;
    else
      if exists (select 1 from public.walkthrough_items where id = v_item
                 and (group_name, title, directions, video_url, category_id, active)
                     is distinct from (r.grp, r.title, r.directions, r.video_url, r.category_id, true)) then
        v_changed := v_changed + 1;
      end if;
      update public.walkthrough_items
      set group_name = r.grp, title = r.title, directions = r.directions, video_url = r.video_url,
          category_id = r.category_id, sort_order = r.n, active = true
      where id = v_item;
    end if;
    v_items := v_items || v_item;
  end loop;

  -- What the file leaves out: deleted with no history, else turned off.
  with gone as (
    delete from public.walkthrough_items i using public.walkthrough_sections s
    where s.id = i.section_id and s.template_id = v_id and not i.id = any (v_items) and i.copied_from is null
    returning 1
  ) select count(*) into v_deleted from gone;
  with off as (
    update public.walkthrough_items i set active = false
    from public.walkthrough_sections s
    where s.id = i.section_id and s.template_id = v_id and not i.id = any (v_items) and i.active
    returning 1
  ) select count(*) into v_off from off;
  delete from public.walkthrough_sections s
  where s.template_id = v_id and not s.id = any (v_sections) and s.copied_from is null
    and not exists (select 1 from public.walkthrough_items i where i.section_id = s.id);
  update public.walkthrough_sections set active = false
  where template_id = v_id and not id = any (v_sections);

  perform public.checklist_log('checklist.import', v_id, jsonb_build_object(
    'rows', jsonb_array_length(p_rows), 'added', v_added, 'changed', v_changed,
    'turned_off', v_off, 'deleted', v_deleted));
  return v_id;
end;
$$;
revoke all on function public.import_checklist(uuid, jsonb) from public, anon;
grant execute on function public.import_checklist(uuid, jsonb) to authenticated;

-- Undo an import, the confirm step (OT-153): what undo_import (OT-149) would do now, without
-- doing it, so the sheet can say what it takes back and what it keeps before anyone taps
-- Undo. The same checks and the same rules as undo_import, read only:
--   remove   how many of the rows it added would be deleted (nothing points to them yet);
--   keep     the names of those it added that have gained history since, which stay;
--   restore  how many it updated, whose file columns go back to what they were;
--   until    when the 24 hours run out.
-- Definer, as undo_import is, so the answer doesn't depend on what the caller reads
-- (a visit's cost, say); it says only whether something points to a row.

create or replace function public.undo_import_preview(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  i public.imports;
  v_remove integer := 0;
  v_keep text[] := '{}'::text[];
  v_id uuid;
  v_name text;
  v_kept boolean;
begin
  select * into i from public.imports where id = p_id;
  if i.id is null or public.my_role() is null then
    raise exception 'no such import' using errcode = 'P0002';
  end if;
  if not (i.created_by = auth.uid() or public.is_admin()) then
    raise exception 'only whoever ran an import, or an admin, can undo it' using errcode = '42501';
  end if;
  if i.kind = 'contractors' and not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can undo a contractor import' using errcode = '42501';
  end if;
  if i.undone_at is not null then
    raise exception 'this import was already undone' using errcode = '55000';
  end if;
  if i.created_at < now() - interval '24 hours' then
    raise exception 'an import can be undone only within 24 hours' using errcode = '55000';
  end if;

  foreach v_id in array i.added loop
    if i.kind = 'contractors' then
      select c.name, exists (select 1 from public.service_records s where s.contractor_id = c.id)
      into v_name, v_kept
      from public.contractors c where c.id = v_id;
    else
      select e.name,
             exists (select 1 from public.tickets t where t.equipment_id = e.id)
             or exists (select 1 from public.service_records s where s.equipment_id = e.id)
             or exists (select 1 from public.inhouse_fixes f where f.equipment_id = e.id)
             or e.manual_path is not null or e.plate_photo_path is not null
      into v_name, v_kept
      from public.equipment e where e.id = v_id;
    end if;
    continue when v_name is null;
    if v_kept then
      v_keep := v_keep || v_name;
    else
      v_remove := v_remove + 1;
    end if;
    v_name := null;
  end loop;

  return jsonb_build_object(
    'remove', v_remove,
    'keep', to_jsonb(v_keep),
    'restore', jsonb_array_length(i.updated),
    'until', i.created_at + interval '24 hours'
  );
end;
$$;

revoke all on function public.undo_import_preview(uuid) from public, anon;
grant execute on function public.undo_import_preview(uuid) to authenticated;

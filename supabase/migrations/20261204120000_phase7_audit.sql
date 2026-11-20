-- Security and code quality pass over Phase 7 (OT-154). The imports (OT-149, OT-153) are the
-- new ways to write, so most of this is about them.
--
-- 1. imports could be read across restaurant scope. imports_select let any Ops manager with
--    Add / edit equipment at some restaurant read every equipment import, and each row's
--    "updated" holds the units' values from before the import (name, serial, brand, model),
--    at restaurants equipment_select would hide from them. Contractors' imports went to anyone
--    who looks after contractors, which was harmless but more than the app needs. Now an
--    import is read by whoever ran it and by admins, which is all the app asks for
--    (useUndoableImport reads the person's own).
-- 2. A malformed value stopped an import without saying which row. A restaurant or category
--    id that isn't one, a row number that isn't a number, a row that isn't an object, or
--    trades that aren't a list raised a bare cast error. Each now says "row N: …", and a
--    row number that can't be read is the row's place in the file.
-- 3. A new trade's name over 60 characters failed with no row, since every new trade was
--    added before any row was read. New trades are now added when a row that is written
--    names one, so the name is checked with that row's number. That also means a new trade
--    that no imported row uses (every row naming it skipped, say) is no longer added.
-- 4. Undo wrote over edits made since the import. undo_import put back the "before" values
--    of every file column, so a phone fixed by hand after the import went back to the old
--    one. Each update now keeps the values it wrote ("after"), and undo puts back a column
--    only while it still holds what the import wrote; anything edited since stays. An
--    import kept before this (no "after") is undone as before. Its count of restored rows,
--    and the preview's, now counts only rows where something goes back.
-- 5. Undo and its preview said whether an import id existed: someone who isn't its creator
--    or an admin got 42501, a made-up id P0002. Both now answer "no such import" (P0002).
-- 6. The audit log kept the whole file name the client sent; the imports row kept 200
--    characters. The log keeps the same 200 now.
--
-- Checked and kept (see 67_phase7_audit.test.sql):
--   * A unit moved to another restaurant since its import can be undone only by someone who
--     can edit equipment there: undo checks each unit where it is now.
--   * v_overview_by_month shows spend only with See costs, through the service record
--     policies it reads (security_invoker), and leadership writes nothing (64_leadership).
--   * Internal notes are read only by the Ops role and their author (ticket_updates_select),
--     and neither leadership nor the Admin role holds Update status.

-- 1 ---------------------------------------------------------------------------------------

drop policy imports_select on public.imports;
create policy imports_select on public.imports
  for select to authenticated
  using (public.my_role() is not null and (created_by = auth.uid() or public.is_admin()));

-- Helpers ---------------------------------------------------------------------------------

-- A row's number as the sheet shows it, or its place in the file when that can't be read.
-- Internal.
create or replace function public.import_row_number(p_row jsonb, p_place bigint)
returns integer
language sql
immutable
set search_path = public
as $$
  select case when coalesce(p_row ->> 'row', '') ~ '^[0-9]{1,7}$' then (p_row ->> 'row')::int else p_place::int end;
$$;

revoke all on function public.import_row_number(jsonb, bigint) from public, anon, authenticated;

-- An id cell: null when empty, the id when it is one, and an error naming the row otherwise.
-- Internal.
create or replace function public.import_id(p_row jsonb, p_key text, p_n integer, p_what text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := public.import_cell(p_row, p_key);
begin
  if v is null then
    return null;
  end if;
  if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'row %: choose a % from the list', p_n, p_what using errcode = '22023';
  end if;
  return v::uuid;
end;
$$;

revoke all on function public.import_id(jsonb, text, integer, text) from public, anon, authenticated;

-- A row as the import and undo compare it: its own columns, and a contractor's trades as a
-- sorted list of ids. Null when it is gone. Internal.
create or replace function public.import_current(p_kind text, p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case p_kind
    when 'contractors' then (
      select to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by' - 'archived_at'
             || jsonb_build_object('trade_ids', to_jsonb(array(
                  select ct.trade_id from public.contractor_trades ct
                  where ct.contractor_id = c.id order by ct.trade_id)))
      from public.contractors c where c.id = p_id)
    else (
      select to_jsonb(e) - 'created_at' - 'updated_at' - 'created_by' - 'retired_at' - 'retired_by'
             - 'manual_path' - 'plate_photo_path'
      from public.equipment e where e.id = p_id)
  end;
$$;

revoke all on function public.import_current(text, uuid) from public, anon, authenticated;

-- Whether undo puts a file column back: it was in the file, and it still holds what the
-- import wrote. An import kept before OT-154 has no "after", so its columns all go back.
-- A contractor's trades column compares trade_ids. Internal.
create or replace function public.import_put_back(p_col text, p_columns text[], p_after jsonb, p_current jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_col = any (p_columns)
     and (p_after is null
          or (p_current -> case when p_col = 'trades' then 'trade_ids' else p_col end)
             is not distinct from (p_after -> case when p_col = 'trades' then 'trade_ids' else p_col end));
$$;

revoke all on function public.import_put_back(text, text[], jsonb, jsonb) from public, anon, authenticated;

-- Contractors (2, 3, 4, 6) ----------------------------------------------------------------

create or replace function public.import_contractors(
  p_rows jsonb,
  p_columns text[],
  p_new_trades text[] default '{}',
  p_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_columns text[] := array(select distinct col from unnest(p_columns) col);
  v_may_add text[] := array(select lower(btrim(x)) from unnest(coalesce(p_new_trades, '{}')) x where btrim(x) <> '');
  v_file text := left(nullif(btrim(p_file_name), ''), 200);
  v_new_trades uuid[] := '{}'::uuid[];
  v_added uuid[] := '{}'::uuid[];
  v_updated jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  v_seen text[] := '{}'::text[];
  v_import uuid;
  v_name text;
  v_trade_id uuid;
  r record;
  t text;
  c public.contractors;
  v_before jsonb;
  v_trades uuid[];
  v_id uuid;
  v_email text;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can import contractors' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'an import has 1 to 2,000 rows' using errcode = '22023';
  end if;
  if not ('name' = any (v_columns))
     or exists (select 1 from unnest(v_columns) col
                where col not in ('name', 'trades', 'contact_name', 'phone', 'email', 'preferred', 'insurance_until', 'notes')) then
    raise exception 'the columns are name, trades, contact_name, phone, email, preferred, insurance_until and notes, with name'
      using errcode = '22023';
  end if;

  for r in
    select x, public.import_row_number(x, n) as n
    from jsonb_array_elements(p_rows) with ordinality as e (x, n)
  loop
    if jsonb_typeof(r.x) is distinct from 'object' then
      raise exception 'row %: a row is a set of named cells', r.n using errcode = '22023';
    end if;
    v_name := public.import_cell(r.x, 'name');
    if v_name is null then
      raise exception 'row %: a contractor needs a name', r.n using errcode = '22023';
    end if;
    if public.import_key(v_name) = any (v_seen) then
      raise exception 'row %: % is in the file twice', r.n, v_name using errcode = '22023';
    end if;
    v_seen := v_seen || public.import_key(v_name);

    select * into c from public.contractors
    where archived_at is null and public.import_key(name) = public.import_key(v_name)
    for update;

    -- A duplicate that isn't to be updated writes nothing, so nothing else on it is checked.
    if c.id is not null and coalesce(r.x ->> 'on_duplicate', 'skip') <> 'update' then
      v_skipped := v_skipped + 1;
      c := null;
      continue;
    end if;

    -- The trades, by name, ignoring case. One the file adds is added now, for this row.
    if jsonb_typeof(coalesce(r.x -> 'trades', '[]'::jsonb)) <> 'array' then
      raise exception 'row %: trades are a list of names', r.n using errcode = '22023';
    end if;
    v_trades := '{}'::uuid[];
    for t in select btrim(value) from jsonb_array_elements_text(coalesce(r.x -> 'trades', '[]'::jsonb)) where btrim(value) <> '' loop
      select id into v_trade_id from public.trades where lower(btrim(name)) = lower(t);
      if v_trade_id is null then
        if not (lower(t) = any (v_may_add)) then
          raise exception 'row %: there is no trade called %', r.n, t using errcode = '22023';
        end if;
        if char_length(t) > 60 then
          raise exception 'row %: a trade''s name is at most 60 characters', r.n using errcode = '22023';
        end if;
        v_trade_id := public.add_trade(t);
        v_new_trades := v_new_trades || v_trade_id;
      end if;
      if not (v_trade_id = any (v_trades)) then
        v_trades := v_trades || v_trade_id;
      end if;
    end loop;

    v_email := public.import_cell(r.x, 'email');
    if v_email is not null and v_email !~ '^[A-Za-z0-9._+''-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then
      raise exception 'row %: % is not an email address', r.n, v_email using errcode = '22023';
    end if;

    begin
      if c.id is not null then
        if exists (
          select 1 from public.trades tr
          where tr.id = any (v_trades) and not tr.active
            and not exists (select 1 from public.contractor_trades ct where ct.contractor_id = c.id and ct.trade_id = tr.id)
        ) then
          raise exception 'row %: a trade it names is turned off', r.n using errcode = '23514';
        end if;

        v_before := public.import_current('contractors', c.id);

        update public.contractors
        set contact_name = coalesce(case when 'contact_name' = any (v_columns) then public.import_cell(r.x, 'contact_name') end, contact_name),
            phone = coalesce(case when 'phone' = any (v_columns) then public.import_cell(r.x, 'phone') end, phone),
            email = coalesce(case when 'email' = any (v_columns) then v_email end, email),
            preferred = coalesce(case when 'preferred' = any (v_columns) then (r.x ->> 'preferred')::boolean end, preferred),
            insurance_until = coalesce(case when 'insurance_until' = any (v_columns)
                                            then public.import_cell(r.x, 'insurance_until')::date end, insurance_until),
            notes = coalesce(case when 'notes' = any (v_columns) then public.import_cell(r.x, 'notes') end, notes)
        where id = c.id;

        if 'trades' = any (v_columns) and cardinality(v_trades) > 0 then
          delete from public.contractor_trades where contractor_id = c.id and not (trade_id = any (v_trades));
          insert into public.contractor_trades (contractor_id, trade_id)
          select c.id, x from unnest(v_trades) x
          on conflict do nothing;
        end if;

        v_updated := v_updated || jsonb_build_object(
          'id', c.id, 'before', v_before, 'after', public.import_current('contractors', c.id));
      else
        if cardinality(v_trades) = 0 then
          raise exception 'row %: % needs a trade', r.n, v_name using errcode = '22023';
        end if;
        if public.import_cell(r.x, 'contact_name') is null then
          raise exception 'row %: % needs a contact', r.n, v_name using errcode = '22023';
        end if;
        if public.import_cell(r.x, 'phone') is null then
          raise exception 'row %: % needs a phone number', r.n, v_name using errcode = '22023';
        end if;
        if exists (select 1 from public.trades tr where tr.id = any (v_trades) and not tr.active) then
          raise exception 'row %: a trade it names is turned off', r.n using errcode = '23514';
        end if;

        insert into public.contractors
          (name, contact_name, phone, email, preferred, insurance_until, notes, created_by)
        values (v_name, public.import_cell(r.x, 'contact_name'), public.import_cell(r.x, 'phone'), v_email,
                coalesce((r.x ->> 'preferred')::boolean, false),
                public.import_cell(r.x, 'insurance_until')::date,
                public.import_cell(r.x, 'notes'), auth.uid())
        returning id into v_id;

        insert into public.contractor_trades (contractor_id, trade_id)
        select v_id, x from unnest(v_trades) x;
        v_added := v_added || v_id;
      end if;
    exception
      when check_violation or invalid_datetime_format or datetime_field_overflow
        or invalid_text_representation or string_data_right_truncation then
        raise exception 'row %: %', r.n, sqlerrm using errcode = '22023';
    end;
    c := null;
  end loop;

  insert into public.imports (kind, file_name, columns, added, updated, new_trades, skipped, created_by)
  values ('contractors', v_file, v_columns, v_added, v_updated, v_new_trades, v_skipped, auth.uid())
  returning id into v_import;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'import.contractors',
          jsonb_build_object('import_id', v_import, 'file_name', v_file, 'added', cardinality(v_added),
                             'updated', jsonb_array_length(v_updated), 'skipped', v_skipped,
                             'new_trades', cardinality(v_new_trades)));

  return jsonb_build_object('import_id', v_import, 'added', cardinality(v_added),
                            'updated', jsonb_array_length(v_updated), 'skipped', v_skipped,
                            'new_trades', cardinality(v_new_trades));
end;
$$;

revoke all on function public.import_contractors(jsonb, text[], text[], text) from public, anon;
grant execute on function public.import_contractors(jsonb, text[], text[], text) to authenticated;

-- Equipment (2, 4, 6) ---------------------------------------------------------------------

create or replace function public.import_equipment(
  p_restaurant_id uuid,
  p_rows jsonb,
  p_columns text[],
  p_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_columns text[] := array(select distinct col from unnest(p_columns) col);
  v_file text := left(nullif(btrim(p_file_name), ''), 200);
  v_added uuid[] := '{}'::uuid[];
  v_updated jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  v_seen text[] := '{}'::text[];
  v_import uuid;
  v_name text;
  v_serial text;
  v_restaurant uuid;
  v_category uuid;
  v_rname text;
  v_before jsonb;
  v_id uuid;
  r record;
  e public.equipment;
begin
  if public.my_role() is null then
    raise exception 'sign in to import equipment' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'an import has 1 to 2,000 rows' using errcode = '22023';
  end if;
  if not ('name' = any (v_columns))
     or exists (select 1 from unnest(v_columns) col
                where col not in ('name', 'category_id', 'brand', 'model', 'serial', 'location_note',
                                'installed_on', 'warranty_note', 'warranty_until')) then
    raise exception 'the columns are name, category_id, brand, model, serial, location_note, installed_on, warranty_note and warranty_until, with name'
      using errcode = '22023';
  end if;
  if p_restaurant_id is not null and not public.can('edit_equipment', p_restaurant_id) then
    raise exception 'you can''t add equipment at this restaurant' using errcode = '42501';
  end if;

  for r in
    select x, public.import_row_number(x, n) as n
    from jsonb_array_elements(p_rows) with ordinality as el (x, n)
  loop
    if jsonb_typeof(r.x) is distinct from 'object' then
      raise exception 'row %: a row is a set of named cells', r.n using errcode = '22023';
    end if;
    v_restaurant := coalesce(p_restaurant_id, public.import_id(r.x, 'restaurant_id', r.n, 'restaurant'));
    v_rname := null;
    select name into v_rname from public.restaurants where id = v_restaurant;
    if v_rname is null then
      raise exception 'row %: choose a restaurant', r.n using errcode = '22023';
    end if;
    if exists (select 1 from public.restaurants where id = v_restaurant and archived_at is not null) then
      raise exception 'row %: % is archived', r.n, v_rname using errcode = '42501';
    end if;
    if not public.can('edit_equipment', v_restaurant) then
      raise exception 'row %: you can''t add or edit equipment at %', r.n, v_rname using errcode = '42501';
    end if;

    v_name := public.import_cell(r.x, 'name');
    if v_name is null then
      raise exception 'row %: a unit needs a name', r.n using errcode = '22023';
    end if;
    v_serial := public.import_cell(r.x, 'serial');
    if (v_restaurant::text || '/n/' || public.import_key(v_name)) = any (v_seen)
       or (v_serial is not null and (v_restaurant::text || '/s/' || public.import_key(v_serial)) = any (v_seen)) then
      raise exception 'row %: % is in the file twice', r.n, v_name using errcode = '22023';
    end if;
    v_seen := v_seen || (v_restaurant::text || '/n/' || public.import_key(v_name));
    if v_serial is not null then
      v_seen := v_seen || (v_restaurant::text || '/s/' || public.import_key(v_serial));
    end if;

    v_category := public.import_id(r.x, 'category_id', r.n, 'category');
    if v_category is not null and not exists (select 1 from public.categories where id = v_category) then
      raise exception 'row %: choose a category from the list', r.n using errcode = '22023';
    end if;

    -- The same name, or the same serial when both have one, at the same restaurant.
    select * into e from public.equipment
    where restaurant_id = v_restaurant and retired_at is null
      and (public.import_key(name) = public.import_key(v_name)
           or (v_serial is not null and serial is not null and public.import_key(serial) = public.import_key(v_serial)))
    order by (public.import_key(name) = public.import_key(v_name)) desc
    limit 1
    for update;

    begin
      if e.id is not null then
        if coalesce(r.x ->> 'on_duplicate', 'skip') <> 'update' then
          v_skipped := v_skipped + 1;
          e := null;
          continue;
        end if;

        v_before := public.import_current('equipment', e.id);

        update public.equipment
        set name = case when 'name' = any (v_columns) then v_name else name end,
            category_id = coalesce(case when 'category_id' = any (v_columns) then v_category end, category_id),
            brand = coalesce(case when 'brand' = any (v_columns) then public.import_cell(r.x, 'brand') end, brand),
            model = coalesce(case when 'model' = any (v_columns) then public.import_cell(r.x, 'model') end, model),
            serial = coalesce(case when 'serial' = any (v_columns) then v_serial end, serial),
            location_note = coalesce(case when 'location_note' = any (v_columns) then public.import_cell(r.x, 'location_note') end, location_note),
            installed_on = coalesce(case when 'installed_on' = any (v_columns)
                                         then public.import_cell(r.x, 'installed_on')::date end, installed_on),
            warranty_note = coalesce(case when 'warranty_note' = any (v_columns) then public.import_cell(r.x, 'warranty_note') end, warranty_note),
            warranty_until = coalesce(case when 'warranty_until' = any (v_columns)
                                           then public.import_cell(r.x, 'warranty_until')::date end, warranty_until)
        where id = e.id;

        v_updated := v_updated || jsonb_build_object(
          'id', e.id, 'before', v_before, 'after', public.import_current('equipment', e.id));
      else
        if v_category is null then
          raise exception 'row %: % needs a category', r.n, v_name using errcode = '22023';
        end if;

        insert into public.equipment
          (restaurant_id, category_id, name, brand, model, serial, location_note, installed_on,
           warranty_note, warranty_until)
        values (v_restaurant, v_category, v_name, public.import_cell(r.x, 'brand'), public.import_cell(r.x, 'model'),
                v_serial, public.import_cell(r.x, 'location_note'), public.import_cell(r.x, 'installed_on')::date,
                public.import_cell(r.x, 'warranty_note'), public.import_cell(r.x, 'warranty_until')::date)
        returning id into v_id;
        v_added := v_added || v_id;
      end if;
    exception
      when check_violation or invalid_datetime_format or datetime_field_overflow
        or invalid_text_representation or string_data_right_truncation then
        raise exception 'row %: %', r.n, sqlerrm using errcode = '22023';
    end;
    e := null;
  end loop;

  insert into public.imports (kind, restaurant_id, file_name, columns, added, updated, skipped, created_by)
  values ('equipment', p_restaurant_id, v_file, v_columns, v_added, v_updated, v_skipped, auth.uid())
  returning id into v_import;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'import.equipment', p_restaurant_id,
          jsonb_build_object('import_id', v_import, 'file_name', v_file, 'added', cardinality(v_added),
                             'updated', jsonb_array_length(v_updated), 'skipped', v_skipped));

  return jsonb_build_object('import_id', v_import, 'added', cardinality(v_added),
                            'updated', jsonb_array_length(v_updated), 'skipped', v_skipped);
end;
$$;

revoke all on function public.import_equipment(uuid, jsonb, text[], text) from public, anon;
grant execute on function public.import_equipment(uuid, jsonb, text[], text) to authenticated;

-- Undo (4, 5) -----------------------------------------------------------------------------

-- The checks undo and its preview share: the import, for its creator or an admin (anyone
-- else is told there is no such import), holding the right, not undone, within 24 hours.
-- Internal; called only from the two definer functions below.
create or replace function public.import_for_undo(p_id uuid, p_lock boolean)
returns public.imports
language plpgsql
set search_path = public
as $$
declare
  i public.imports;
begin
  if p_lock then
    select * into i from public.imports where id = p_id for update;
  else
    select * into i from public.imports where id = p_id;
  end if;
  if i.id is null or public.my_role() is null or not (i.created_by = auth.uid() or public.is_admin()) then
    raise exception 'no such import' using errcode = 'P0002';
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
  return i;
end;
$$;

revoke all on function public.import_for_undo(uuid, boolean) from public, anon, authenticated;

-- How many of an import's updated rows still exist and have a column to put back.
-- Internal.
create or replace function public.import_restorable(p_kind text, p_updated jsonb, p_columns text[])
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from jsonb_array_elements(p_updated) u
  cross join lateral (select public.import_current(p_kind, (u ->> 'id')::uuid) as cur) c
  where c.cur is not null
    and exists (select 1 from unnest(p_columns) col
                where (col <> 'name' or p_kind = 'equipment')
                  and public.import_put_back(col, p_columns, u -> 'after', c.cur));
$$;

revoke all on function public.import_restorable(text, jsonb, text[]) from public, anon, authenticated;

create or replace function public.undo_import(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.imports;
  v_removed integer := 0;
  v_restored integer := 0;
  v_kept text[] := '{}'::text[];
  v_id uuid;
  u jsonb;
  b jsonb;
  a jsonb;
  cur jsonb;
  c public.contractors;
  e public.equipment;
  v_result jsonb;
begin
  i := public.import_for_undo(p_id, true);

  if i.kind = 'contractors' then
    foreach v_id in array i.added loop
      select * into c from public.contractors where id = v_id for update;
      continue when c.id is null;
      if exists (select 1 from public.service_records where contractor_id = v_id) then
        v_kept := v_kept || c.name;
      else
        delete from public.contractors where id = v_id;
        v_removed := v_removed + 1;
      end if;
    end loop;

    for u in select * from jsonb_array_elements(i.updated) loop
      b := u -> 'before';
      a := u -> 'after';
      select * into c from public.contractors where id = (u ->> 'id')::uuid for update;
      continue when c.id is null;
      cur := public.import_current('contractors', c.id);
      continue when not exists (select 1 from unnest(i.columns) col
                                where col <> 'name' and public.import_put_back(col, i.columns, a, cur));
      update public.contractors
      set contact_name = case when public.import_put_back('contact_name', i.columns, a, cur) then b ->> 'contact_name' else contact_name end,
          phone = case when public.import_put_back('phone', i.columns, a, cur) then b ->> 'phone' else phone end,
          email = case when public.import_put_back('email', i.columns, a, cur) then b ->> 'email' else email end,
          preferred = case when public.import_put_back('preferred', i.columns, a, cur) then (b ->> 'preferred')::boolean else preferred end,
          insurance_until = case when public.import_put_back('insurance_until', i.columns, a, cur) then (b ->> 'insurance_until')::date else insurance_until end,
          notes = case when public.import_put_back('notes', i.columns, a, cur) then b ->> 'notes' else notes end
      where id = c.id;
      if public.import_put_back('trades', i.columns, a, cur) then
        delete from public.contractor_trades where contractor_id = c.id;
        insert into public.contractor_trades (contractor_id, trade_id)
        select c.id, x::uuid from jsonb_array_elements_text(b -> 'trade_ids') x
        where exists (select 1 from public.trades t where t.id = x::uuid);
      end if;
      v_restored := v_restored + 1;
    end loop;

    foreach v_id in array i.new_trades loop
      if exists (select 1 from public.trades where id = v_id)
         and not exists (select 1 from public.contractor_trades where trade_id = v_id) then
        perform public.delete_trade(v_id);
      end if;
    end loop;
  else
    -- Every unit it touched must be at a restaurant the caller can still edit, where it is now.
    if exists (
      select 1 from public.equipment eq
      where (eq.id = any (i.added)
             or eq.id in (select (x ->> 'id')::uuid from jsonb_array_elements(i.updated) x))
        and not public.can('edit_equipment', eq.restaurant_id)
    ) then
      raise exception 'you can''t edit equipment at every restaurant this import touched' using errcode = '42501';
    end if;

    foreach v_id in array i.added loop
      select * into e from public.equipment where id = v_id for update;
      continue when e.id is null;
      if exists (select 1 from public.tickets where equipment_id = v_id)
         or exists (select 1 from public.service_records where equipment_id = v_id)
         or exists (select 1 from public.inhouse_fixes where equipment_id = v_id)
         or e.manual_path is not null or e.plate_photo_path is not null then
        v_kept := v_kept || e.name;
      else
        delete from public.equipment where id = v_id;
        v_removed := v_removed + 1;
      end if;
    end loop;

    for u in select * from jsonb_array_elements(i.updated) loop
      b := u -> 'before';
      a := u -> 'after';
      select * into e from public.equipment where id = (u ->> 'id')::uuid for update;
      continue when e.id is null;
      cur := public.import_current('equipment', e.id);
      continue when not exists (select 1 from unnest(i.columns) col where public.import_put_back(col, i.columns, a, cur));
      update public.equipment
      set name = case when public.import_put_back('name', i.columns, a, cur) then b ->> 'name' else name end,
          -- A category turned off since stays as the import left it.
          category_id = case when public.import_put_back('category_id', i.columns, a, cur)
                               and exists (select 1 from public.categories where id = (b ->> 'category_id')::uuid and active)
                             then (b ->> 'category_id')::uuid else category_id end,
          brand = case when public.import_put_back('brand', i.columns, a, cur) then b ->> 'brand' else brand end,
          model = case when public.import_put_back('model', i.columns, a, cur) then b ->> 'model' else model end,
          serial = case when public.import_put_back('serial', i.columns, a, cur) then b ->> 'serial' else serial end,
          location_note = case when public.import_put_back('location_note', i.columns, a, cur) then b ->> 'location_note' else location_note end,
          installed_on = case when public.import_put_back('installed_on', i.columns, a, cur) then (b ->> 'installed_on')::date else installed_on end,
          warranty_note = case when public.import_put_back('warranty_note', i.columns, a, cur) then b ->> 'warranty_note' else warranty_note end,
          warranty_until = case when public.import_put_back('warranty_until', i.columns, a, cur) then (b ->> 'warranty_until')::date else warranty_until end
      where id = e.id;
      v_restored := v_restored + 1;
    end loop;
  end if;

  v_result := jsonb_build_object('removed', v_removed, 'restored', v_restored, 'kept', to_jsonb(v_kept));
  update public.imports
  set undone_at = now(), undone_by = auth.uid(), undo_result = v_result
  where id = p_id;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'import.undo', i.restaurant_id,
          jsonb_build_object('import_id', p_id, 'kind', i.kind) || v_result);
  return v_result;
end;
$$;

revoke all on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;

-- No longer stable: it shares import_for_undo with undo_import, which locks. It writes nothing.
create or replace function public.undo_import_preview(p_id uuid)
returns jsonb
language plpgsql
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
  i := public.import_for_undo(p_id, false);

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
    'restore', public.import_restorable(i.kind, i.updated, i.columns),
    'until', i.created_at + interval '24 hours'
  );
end;
$$;

revoke all on function public.undo_import_preview(uuid) from public, anon;
grant execute on function public.undo_import_preview(uuid) to authenticated;

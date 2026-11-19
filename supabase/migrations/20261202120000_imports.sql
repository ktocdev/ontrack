-- Imports (OT-149, Phase 7): contractors and equipment from a spreadsheet.
--
-- The phone reads the file with lib/import/ and matches its values (OT-150), so only rows
-- reach the database, each with the spreadsheet row it came from. One function per import
-- checks the caller, adds and updates the rows and logs it, all in one step: a row that
-- fails stops the whole import with "row N: why", so nothing is half done. Each import
-- keeps an imports row with what it added and the values each update replaced, which
-- undo_import puts back within 24 hours by the archive and delete rule: it deletes what the
-- import added while nothing points to it yet, and keeps (and names) anything that has
-- gained history since.
--
-- Matching a duplicate (decided in the plan, Phase 7):
--   * a contractor already in OnTrack has the same name, ignoring case and spaces;
--   * a unit has the same name, or the same serial number when both have one, at the same
--     restaurant (a retired unit doesn't count, so it can be added again).
-- A row that matches is skipped unless it says on_duplicate = 'update'. Update existing
-- changes only the columns the file has (p_columns), and an empty cell leaves that value
-- as it is; it never touches visits, tickets or history. A contractor keeps its own
-- spelling of the name it was matched by; a unit matched by its serial takes the file's.
--
-- Who imports: contractors as save_contractor (Ops with Log cost, and admins); units with
-- Add / edit equipment at each row's restaurant, as the form. The same checks as the forms:
-- a contractor needs a name, a trade, a contact and a phone; a unit a name and an active
-- category; an email is an address; nothing new at an archived restaurant; a turned-off
-- trade or category goes on nothing new. An unknown trade can be added in the same step
-- (p_new_trades), through add_trade; an unknown category or restaurant can't.

create table public.imports (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,
  -- The one restaurant an equipment import was for; null for all, and for contractors.
  restaurant_id  uuid references public.restaurants (id) on delete set null,
  file_name      text,
  -- The file's columns, which updates changed and undo puts back.
  columns        text[] not null default '{}',
  added          uuid[] not null default '{}',
  -- [{id, before}] for each row that updated one already there.
  updated        jsonb not null default '[]'::jsonb,
  new_trades     uuid[] not null default '{}',
  skipped        integer not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  undone_at      timestamptz,
  undone_by      uuid references public.profiles (id) on delete set null,
  -- What undo removed, put back and kept.
  undo_result    jsonb,
  constraint imports_kind check (kind in ('contractors', 'equipment')),
  constraint imports_file_name_length check (file_name is null or char_length(file_name) <= 200)
);
create index imports_recent_idx on public.imports (kind, created_at desc);

-- Read by whoever ran it, by admins, and by those who run that kind of import; written only
-- by the functions below.
alter table public.imports enable row level security;
create policy imports_select on public.imports
  for select to authenticated
  using (
    public.my_role() is not null
    and (
      created_by = auth.uid()
      or public.is_admin()
      or (kind = 'contractors' and public.can_edit_contractors())
      or (kind = 'equipment' and public.my_role() = 'ops' and public.can('edit_equipment'))
    )
  );
grant select on public.imports to authenticated;

-- "Coldline  Refrigeration" and "coldline refrigeration" are one contractor. Internal.
create or replace function public.import_key(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(coalesce(p, ''), '\s+', '', 'g'));
$$;

revoke all on function public.import_key(text) from public, anon, authenticated;

-- A cell's text, or null when it is empty. Internal.
create or replace function public.import_cell(p_row jsonb, p_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(coalesce(p_row ->> p_key, '')), '');
$$;

revoke all on function public.import_cell(jsonb, text) from public, anon, authenticated;

-- Contractors ---------------------------------------------------------------------------

-- Each row is {row, name, trades: [names], contact_name, phone, email, preferred,
-- insurance_until (yyyy-mm-dd), notes, on_duplicate: 'skip' | 'update'}.
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
  v_trades uuid[];
  v_unknown text;
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

  -- New trades first, so the rows can name them. One already on the list is simply used.
  foreach t in array coalesce(p_new_trades, '{}') loop
    if btrim(t) <> '' and not public.trade_name_taken(t, null) then
      v_new_trades := v_new_trades || public.add_trade(t);
    end if;
  end loop;

  for r in
    select x, coalesce(nullif(x ->> 'row', '')::int, n::int) as n
    from jsonb_array_elements(p_rows) with ordinality as e (x, n)
  loop
    v_name := public.import_cell(r.x, 'name');
    if v_name is null then
      raise exception 'row %: a contractor needs a name', r.n using errcode = '22023';
    end if;
    if public.import_key(v_name) = any (v_seen) then
      raise exception 'row %: % is in the file twice', r.n, v_name using errcode = '22023';
    end if;
    v_seen := v_seen || public.import_key(v_name);

    -- The trades, by name, ignoring case.
    v_trades := '{}'::uuid[];
    for t in select btrim(value) from jsonb_array_elements_text(coalesce(r.x -> 'trades', '[]'::jsonb)) where btrim(value) <> '' loop
      select id into v_trade_id from public.trades where lower(btrim(name)) = lower(t);
      if v_trade_id is null then
        v_unknown := t;
        raise exception 'row %: there is no trade called %', r.n, v_unknown using errcode = '22023';
      end if;
      if not (v_trade_id = any (v_trades)) then
        v_trades := v_trades || v_trade_id;
      end if;
    end loop;

    v_email := public.import_cell(r.x, 'email');
    if v_email is not null and v_email !~ '^[A-Za-z0-9._+''-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then
      raise exception 'row %: % is not an email address', r.n, v_email using errcode = '22023';
    end if;

    select * into c from public.contractors
    where archived_at is null and public.import_key(name) = public.import_key(v_name)
    for update;

    begin
      if c.id is not null then
        if coalesce(r.x ->> 'on_duplicate', 'skip') <> 'update' then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        if exists (
          select 1 from public.trades tr
          where tr.id = any (v_trades) and not tr.active
            and not exists (select 1 from public.contractor_trades ct where ct.contractor_id = c.id and ct.trade_id = tr.id)
        ) then
          raise exception 'row %: a trade it names is turned off', r.n using errcode = '23514';
        end if;

        v_updated := v_updated || jsonb_build_object(
          'id', c.id,
          'before', to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by' - 'archived_at'
                    || jsonb_build_object('trade_ids', to_jsonb(array(
                         select trade_id from public.contractor_trades where contractor_id = c.id)))
        );

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
  values ('contractors', left(nullif(btrim(p_file_name), ''), 200), v_columns, v_added, v_updated,
          v_new_trades, v_skipped, auth.uid())
  returning id into v_import;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'import.contractors',
          jsonb_build_object('import_id', v_import, 'file_name', p_file_name, 'added', cardinality(v_added),
                             'updated', jsonb_array_length(v_updated), 'skipped', v_skipped,
                             'new_trades', cardinality(v_new_trades)));

  return jsonb_build_object('import_id', v_import, 'added', cardinality(v_added),
                            'updated', jsonb_array_length(v_updated), 'skipped', v_skipped,
                            'new_trades', cardinality(v_new_trades));
end;
$$;

revoke all on function public.import_contractors(jsonb, text[], text[], text) from public, anon;
grant execute on function public.import_contractors(jsonb, text[], text[], text) to authenticated;

-- Equipment -----------------------------------------------------------------------------

-- Each row is {row, restaurant_id (when no one restaurant was chosen), category_id, name,
-- brand, model, serial, location_note, installed_on, warranty_note, warranty_until
-- (dates yyyy-mm-dd), on_duplicate: 'skip' | 'update'}.
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
    select x, coalesce(nullif(x ->> 'row', '')::int, n::int) as n
    from jsonb_array_elements(p_rows) with ordinality as el (x, n)
  loop
    v_restaurant := coalesce(p_restaurant_id, nullif(r.x ->> 'restaurant_id', '')::uuid);
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

    v_category := nullif(r.x ->> 'category_id', '')::uuid;
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
          continue;
        end if;

        v_updated := v_updated || jsonb_build_object(
          'id', e.id,
          'before', to_jsonb(e) - 'created_at' - 'updated_at' - 'created_by' - 'retired_at' - 'retired_by'
                    - 'manual_path' - 'plate_photo_path'
        );

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
  values ('equipment', p_restaurant_id, left(nullif(btrim(p_file_name), ''), 200), v_columns, v_added,
          v_updated, v_skipped, auth.uid())
  returning id into v_import;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'import.equipment', p_restaurant_id,
          jsonb_build_object('import_id', v_import, 'file_name', p_file_name, 'added', cardinality(v_added),
                             'updated', jsonb_array_length(v_updated), 'skipped', v_skipped));

  return jsonb_build_object('import_id', v_import, 'added', cardinality(v_added),
                            'updated', jsonb_array_length(v_updated), 'skipped', v_skipped);
end;
$$;

revoke all on function public.import_equipment(uuid, jsonb, text[], text) from public, anon;
grant execute on function public.import_equipment(uuid, jsonb, text[], text) to authenticated;

-- Undo ----------------------------------------------------------------------------------

-- Within 24 hours, by whoever ran it or an admin, holding the same right as the import.
-- Deletes what it added while nothing points to it (a contractor with no visits; a unit
-- with no tickets, service records or in-house tasks, and no manual or photo added since), puts back the
-- file's columns on what it updated, and deletes a trade it added that nobody has now.
-- Returns {removed, restored, kept: [names]}, and the import keeps it.
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
  c public.contractors;
  e public.equipment;
  v_result jsonb;
begin
  select * into i from public.imports where id = p_id for update;
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
      select * into c from public.contractors where id = (u ->> 'id')::uuid for update;
      continue when c.id is null;
      update public.contractors
      set contact_name = case when 'contact_name' = any (i.columns) then b ->> 'contact_name' else contact_name end,
          phone = case when 'phone' = any (i.columns) then b ->> 'phone' else phone end,
          email = case when 'email' = any (i.columns) then b ->> 'email' else email end,
          preferred = case when 'preferred' = any (i.columns) then (b ->> 'preferred')::boolean else preferred end,
          insurance_until = case when 'insurance_until' = any (i.columns) then (b ->> 'insurance_until')::date else insurance_until end,
          notes = case when 'notes' = any (i.columns) then b ->> 'notes' else notes end
      where id = c.id;
      if 'trades' = any (i.columns) then
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
    -- Every unit it touched must be at a restaurant the caller can still edit.
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
      select * into e from public.equipment where id = (u ->> 'id')::uuid for update;
      continue when e.id is null;
      update public.equipment
      set name = case when 'name' = any (i.columns) then b ->> 'name' else name end,
          -- A category turned off since stays as the import left it.
          category_id = case when 'category_id' = any (i.columns)
                               and exists (select 1 from public.categories where id = (b ->> 'category_id')::uuid and active)
                             then (b ->> 'category_id')::uuid else category_id end,
          brand = case when 'brand' = any (i.columns) then b ->> 'brand' else brand end,
          model = case when 'model' = any (i.columns) then b ->> 'model' else model end,
          serial = case when 'serial' = any (i.columns) then b ->> 'serial' else serial end,
          location_note = case when 'location_note' = any (i.columns) then b ->> 'location_note' else location_note end,
          installed_on = case when 'installed_on' = any (i.columns) then (b ->> 'installed_on')::date else installed_on end,
          warranty_note = case when 'warranty_note' = any (i.columns) then b ->> 'warranty_note' else warranty_note end,
          warranty_until = case when 'warranty_until' = any (i.columns) then (b ->> 'warranty_until')::date else warranty_until end
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

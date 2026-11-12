-- OT-90: the service backend for Phase 5.
--
-- 1. A visit needs no ticket (decided Nov 11, 2026): Ops logs a preventive maintenance
--    call straight on a unit or a restaurant. A service record gets its own
--    restaurant_id, filled from the ticket for every existing row, and every policy,
--    service_record_restaurant() and so the invoice storage rules read it. With a
--    ticket, the restaurant and unit are the ticket's, as since OT-84; without one, the
--    unit is optional and must be at that restaurant and not retired.
--
-- 2. Records, line items and invoices change only through log_service,
--    update_service_record and attach_invoice: each checks log_cost at the record's
--    restaurant, writes the record, its amounts and its invoice row in one step, and
--    logs it in audit_log. They run as definer because Ops can't write audit_log and a
--    write the API could reach directly would skip the log. Nothing deletes a record
--    (the archive and delete rule: records are corrected, not removed).
--
-- 3. An invoice file sits under invoices/<service record id>/, so it is uploaded once
--    the record exists, then named on the record by attach_invoice, which checks the
--    file is really there. The invoice row holds the number, the file and its status;
--    its amount is the record's total.
--
-- 4. The spend views take ticket-less visits: they count toward the unit, the
--    contractor and Invoices, not the ticket total or the Closed tab, which sums ticket
--    totals. All stay security_invoker, so they need see_costs at the restaurant.

-- 1. A record's restaurant -------------------------------------------------------------

alter table public.service_records
  add column restaurant_id uuid references public.restaurants (id);

update public.service_records s
set restaurant_id = t.restaurant_id
from public.tickets t
where t.id = s.ticket_id;

alter table public.service_records
  alter column restaurant_id set not null,
  alter column ticket_id drop not null,
  add constraint service_records_text_lengths check (
    char_length(btrim(title)) between 1 and 200
    and coalesce(char_length(technician), 0) <= 120
    and coalesce(char_length(notes), 0) <= 4000
  );

create index service_records_restaurant_idx on public.service_records (restaurant_id, service_date desc);

alter table public.invoices
  add constraint invoices_number_length check (coalesce(char_length(number), 0) <= 60),
  add constraint invoices_file_here check (path is null or path like service_record_id::text || '/%');

create or replace function public.service_records_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  t public.tickets;
begin
  if new.ticket_id is not null then
    select * into t from public.tickets where id = new.ticket_id;
    new.restaurant_id := t.restaurant_id;
    if not public.is_service() or new.equipment_id is null then
      new.equipment_id := t.equipment_id;
    end if;
  elsif new.equipment_id is not null
    and (tg_op = 'INSERT'
         or new.equipment_id is distinct from old.equipment_id
         or new.restaurant_id is distinct from old.restaurant_id) then
    if not exists (
      select 1 from public.equipment e
      where e.id = new.equipment_id and e.restaurant_id = new.restaurant_id and e.retired_at is null
    ) then
      raise exception 'this unit isn''t at that restaurant, or is retired' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' and (new.logged_by is null or not public.is_service()) then
    new.logged_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' then
    new.logged_by := old.logged_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.service_records_defaults() from public, anon;

create trigger service_records_not_archived before insert on public.service_records
  for each row execute function public.refuse_archived_restaurant();

create or replace function public.service_record_restaurant(srid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.service_records where id = srid;
$$;

-- 2. No direct writes -------------------------------------------------------------------

drop policy service_records_select on public.service_records;
drop policy service_records_insert on public.service_records;
drop policy service_records_update on public.service_records;
create policy service_records_select on public.service_records
  for select to authenticated
  using (public.can('see_costs', restaurant_id));

drop policy service_line_items_write on public.service_line_items;
drop policy invoices_write on public.invoices;

-- Sets one kind of amount on a record: leaves it alone when unchanged, otherwise
-- replaces that kind's rows with one, keeping the first description (the forms ask
-- only for amounts). Called only from the functions below.
create or replace function public.set_service_amount(p_id uuid, p_kind public.line_item_kind, p_cents int)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_old bigint;
  v_description text;
begin
  select coalesce(sum(amount_cents), 0),
         (array_agg(description order by sort_order) filter (where description is not null))[1]
  into v_old, v_description
  from public.service_line_items
  where service_record_id = p_id and kind = p_kind;

  if v_old = p_cents then
    return;
  end if;
  delete from public.service_line_items where service_record_id = p_id and kind = p_kind;
  if p_cents > 0 then
    insert into public.service_line_items (service_record_id, kind, description, amount_cents, sort_order)
    values (p_id, p_kind, v_description, p_cents,
            case p_kind when 'labor' then 1 when 'parts' then 2 else 3 end);
  end if;
end;
$$;

revoke all on function public.set_service_amount(uuid, public.line_item_kind, int) from public, anon, authenticated;

-- What a record holds, for the log.
create or replace function public.service_record_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'ticket_id', s.ticket_id, 'restaurant_id', s.restaurant_id, 'equipment_id', s.equipment_id,
    'kind', s.kind, 'contractor_id', s.contractor_id, 'technician', s.technician,
    'service_date', s.service_date, 'title', s.title, 'notes', s.notes,
    'invoice_number', i.number,
    'labor_cents', (select coalesce(sum(amount_cents), 0) from public.service_line_items where service_record_id = s.id and kind = 'labor'),
    'parts_cents', (select coalesce(sum(amount_cents), 0) from public.service_line_items where service_record_id = s.id and kind = 'parts'),
    'trip_cents', (select coalesce(sum(amount_cents), 0) from public.service_line_items where service_record_id = s.id and kind = 'trip'))
  from public.service_records s
  left join public.invoices i on i.service_record_id = s.id
  where s.id = p_id;
$$;

revoke all on function public.service_record_snapshot(uuid) from public, anon, authenticated;

-- The checks log_service and update_service_record share: the amounts, and who did it.
create or replace function public.service_check_input(
  p_kind public.service_kind,
  p_contractor_id uuid,
  p_contractor_changed boolean,
  p_service_date date,
  p_labor_cents int,
  p_parts_cents int,
  p_trip_cents int
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_kind is null or p_service_date is null then
    raise exception 'a visit needs a kind and a date' using errcode = '22023';
  end if;
  if p_kind = 'contractor' and p_contractor_id is null then
    raise exception 'choose the contractor' using errcode = '22023';
  end if;
  if p_kind = 'in_house' and p_contractor_id is not null then
    raise exception 'in-house work has no contractor' using errcode = '22023';
  end if;
  if p_contractor_changed and p_contractor_id is not null and not exists (
    select 1 from public.contractors where id = p_contractor_id and archived_at is null
  ) then
    raise exception 'this contractor is archived or doesn''t exist' using errcode = '22023';
  end if;
  if coalesce(p_labor_cents, 0) not between 0 and 100000000
     or coalesce(p_parts_cents, 0) not between 0 and 100000000
     or coalesce(p_trip_cents, 0) not between 0 and 100000000 then
    raise exception 'each amount is between $0 and $1,000,000' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.service_check_input(public.service_kind, uuid, boolean, date, int, int, int)
  from public, anon, authenticated;

-- Log a visit. With a ticket, the restaurant and unit are the ticket's and the other
-- two arguments are ignored; without one, the restaurant is required and the unit is
-- optional. The board asks for no title, so it is the ticket's, or says what kind of
-- visit it was. A contractor's visit gets an invoice row, Missing until a file is
-- attached. Returns the record's id, which names the invoice file's folder.
create or replace function public.log_service(
  p_kind public.service_kind,
  p_service_date date default current_date,
  p_ticket_id uuid default null,
  p_restaurant_id uuid default null,
  p_equipment_id uuid default null,
  p_contractor_id uuid default null,
  p_technician text default null,
  p_title text default null,
  p_notes text default null,
  p_invoice_number text default null,
  p_labor_cents int default 0,
  p_parts_cents int default 0,
  p_trip_cents int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets;
  v_restaurant uuid;
  v_id uuid;
begin
  if p_ticket_id is not null then
    select * into t from public.tickets where id = p_ticket_id;
    v_restaurant := t.restaurant_id;
  else
    v_restaurant := p_restaurant_id;
  end if;
  if v_restaurant is null or not public.can('log_cost', v_restaurant) then
    raise exception 'you can''t log service here' using errcode = '42501';
  end if;
  perform public.service_check_input(p_kind, p_contractor_id, true, p_service_date,
                                     p_labor_cents, p_parts_cents, p_trip_cents);

  insert into public.service_records
    (ticket_id, restaurant_id, equipment_id, contractor_id, kind, technician, service_date, title, notes)
  values (
    p_ticket_id, v_restaurant, p_equipment_id, p_contractor_id, p_kind,
    nullif(btrim(p_technician), ''), p_service_date,
    coalesce(nullif(btrim(p_title), ''), t.title,
             case p_kind when 'contractor' then 'Contractor visit' else 'In-house work' end),
    nullif(btrim(p_notes), ''))
  returning id into v_id;

  perform public.set_service_amount(v_id, 'labor', coalesce(p_labor_cents, 0));
  perform public.set_service_amount(v_id, 'parts', coalesce(p_parts_cents, 0));
  perform public.set_service_amount(v_id, 'trip', coalesce(p_trip_cents, 0));

  if p_kind = 'contractor' or nullif(btrim(p_invoice_number), '') is not null then
    insert into public.invoices (service_record_id, number, amount_cents, status)
    values (v_id, nullif(btrim(p_invoice_number), ''),
            coalesce(p_labor_cents, 0) + coalesce(p_parts_cents, 0) + coalesce(p_trip_cents, 0),
            'missing');
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'service.log', v_restaurant,
          jsonb_build_object('service_record_id', v_id) || public.service_record_snapshot(v_id));
  return v_id;
end;
$$;

-- Correct a visit: every field as the Edit form holds it. A ticket can be added,
-- changed or taken off; with one, the restaurant and unit follow it. Needs log_cost at
-- the restaurant it was at and the one it ends up at.
create or replace function public.update_service_record(
  p_id uuid,
  p_kind public.service_kind,
  p_service_date date,
  p_ticket_id uuid default null,
  p_restaurant_id uuid default null,
  p_equipment_id uuid default null,
  p_contractor_id uuid default null,
  p_technician text default null,
  p_title text default null,
  p_notes text default null,
  p_invoice_number text default null,
  p_labor_cents int default 0,
  p_parts_cents int default 0,
  p_trip_cents int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.service_records;
  v_restaurant uuid;
  v_before jsonb;
  v_total bigint;
begin
  select * into s from public.service_records where id = p_id for update;
  if s.id is null or not public.can('log_cost', s.restaurant_id) then
    raise exception 'you can''t change this record' using errcode = '42501';
  end if;
  if p_ticket_id is not null then
    select restaurant_id into v_restaurant from public.tickets where id = p_ticket_id;
  else
    v_restaurant := p_restaurant_id;
  end if;
  if v_restaurant is null or not public.can('log_cost', v_restaurant) then
    raise exception 'you can''t log service here' using errcode = '42501';
  end if;
  if v_restaurant <> s.restaurant_id
     and exists (select 1 from public.restaurants where id = v_restaurant and archived_at is not null) then
    raise exception 'this restaurant is archived' using errcode = '42501';
  end if;
  perform public.service_check_input(p_kind, p_contractor_id, p_contractor_id is distinct from s.contractor_id,
                                     p_service_date, p_labor_cents, p_parts_cents, p_trip_cents);

  v_before := public.service_record_snapshot(p_id);

  update public.service_records
  set ticket_id = p_ticket_id,
      restaurant_id = v_restaurant,
      equipment_id = p_equipment_id,
      contractor_id = p_contractor_id,
      kind = p_kind,
      technician = nullif(btrim(p_technician), ''),
      service_date = p_service_date,
      title = coalesce(nullif(btrim(p_title), ''), s.title),
      notes = nullif(btrim(p_notes), '')
  where id = p_id;

  perform public.set_service_amount(p_id, 'labor', coalesce(p_labor_cents, 0));
  perform public.set_service_amount(p_id, 'parts', coalesce(p_parts_cents, 0));
  perform public.set_service_amount(p_id, 'trip', coalesce(p_trip_cents, 0));

  select total_cents into v_total from public.v_service_record_totals where service_record_id = p_id;
  if p_kind = 'contractor' or nullif(btrim(p_invoice_number), '') is not null
     or exists (select 1 from public.invoices where service_record_id = p_id) then
    insert into public.invoices (service_record_id, number, amount_cents, status)
    values (p_id, nullif(btrim(p_invoice_number), ''), v_total, 'missing')
    on conflict (service_record_id) do update
    set number = excluded.number, amount_cents = excluded.amount_cents;
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'service.update', v_restaurant,
          jsonb_build_object('service_record_id', p_id, 'before', v_before,
                             'after', public.service_record_snapshot(p_id)));
end;
$$;

-- Name an uploaded file as a record's invoice, attaching or replacing it. The file must
-- already be in the record's folder of the invoices bucket; a replaced file stays
-- there, and the log keeps its path.
create or replace function public.attach_invoice(p_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.service_records;
  v_old text;
begin
  select * into s from public.service_records where id = p_id for update;
  if s.id is null or not public.can('log_cost', s.restaurant_id) then
    raise exception 'you can''t change this record' using errcode = '42501';
  end if;
  if p_path is null or p_path not like p_id::text || '/%' or p_path like '%..%'
     or not exists (select 1 from storage.objects where bucket_id = 'invoices' and name = p_path) then
    raise exception 'upload the file to this record''s folder first' using errcode = '22023';
  end if;

  select path into v_old from public.invoices where service_record_id = p_id;

  insert into public.invoices (service_record_id, amount_cents, status, path, attached_by, attached_at)
  values (p_id, (select total_cents from public.v_service_record_totals where service_record_id = p_id),
          'attached', p_path, auth.uid(), now())
  on conflict (service_record_id) do update
  set status = 'attached', path = excluded.path, attached_by = excluded.attached_by,
      attached_at = excluded.attached_at;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), case when v_old is null then 'service.invoice_attach' else 'service.invoice_replace' end,
          s.restaurant_id,
          jsonb_build_object('service_record_id', p_id, 'path', p_path, 'previous_path', v_old));
end;
$$;

revoke all on function public.log_service(public.service_kind, date, uuid, uuid, uuid, uuid, text, text, text, text, int, int, int)
  from public, anon;
grant execute on function public.log_service(public.service_kind, date, uuid, uuid, uuid, uuid, text, text, text, text, int, int, int)
  to authenticated;
revoke all on function public.update_service_record(uuid, public.service_kind, date, uuid, uuid, uuid, uuid, text, text, text, text, int, int, int)
  from public, anon;
grant execute on function public.update_service_record(uuid, public.service_kind, date, uuid, uuid, uuid, uuid, text, text, text, text, int, int, int)
  to authenticated;
revoke all on function public.attach_invoice(uuid, text) from public, anon;
grant execute on function public.attach_invoice(uuid, text) to authenticated;

-- 4. Spend views ----------------------------------------------------------------------

-- A visit with no ticket has no ticket total.
create or replace view public.v_ticket_costs
with (security_invoker = true) as
select
  s.ticket_id,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_service_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.ticket_id is not null
group by s.ticket_id;

-- Per restaurant as well, so the directory follows the restaurant picker; the screen
-- sums the restaurants picked. Nothing read the old shape.
drop view public.v_contractor_spend;
create view public.v_contractor_spend
with (security_invoker = true) as
select
  s.contractor_id,
  s.restaurant_id,
  extract(year from s.service_date)::int as year,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_visit_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.contractor_id is not null
group by s.contractor_id, s.restaurant_id, extract(year from s.service_date);

create or replace view public.v_missing_invoices
with (security_invoker = true) as
select
  s.id as service_record_id,
  s.ticket_id,
  s.contractor_id,
  s.service_date,
  t.total_cents,
  s.restaurant_id,
  s.equipment_id
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
left join public.invoices i on i.service_record_id = s.id
where s.kind = 'contractor' and (i.id is null or i.status = 'missing');

-- The Invoices tab's months: contractors' visits by the month of the visit (a date, so
-- no time zone cuts it), with the count, the total and how many lack a file.
create view public.v_invoices_by_month
with (security_invoker = true) as
select
  s.restaurant_id,
  date_trunc('month', s.service_date)::date as month,
  count(s.id)::int as invoices,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id) filter (where i.id is null or i.status = 'missing')::int as missing
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
left join public.invoices i on i.service_record_id = s.id
where s.kind = 'contractor'
group by s.restaurant_id, date_trunc('month', s.service_date);

grant select on public.v_contractor_spend, public.v_invoices_by_month to authenticated, service_role;

-- A restaurant with a visit logged on it has history, ticket or not.
create or replace view public.v_restaurant_history
with (security_invoker = true) as
select
  r.id as restaurant_id,
  (select count(*) from public.tickets t where t.restaurant_id = r.id)::int as tickets,
  (select count(*) from public.equipment e where e.restaurant_id = r.id)::int as equipment,
  (select count(*) from public.walkthroughs w where w.restaurant_id = r.id)::int as walkthroughs,
  (select count(*) from public.inhouse_fixes f where f.restaurant_id = r.id)::int as inhouse_fixes,
  (select count(*) from public.profiles p where p.home_restaurant_id = r.id)::int as home_of,
  (select count(*) from public.service_records s where s.restaurant_id = r.id)::int as service_records
from public.restaurants r;

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
  if h.tickets + h.equipment + h.walkthroughs + h.inhouse_fixes + h.service_records > 0 then
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

revoke all on function public.delete_restaurant(uuid) from public, anon;
grant execute on function public.delete_restaurant(uuid) to authenticated;

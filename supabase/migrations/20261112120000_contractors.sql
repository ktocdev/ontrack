-- OT-91: contractors by the archive and delete rule.
--
-- Contractors are the group's, shared by every restaurant, so, as with categories
-- (OT-84), only Ops with log_cost and admins change them: can('log_cost') alone passed
-- for a manager granted it at one restaurant. Until now anyone with log_cost wrote the
-- table straight through the API with no log. Every write now goes through
-- save_contractor, set_contractor_archived and delete_contractor, which check the
-- caller and log; they run as definer because Ops can't write audit_log.
--
-- Archive takes a contractor out of the directory and the Log service picker and keeps
-- their visits; log_service and update_service_record already refuse an archived one
-- (OT-90). Delete is for a mistake or a test entry, only while no service record names
-- them.
--
-- A trade comes from a fixed list (decided Nov 12, 2026): the Add contractor board's
-- seven, the seven more the seed uses, and Other last. contractor_trades() is the one
-- place it lives; the check reads it and the app can too.

create or replace function public.contractor_trades()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'Roofing', 'Refrigeration', 'HVAC', 'Electrical', 'Plumbing', 'Dishwashing', 'General repair',
    'Cooking', 'Ventilation', 'Lighting', 'Furniture', 'Decorations', 'Audio & video', 'POS & tech',
    'Other'
  ];
$$;

revoke all on function public.contractor_trades() from public, anon;
grant execute on function public.contractor_trades() to authenticated, service_role;

alter table public.contractors
  add constraint contractors_trade_listed check (trade = any (public.contractor_trades())),
  add constraint contractors_text_lengths check (
    char_length(btrim(name)) between 1 and 120
    and coalesce(char_length(contact_name), 0) <= 120
    and coalesce(char_length(phone), 0) <= 40
    and coalesce(char_length(email), 0) <= 254
    and coalesce(char_length(notes), 0) <= 2000
  ),
  add constraint contractors_email_shape check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

drop policy contractors_write on public.contractors;

create or replace function public.can_edit_contractors()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin() or (public.my_role() = 'ops' and public.can('log_cost'));
$$;

revoke all on function public.can_edit_contractors() from public, anon;
grant execute on function public.can_edit_contractors() to authenticated;

-- Whether a service record names a contractor. Runs as definer so someone who sees
-- the directory but no costs still learns it (never what it cost), which the Delete
-- button needs; null for someone who can't see contractors.
create or replace function public.contractor_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when public.can('see_contractors') or public.can('see_costs') then
    exists (select 1 from public.service_records s where s.contractor_id = c.id)
  end
  from public.contractors c
  where c.id = p_id;
$$;

revoke all on function public.contractor_in_use(uuid) from public, anon;
grant execute on function public.contractor_in_use(uuid) to authenticated;

-- History per contractor, for the Delete button. Runs as the caller.
create view public.v_contractor_history
with (security_invoker = true) as
select c.id as contractor_id, public.contractor_in_use(c.id) as in_use
from public.contractors c;

grant select on public.v_contractor_history to authenticated, service_role;

-- Add (no id) or edit (an id) a contractor. Returns the id.
create or replace function public.save_contractor(
  p_id uuid,
  p_name text,
  p_trade text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_preferred boolean default false,
  p_insurance_until date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contractors;
  v_id uuid;
  v_name text := btrim(p_name);
  v_before jsonb;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can add or edit a contractor' using errcode = '42501';
  end if;
  if p_id is not null then
    select * into c from public.contractors where id = p_id for update;
    if c.id is null then
      raise exception 'no such contractor' using errcode = 'P0002';
    end if;
  end if;
  if p_trade is null or not (p_trade = any (public.contractor_trades())) then
    raise exception 'choose a trade from the list' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.contractors
    where lower(name) = lower(v_name) and archived_at is null and id is distinct from p_id
  ) then
    raise exception 'a contractor by that name already exists' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.contractors
      (name, trade, contact_name, phone, email, preferred, insurance_until, notes, created_by)
    values (v_name, p_trade, nullif(btrim(p_contact_name), ''), nullif(btrim(p_phone), ''),
            nullif(btrim(p_email), ''), coalesce(p_preferred, false), p_insurance_until,
            nullif(btrim(p_notes), ''), auth.uid())
    returning id into v_id;

    insert into public.audit_log (actor_id, action, meta)
    values (auth.uid(), 'contractor.add', jsonb_build_object('contractor_id', v_id, 'name', v_name));
    return v_id;
  end if;

  v_before := to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by';
  update public.contractors
  set name = v_name,
      trade = p_trade,
      contact_name = nullif(btrim(p_contact_name), ''),
      phone = nullif(btrim(p_phone), ''),
      email = nullif(btrim(p_email), ''),
      preferred = coalesce(p_preferred, false),
      insurance_until = p_insurance_until,
      notes = nullif(btrim(p_notes), '')
  where id = p_id
  returning * into c;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'contractor.update',
          jsonb_build_object('contractor_id', p_id, 'name', v_name, 'before', v_before,
                             'after', to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by'));
  return p_id;
end;
$$;

create or replace function public.set_contractor_archived(p_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contractors;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can archive a contractor' using errcode = '42501';
  end if;
  select * into c from public.contractors where id = p_id for update;
  if c.id is null then
    raise exception 'no such contractor' using errcode = 'P0002';
  end if;
  if (c.archived_at is not null) = p_archived then
    return; -- already in that state
  end if;
  if not p_archived and exists (
    select 1 from public.contractors
    where lower(name) = lower(c.name) and archived_at is null and id <> p_id
  ) then
    raise exception 'another contractor has this name now; rename one first' using errcode = '23505';
  end if;

  update public.contractors
  set archived_at = case when p_archived then now() end
  where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), case when p_archived then 'contractor.archive' else 'contractor.restore' end,
          jsonb_build_object('contractor_id', p_id, 'name', c.name));
end;
$$;

create or replace function public.delete_contractor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contractors;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can delete a contractor' using errcode = '42501';
  end if;
  select * into c from public.contractors where id = p_id for update;
  if c.id is null then
    raise exception 'no such contractor' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.service_records where contractor_id = p_id) then
    raise exception 'this contractor has visits on record; archive them instead' using errcode = '23503';
  end if;

  -- Logged first: the entry keeps the name once the row is gone.
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'contractor.delete',
          jsonb_build_object('contractor_id', p_id, 'name', c.name, 'trade', c.trade));

  delete from public.contractors where id = p_id;
end;
$$;

revoke all on function public.save_contractor(uuid, text, text, text, text, text, boolean, date, text) from public, anon;
grant execute on function public.save_contractor(uuid, text, text, text, text, text, boolean, date, text) to authenticated;
revoke all on function public.set_contractor_archived(uuid, boolean) from public, anon;
grant execute on function public.set_contractor_archived(uuid, boolean) to authenticated;
revoke all on function public.delete_contractor(uuid) from public, anon;
grant execute on function public.delete_contractor(uuid) to authenticated;

-- A visit can no longer lose its contractor by a delete: delete_contractor refuses one
-- with visits, and this keeps the service role to the same rule.
alter table public.service_records
  drop constraint service_records_contractor_id_fkey,
  add constraint service_records_contractor_id_fkey
    foreign key (contractor_id) references public.contractors (id) on delete restrict;

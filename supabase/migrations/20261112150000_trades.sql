-- OT-99: a contractor can have several trades, and the trade list is the group's to
-- look after (decided Nov 12, 2026, from feedback on OT-94).
--
-- Until now a contractor had one trade, a text column checked against the fixed list
-- in contractor_trades(). Some contractors do more than one thing (refrigeration and
-- HVAC, say), so trades become a table and each contractor links to one or more of
-- them. The list starts as the fixed one, in the same order, and every contractor
-- keeps the trade they had.
--
-- Trades follow the archive and delete rule, like categories (OT-86): a trade is
-- added, renamed, turned off and on again, and deleted only while no contractor has
-- it. A turned-off one leaves the pickers and no contractor takes it on; one that
-- already has it keeps it. The same people who change contractors change trades: Ops
-- with log_cost and admins (can_edit_contractors()). Every change goes through a
-- function that checks the caller and logs it; they run as definer because Ops can't
-- write audit_log. Nobody writes either table directly.

create table public.trades (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  constraint trades_name_length check (char_length(btrim(name)) between 1 and 60)
);
create unique index trades_name_idx on public.trades (lower(btrim(name)));

insert into public.trades (name, sort_order)
select t.name, t.n
from unnest(public.contractor_trades()) with ordinality as t (name, n);

-- One row per contractor and trade. A contractor's trades show in the list's order.
create table public.contractor_trades (
  contractor_id  uuid not null references public.contractors (id) on delete cascade,
  trade_id       uuid not null references public.trades (id) on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (contractor_id, trade_id)
);
create index contractor_trades_trade_idx on public.contractor_trades (trade_id);

insert into public.contractor_trades (contractor_id, trade_id)
select c.id, t.id
from public.contractors c
join public.trades t on t.name = c.trade;

-- The old single trade goes, with the fixed list and the function that read it.
drop function public.save_contractor(uuid, text, text, text, text, text, boolean, date, text);
alter table public.contractors
  drop constraint contractors_trade_listed,
  drop column trade;
drop function public.contractor_trades();

-- Read by whoever reads contractors: the directory, and a closed ticket's contractor.
alter table public.trades enable row level security;
alter table public.contractor_trades enable row level security;

create policy trades_select on public.trades
  for select to authenticated
  using (public.can('see_contractors') or public.can('see_costs'));
create policy contractor_trades_select on public.contractor_trades
  for select to authenticated
  using (public.can('see_contractors') or public.can('see_costs'));

-- A contractor's trade names in the list's order, for the log. Internal.
create or replace function public.contractor_trade_names(p_contractor_id uuid)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(t.name order by t.sort_order, t.name), '{}')
  from public.contractor_trades ct
  join public.trades t on t.id = ct.trade_id
  where ct.contractor_id = p_contractor_id;
$$;

revoke all on function public.contractor_trade_names(uuid) from public, anon, authenticated;

-- Whether any contractor (archived or not) has a trade, for the Delete button. Definer
-- so the answer doesn't depend on what the caller reads; null for someone who can't
-- see contractors.
create or replace function public.trade_in_use(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when public.can('see_contractors') or public.can('see_costs') then
    exists (select 1 from public.contractor_trades where trade_id = p_id)
  end;
$$;

revoke all on function public.trade_in_use(uuid) from public, anon;
grant execute on function public.trade_in_use(uuid) to authenticated;

create view public.v_trade_history
with (security_invoker = true) as
select t.id as trade_id, public.trade_in_use(t.id) as in_use
from public.trades t;

grant select on public.v_trade_history to authenticated;

-- A name already on the list, ignoring case and spaces at the ends.
create or replace function public.trade_name_taken(p_name text, p_except uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trades
    where lower(btrim(name)) = lower(btrim(p_name)) and id is distinct from p_except
  );
$$;

revoke all on function public.trade_name_taken(text, uuid) from public, anon, authenticated;

-- A new trade goes just before Other, which stays last; at the end if there is no Other.
create or replace function public.add_trade(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sort integer;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can add a trade' using errcode = '42501';
  end if;
  if public.trade_name_taken(p_name, null) then
    raise exception 'that trade already exists' using errcode = '23505';
  end if;

  v_sort := coalesce(
    (select sort_order from public.trades where lower(name) = 'other'),
    (select max(sort_order) + 1 from public.trades),
    1);
  update public.trades set sort_order = sort_order + 1 where sort_order >= v_sort;

  insert into public.trades (name, sort_order)
  values (btrim(p_name), v_sort)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'trade.add', jsonb_build_object('trade_id', v_id, 'name', btrim(p_name)));
  return v_id;
end;
$$;

create or replace function public.rename_trade(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trades;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can rename a trade' using errcode = '42501';
  end if;
  select * into t from public.trades where id = p_id for update;
  if t.id is null then
    raise exception 'no such trade' using errcode = 'P0002';
  end if;
  if public.trade_name_taken(p_name, p_id) then
    raise exception 'that trade already exists' using errcode = '23505';
  end if;
  if t.name = btrim(p_name) then
    return;
  end if;

  update public.trades set name = btrim(p_name) where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'trade.rename', jsonb_build_object('trade_id', p_id, 'from', t.name, 'to', btrim(p_name)));
end;
$$;

create or replace function public.set_trade_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trades;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can turn a trade off or on' using errcode = '42501';
  end if;
  select * into t from public.trades where id = p_id for update;
  if t.id is null then
    raise exception 'no such trade' using errcode = 'P0002';
  end if;
  if t.active = p_active then
    return;
  end if;

  update public.trades set active = p_active where id = p_id;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), case when p_active then 'trade.turn_on' else 'trade.turn_off' end,
          jsonb_build_object('trade_id', p_id, 'name', t.name));
end;
$$;

create or replace function public.delete_trade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trades;
begin
  if not public.can_edit_contractors() then
    raise exception 'only Ops or an admin can delete a trade' using errcode = '42501';
  end if;
  select * into t from public.trades where id = p_id for update;
  if t.id is null then
    raise exception 'no such trade' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.contractor_trades where trade_id = p_id) then
    raise exception 'a contractor has this trade; turn it off instead' using errcode = '23503';
  end if;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'trade.delete', jsonb_build_object('trade_id', p_id, 'name', t.name));

  delete from public.trades where id = p_id;
end;
$$;

revoke all on function public.add_trade(text) from public, anon;
grant execute on function public.add_trade(text) to authenticated;
revoke all on function public.rename_trade(uuid, text) from public, anon;
grant execute on function public.rename_trade(uuid, text) to authenticated;
revoke all on function public.set_trade_active(uuid, boolean) from public, anon;
grant execute on function public.set_trade_active(uuid, boolean) to authenticated;
revoke all on function public.delete_trade(uuid) from public, anon;
grant execute on function public.delete_trade(uuid) to authenticated;

-- Add (no id) or edit (an id) a contractor, with one or more trades. Returns the id.
-- A turned-off trade can't be newly given, but a contractor who has one keeps it.
create or replace function public.save_contractor(
  p_id uuid,
  p_name text,
  p_trade_ids uuid[],
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
  v_trades uuid[];
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

  v_trades := array(select distinct x from unnest(p_trade_ids) as x where x is not null);
  if cardinality(v_trades) = 0 then
    raise exception 'choose at least one trade' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_trades) x where not exists (select 1 from public.trades t where t.id = x)) then
    raise exception 'choose trades from the list' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.trades t
    where t.id = any (v_trades) and not t.active
      and not exists (select 1 from public.contractor_trades ct where ct.contractor_id = p_id and ct.trade_id = t.id)
  ) then
    raise exception 'that trade is turned off' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.contractors
    where lower(name) = lower(v_name) and archived_at is null and id is distinct from p_id
  ) then
    raise exception 'a contractor by that name already exists' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.contractors
      (name, contact_name, phone, email, preferred, insurance_until, notes, created_by)
    values (v_name, nullif(btrim(p_contact_name), ''), nullif(btrim(p_phone), ''),
            nullif(btrim(p_email), ''), coalesce(p_preferred, false), p_insurance_until,
            nullif(btrim(p_notes), ''), auth.uid())
    returning id into v_id;

    insert into public.contractor_trades (contractor_id, trade_id)
    select v_id, x from unnest(v_trades) x;

    insert into public.audit_log (actor_id, action, meta)
    values (auth.uid(), 'contractor.add',
            jsonb_build_object('contractor_id', v_id, 'name', v_name,
                               'trades', to_jsonb(public.contractor_trade_names(v_id))));
    return v_id;
  end if;

  v_before := to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by'
              || jsonb_build_object('trades', to_jsonb(public.contractor_trade_names(p_id)));
  update public.contractors
  set name = v_name,
      contact_name = nullif(btrim(p_contact_name), ''),
      phone = nullif(btrim(p_phone), ''),
      email = nullif(btrim(p_email), ''),
      preferred = coalesce(p_preferred, false),
      insurance_until = p_insurance_until,
      notes = nullif(btrim(p_notes), '')
  where id = p_id
  returning * into c;

  delete from public.contractor_trades where contractor_id = p_id and not (trade_id = any (v_trades));
  insert into public.contractor_trades (contractor_id, trade_id)
  select p_id, x from unnest(v_trades) x
  on conflict do nothing;

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'contractor.update',
          jsonb_build_object('contractor_id', p_id, 'name', v_name, 'before', v_before,
                             'after', to_jsonb(c) - 'created_at' - 'updated_at' - 'created_by'
                                      || jsonb_build_object('trades', to_jsonb(public.contractor_trade_names(p_id)))));
  return p_id;
end;
$$;

revoke all on function public.save_contractor(uuid, text, uuid[], text, text, text, boolean, date, text) from public, anon;
grant execute on function public.save_contractor(uuid, text, uuid[], text, text, text, boolean, date, text) to authenticated;

-- As before, with the trades named in the log in place of the one trade.
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

  -- Logged first: the entry keeps the name and trades once the row is gone.
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'contractor.delete',
          jsonb_build_object('contractor_id', p_id, 'name', c.name,
                             'trades', to_jsonb(public.contractor_trade_names(p_id))));

  delete from public.contractors where id = p_id;
end;
$$;

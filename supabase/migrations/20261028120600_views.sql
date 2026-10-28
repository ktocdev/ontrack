-- OnTrack schema, part 7 of 8: views.
-- Counts and costs live here so every screen shows the same numbers. All views
-- run as the caller (security_invoker), so row-level security on the tables
-- underneath still applies: a manager without see_costs gets no cost rows.

-- Total per service record, from its line items.
create view public.v_service_record_totals
with (security_invoker = true) as
select
  s.id as service_record_id,
  coalesce(sum(li.amount_cents), 0)::bigint as total_cents
from public.service_records s
left join public.service_line_items li on li.service_record_id = s.id
group by s.id;

-- Cost and visit count per ticket; feeds the ticket total and closed rows.
create view public.v_ticket_costs
with (security_invoker = true) as
select
  s.ticket_id,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_service_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
group by s.ticket_id;

-- Spend per unit per year; the Equipment list's "spent in 2026".
create view public.v_equipment_spend
with (security_invoker = true) as
select
  s.equipment_id,
  extract(year from s.service_date)::int as year,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.equipment_id is not null
group by s.equipment_id, extract(year from s.service_date);

-- Lifetime spend per unit.
create view public.v_equipment_lifetime
with (security_invoker = true) as
select
  s.equipment_id,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_service_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.equipment_id is not null
group by s.equipment_id;

-- Contractors on a unit, with what each has been paid for it.
create view public.v_equipment_contractors
with (security_invoker = true) as
select
  s.equipment_id,
  s.contractor_id,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_visit_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.equipment_id is not null and s.contractor_id is not null
group by s.equipment_id, s.contractor_id;

-- Spend, visits and last visit per contractor per year; the directory sorts
-- by these.
create view public.v_contractor_spend
with (security_invoker = true) as
select
  s.contractor_id,
  extract(year from s.service_date)::int as year,
  coalesce(sum(t.total_cents), 0)::bigint as total_cents,
  count(s.id)::int as visits,
  max(s.service_date) as last_visit_on
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
where s.contractor_id is not null
group by s.contractor_id, extract(year from s.service_date);

-- Open and urgent counts per restaurant; Admin Restaurants, Ops picker,
-- Leadership overview.
create view public.v_restaurant_open_counts
with (security_invoker = true) as
select
  r.id as restaurant_id,
  count(t.id) filter (where t.status <> 'closed')::int as open_count,
  count(t.id) filter (where t.status <> 'closed' and t.urgency = 'urgent')::int as urgent_count,
  count(t.id) filter (where t.status = 'reopened')::int as reopened_count
from public.restaurants r
left join public.tickets t on t.restaurant_id = r.id
group by r.id;

-- The Closed tab: tickets by the month they closed, with totals. A reopened
-- ticket keeps its place in the month it was closed.
create view public.v_closed_by_month
with (security_invoker = true) as
select
  t.restaurant_id,
  date_trunc('month', t.last_closed_at)::date as month,
  count(t.id)::int as closed_count,
  coalesce(sum(c.total_cents), 0)::bigint as total_cents
from public.tickets t
left join public.v_ticket_costs c on c.ticket_id = t.id
where t.last_closed_at is not null
group by t.restaurant_id, date_trunc('month', t.last_closed_at);

-- Equipment per category per restaurant; the counts on the Create ticket grid.
create view public.v_category_equipment_counts
with (security_invoker = true) as
select
  e.restaurant_id,
  e.category_id,
  count(e.id)::int as equipment_count,
  count(t.id) filter (where t.status <> 'closed')::int as open_ticket_count
from public.equipment e
left join public.tickets t on t.equipment_id = e.id
where e.retired_at is null
group by e.restaurant_id, e.category_id;

-- Service records with no attached invoice; the Missing filter and count.
create view public.v_missing_invoices
with (security_invoker = true) as
select
  s.id as service_record_id,
  s.ticket_id,
  s.contractor_id,
  s.service_date,
  t.total_cents
from public.service_records s
join public.v_service_record_totals t on t.service_record_id = s.id
left join public.invoices i on i.service_record_id = s.id
where s.kind = 'contractor' and (i.id is null or i.status = 'missing');

grant select on
  public.v_service_record_totals,
  public.v_ticket_costs,
  public.v_equipment_spend,
  public.v_equipment_lifetime,
  public.v_equipment_contractors,
  public.v_contractor_spend,
  public.v_restaurant_open_counts,
  public.v_closed_by_month,
  public.v_category_equipment_counts,
  public.v_missing_invoices
to authenticated, service_role;

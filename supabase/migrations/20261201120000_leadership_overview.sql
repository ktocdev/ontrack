-- OT-142: leadership's Overview, one row per restaurant and month.
--
-- Built on what Ops' screens already read, so the figures can't drift: spend from the
-- service records and v_service_record_totals (a unit's and a contractor's spend), closed
-- tickets as the Closed tab counts them (closed now, by closed_at in the group's time zone),
-- and opened tickets by created_at the same way. Open and Urgent are what is open now, from
-- v_restaurant_open_counts, as on the Ops dashboard, so they are not here.
--
-- Spend is every visit dated in the month (decided Nov 19, 2026): contractor and in-house,
-- with or without a ticket, which is what the restaurant spent. It can differ from the
-- Closed tab's month total, which is about closed tickets, and from Invoices, which leaves
-- in-house work out.
--
-- security_invoker, so a row shows only what the reader may see: tickets by See all tickets
-- or scope, spend only with See costs at the restaurant. sees_costs says which, so a screen
-- can tell no spend from spend it may not see.

create view public.v_overview_by_month
with (security_invoker = true) as
with tz as (
  select coalesce((select time_zone from public.group_settings limit 1), 'UTC') as zone
),
spend as (
  select s.restaurant_id, date_trunc('month', s.service_date)::date as month,
         coalesce(sum(t.total_cents), 0)::bigint as spend_cents, count(s.id)::int as visits
  from public.service_records s
  join public.v_service_record_totals t on t.service_record_id = s.id
  group by 1, 2
),
opened as (
  select t.restaurant_id, date_trunc('month', t.created_at at time zone tz.zone)::date as month,
         count(t.id)::int as opened
  from public.tickets t cross join tz
  group by 1, 2
),
closed as (
  select t.restaurant_id, date_trunc('month', t.closed_at at time zone tz.zone)::date as month,
         count(t.id)::int as closed,
         coalesce(sum(extract(epoch from t.closed_at - t.created_at)), 0)::bigint as close_seconds
  from public.tickets t cross join tz
  where t.status = 'closed' and t.closed_at is not null
  group by 1, 2
),
keys as (
  select restaurant_id, month from spend
  union select restaurant_id, month from opened
  union select restaurant_id, month from closed
)
select
  k.restaurant_id,
  k.month,
  coalesce(o.opened, 0) as opened,
  coalesce(c.closed, 0) as closed,
  -- Seconds from opening to closing, summed over the month's closed tickets; the average is
  -- this over closed, so restaurants and months add up.
  coalesce(c.close_seconds, 0) as close_seconds,
  coalesce(s.spend_cents, 0) as spend_cents,
  coalesce(s.visits, 0) as visits,
  public.can('see_costs', k.restaurant_id) as sees_costs
from keys k
left join spend s on s.restaurant_id = k.restaurant_id and s.month = k.month
left join opened o on o.restaurant_id = k.restaurant_id and o.month = k.month
left join closed c on c.restaurant_id = k.restaurant_id and c.month = k.month;

comment on view public.v_overview_by_month is
  'Leadership''s Overview: per restaurant and month, tickets opened and closed, time to close, and spend (every visit).';

revoke all on public.v_overview_by_month from public, anon;
grant select on public.v_overview_by_month to authenticated, service_role;

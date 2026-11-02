-- OT-41: the Closed tickets screen's months and totals, in the viewer's time zone, so a
-- ticket closed on the evening of Oct 31 in Chicago is under October, as its date says.
-- v_closed_by_month cuts months in the database's zone (UTC), which would put it under
-- November. A reopened ticket keeps its place in the month it was closed.
--
-- It runs as the caller, so RLS decides which tickets and costs count. The total is null
-- without see_costs at any of those restaurants, so nobody without the right reads $0.00
-- as an answer.

create function public.closed_by_month(p_restaurant_ids uuid[], p_time_zone text)
returns table (month date, closed_count int, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', t.last_closed_at at time zone p_time_zone)::date,
    count(t.id)::int,
    case
      when bool_or(public.can('see_costs', t.restaurant_id)) then coalesce(sum(c.total_cents), 0)::bigint
    end
  from public.tickets t
  left join public.v_ticket_costs c on c.ticket_id = t.id
  where t.last_closed_at is not null
    and t.restaurant_id = any(p_restaurant_ids)
  group by 1
  order by 1 desc;
$$;

revoke all on function public.closed_by_month(uuid[], text) from public, anon;
grant execute on function public.closed_by_month(uuid[], text) to authenticated;

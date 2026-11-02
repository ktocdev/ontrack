-- OT-51, from feedback: a reopened ticket is open work, so it is on the dashboard and not
-- among the closed tickets. Closed tickets count only while they are closed, in the month
-- they last closed.

create or replace function public.closed_by_month(p_restaurant_ids uuid[], p_time_zone text)
returns table (month date, closed_count int, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', t.closed_at at time zone p_time_zone)::date,
    count(t.id)::int,
    case
      when bool_or(public.can('see_costs', t.restaurant_id)) then coalesce(sum(c.total_cents), 0)::bigint
    end
  from public.tickets t
  left join public.v_ticket_costs c on c.ticket_id = t.id
  where t.status = 'closed'
    and t.restaurant_id = any(p_restaurant_ids)
  group by 1
  order by 1 desc;
$$;

revoke all on function public.closed_by_month(uuid[], text) from public, anon;
grant execute on function public.closed_by_month(uuid[], text) to authenticated;

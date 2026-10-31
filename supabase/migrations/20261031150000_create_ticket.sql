-- OT-26: what Create ticket needs from the database.
--
-- The form offers Low, Normal and Urgent; the type had only the last two.
--
-- The category counts joined tickets, so a unit counted once per ticket. They
-- count each unit once now.
--
-- A ticket's equipment must be at the ticket's restaurant and not retired. The
-- form only offers those, but a person can call the API without it. This checks
-- when the link is made, so a unit retired later stays on its old tickets. It runs
-- as the caller, so equipment they cannot see is refused the same way.

alter type public.ticket_urgency add value if not exists 'low' before 'normal';

create or replace view public.v_category_equipment_counts
with (security_invoker = true) as
select
  e.restaurant_id,
  e.category_id,
  count(distinct e.id)::int as equipment_count,
  count(t.id) filter (where t.status <> 'closed')::int as open_ticket_count
from public.equipment e
left join public.tickets t on t.equipment_id = e.id
where e.retired_at is null
group by e.restaurant_id, e.category_id;

create or replace function public.tickets_equipment_here()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.equipment_id is not null and not exists (
    select 1 from public.equipment e
    where e.id = new.equipment_id and e.restaurant_id = new.restaurant_id and e.retired_at is null
  ) then
    raise exception 'this equipment is not available at this restaurant' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.tickets_equipment_here() from public, anon;

create trigger tickets_equipment_here before insert or update of equipment_id on public.tickets
  for each row execute function public.tickets_equipment_here();

-- OT-104: the walkthrough home's bar splits what is done by how it ended, as the board
-- draws it: Good, an in-house fix, or a ticket. The view already counts tickets and fixes;
-- these count items, each once: an item with a ticket counts as a ticket whatever else it
-- has, one with a fix and no ticket as in-house, and the rest of the done ones as Good.
-- Added at the end, so the view's other columns stay as they were.

create or replace view public.v_walkthrough_progress
with (security_invoker = true) as
with items as (
  select w.id as walkthrough_id, s.id as section_id, s.name, s.short_name, s.area, s.sort_order,
         c.result,
         (select count(*)::int from public.tickets k where k.walkthrough_check_id = c.id) as tickets,
         (select count(*)::int from public.inhouse_fixes f where f.check_id = c.id) as fixes
  from public.walkthroughs w
  join public.walkthrough_sections s on s.template_id = w.template_id
  join public.walkthrough_items i on i.section_id = s.id
  left join public.walkthrough_checks c on c.walkthrough_id = w.id and c.item_id = i.id
  where (s.active and i.active) or c.id is not null
)
select walkthrough_id, 'section'::text as kind, section_id, name, short_name, area, sort_order,
       count(*)::int as total,
       (count(*) filter (where result = 'good' or tickets > 0 or fixes > 0))::int as done,
       sum(tickets)::int as tickets,
       sum(fixes)::int as fixes,
       (count(*) filter (where result = 'good' and tickets = 0 and fixes = 0))::int as good_items,
       (count(*) filter (where fixes > 0 and tickets = 0))::int as inhouse_items,
       (count(*) filter (where tickets > 0))::int as ticket_items
from items
group by walkthrough_id, section_id, name, short_name, area, sort_order
union all
select w.id, 'quarterly', null, null, null, null, 1000,
       count(*)::int, (count(*) filter (where q.done))::int, sum(q.tickets)::int, sum(q.fixes)::int,
       (count(*) filter (where q.done and q.tickets = 0 and q.fixes = 0))::int,
       (count(*) filter (where q.fixes > 0 and q.tickets = 0))::int,
       (count(*) filter (where q.tickets > 0))::int
from public.walkthroughs w
cross join lateral public.walkthrough_quarter_tasks(w.id) q
group by w.id;

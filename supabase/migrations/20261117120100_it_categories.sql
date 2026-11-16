-- OT-115: IT's categories, from the ops manager (Nov 16, 2026): POS & network, Website,
-- and Software, which covers the bill payment software and anything like it. POS &
-- network is new, not the old POS & tech come back: that one was deleted, or turned off
-- where something used it (OT-91), and stays as it is. A group that already has a
-- category by one of these names in IT keeps its own.

insert into public.categories (id, name, area, sort_order)
select v.id::uuid, v.name, 'it', v.sort_order
from (values
  ('33333333-3333-4333-8333-000000000021', 'POS & network', 1),
  ('33333333-3333-4333-8333-000000000022', 'Website',       2),
  ('33333333-3333-4333-8333-000000000023', 'Software',      3)
) as v (id, name, sort_order)
where not exists (
  select 1 from public.categories c where c.area = 'it' and lower(c.name) = lower(v.name)
)
on conflict do nothing;

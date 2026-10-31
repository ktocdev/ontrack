-- OT-25: the design's categories, for every deployment.
--
-- A ticket needs a category, and these lived only in seed.sql, which never runs
-- on a hosted project, so nobody there could create a ticket. Nothing in the app
-- changes this list yet; turning one off or adding one is saved for later, and
-- until then it takes a new migration. The ids are fixed so the seed's equipment
-- and tickets can name them. Anything already there is left alone.

insert into public.categories (id, name, area, sort_order) values
  ('33333333-3333-4333-8333-000000000001', 'Lighting',           'foh', 1),
  ('33333333-3333-4333-8333-000000000002', 'Plumbing',           'foh', 2),
  ('33333333-3333-4333-8333-000000000003', 'Electrical',         'foh', 3),
  ('33333333-3333-4333-8333-000000000004', 'Decorations',        'foh', 4),
  ('33333333-3333-4333-8333-000000000005', 'Furniture',          'foh', 5),
  ('33333333-3333-4333-8333-000000000006', 'HVAC',               'foh', 6),
  ('33333333-3333-4333-8333-000000000007', 'Audio & video',      'foh', 7),
  ('33333333-3333-4333-8333-000000000008', 'POS & tech',         'foh', 8),
  ('33333333-3333-4333-8333-000000000011', 'Cooking',            'boh', 1),
  ('33333333-3333-4333-8333-000000000012', 'Refrigeration',      'boh', 2),
  ('33333333-3333-4333-8333-000000000013', 'Plumbing',           'boh', 3),
  ('33333333-3333-4333-8333-000000000014', 'Electrical',         'boh', 4),
  ('33333333-3333-4333-8333-000000000015', 'Lighting',           'boh', 5),
  ('33333333-3333-4333-8333-000000000016', 'Dishwashing',        'boh', 6),
  ('33333333-3333-4333-8333-000000000017', 'Ventilation',        'boh', 7),
  ('33333333-3333-4333-8333-000000000018', 'Storage & shelving', 'boh', 8)
on conflict do nothing;

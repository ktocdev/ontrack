-- Phase 1, OT-10: the Roles & rights defaults belong to the schema.
--
-- They were only in seed.sql, and the hosted project never runs the seed, so
-- can() answered no for every right there, an admin's invite_users included.
-- Every deployment now starts from the grid on the Roles & rights board. Rows
-- that already exist, such as defaults someone added by hand, are left alone.

insert into public.rights (role, key, allowed)
select r.role::public.app_role, k.key, k.v[array_position(array['manager','ops','leadership','admin'], r.role)]
from (values
  ('create_tickets',           array[true,  true,  false, false]),
  ('see_all_tickets',          array[false, true,  true,  true ]),
  ('update_status',            array[false, true,  false, false]),
  ('log_cost',                 array[false, true,  false, false]),
  ('see_costs',                array[false, true,  true,  true ]),
  ('edit_equipment',           array[false, true,  false, false]),
  ('see_contractors',          array[false, true,  true,  true ]),
  ('set_walkthrough_schedule', array[false, true,  false, true ]),
  ('invite_users',             array[false, false, false, true ]),
  ('manage_rights',            array[false, false, false, true ])
) as k(key, v)
cross join (values ('manager'), ('ops'), ('leadership'), ('admin')) as r(role)
on conflict do nothing;

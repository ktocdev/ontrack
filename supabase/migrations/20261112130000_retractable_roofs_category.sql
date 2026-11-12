-- OT-91: Retractable roofs & windows replaces POS & tech in Front of House (decided Nov
-- 12, 2026, with the contractor trades): some locations have them, and the POS is not
-- something Ops looks after.
--
-- Not a rename, which would make every unit and ticket filed under POS & tech a roof.
-- By the archive and delete rule, POS & tech is deleted where nothing uses it and
-- turned off where something does, so those units and tickets keep their category
-- until Ops moves them. Logged with no actor, as a migration's own change.

insert into public.categories (id, name, area, sort_order)
select '33333333-3333-4333-8333-000000000009', 'Retractable roofs & windows', 'foh', 8
where not exists (
  select 1 from public.categories where area = 'foh' and lower(name) = 'retractable roofs & windows'
)
on conflict do nothing;

update public.categories
set sort_order = 9
where id = '33333333-3333-4333-8333-000000000008';

do $$
declare
  v_id constant uuid := '33333333-3333-4333-8333-000000000008';
begin
  if not exists (select 1 from public.categories where id = v_id) then
    return;
  end if;
  if public.category_in_use(v_id) then
    update public.categories set active = false where id = v_id;
    insert into public.audit_log (action, meta)
    values ('category.turn_off', jsonb_build_object('category_id', v_id, 'name', 'POS & tech', 'by', 'migration'));
  else
    insert into public.audit_log (action, meta)
    values ('category.delete', jsonb_build_object('category_id', v_id, 'name', 'POS & tech', 'by', 'migration'));
    delete from public.categories where id = v_id;
  end if;
end;
$$;

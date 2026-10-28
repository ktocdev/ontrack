-- OnTrack schema, part 8 of 8: storage buckets and their policies.
-- Files live under the id of the row they belong to, so a path alone says
-- who may see it:
--   ticket-photos/<ticket_id>/<uuid>.jpg
--   invoices/<service_record_id>/<filename>.pdf
--   manuals/<equipment_id>/<filename>.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ticket-photos', 'ticket-photos', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('invoices', 'invoices', false, 26214400,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('manuals', 'manuals', false, 52428800,
    array['application/pdf'])
on conflict (id) do nothing;

-- A path's first folder as a uuid, or null if it is not one.
create or replace function public.path_uuid(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.equipment_restaurant(eid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.equipment where id = eid;
$$;
revoke all on function public.equipment_restaurant(uuid) from public;
grant execute on function public.equipment_restaurant(uuid) to authenticated, service_role;

-- Ticket photos: anyone who can see the ticket can see them; anyone who can
-- see the ticket can add one (the thread policy decides who may post).
create policy "ticket photos: read with ticket" on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-photos' and public.can_see_ticket(public.path_uuid(name)));
create policy "ticket photos: upload with ticket" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and owner_id = auth.uid()::text
    and public.can_see_ticket(public.path_uuid(name))
  );

-- Invoices: see_costs to read, log_cost to write, at the ticket's restaurant.
create policy "invoices: read with see_costs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and public.can('see_costs', public.service_record_restaurant(public.path_uuid(name)))
  );
create policy "invoices: write with log_cost" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'invoices'
    and public.can('log_cost', public.service_record_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'invoices'
    and public.can('log_cost', public.service_record_restaurant(public.path_uuid(name)))
  );

-- Manuals: visible within scope; replaced only with edit_equipment.
create policy "manuals: read in scope" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'manuals'
    and public.has_scope(public.equipment_restaurant(public.path_uuid(name)))
  );
create policy "manuals: write with edit_equipment" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'manuals'
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  )
  with check (
    bucket_id = 'manuals'
    and public.can('edit_equipment', public.equipment_restaurant(public.path_uuid(name)))
  );

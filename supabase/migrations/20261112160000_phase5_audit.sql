-- Fixes from the Phase 5 security pass (OT-97).
--
-- 1. An invoice file is part of the record, so it is added and never changed or removed.
--    The invoices bucket's write rule was "for all" with log_cost, which also covers
--    update, delete and select. So anyone with log_cost could overwrite an attached
--    invoice (the app did, when a Replace had the same file name as the old one), move
--    it, or remove it through the Storage API with nothing in the log and the record
--    still saying Attached; and someone with log_cost but See costs switched off could
--    read every invoice file at that restaurant. Writing is now insert only; reading
--    stays with see_costs. The app gives each upload its own folder under the record's,
--    so a new file never needs the old one's name.
--
-- 2. invoice_number_once refuses a number the contractor already has and names the
--    other visit in the refusal's detail. Contractors are the group's, so that visit can
--    be at a restaurant the caller can't see costs at: a manager granted log_cost at one
--    restaurant, or an Ops manager narrowed to some, was handed its id. The number is
--    still refused, since it is one bill; the detail is given only with see_costs at
--    the other visit's restaurant, and the app already says less when there is none.
--
-- 3. A contractor's email becomes the Email button's mailto: link. The shape check took
--    anything around an @ and a dot, so "a@b.co?cc=x%40y.z" was saved, and the button
--    would then copy someone else in on every email sent from it. Only Ops and admins
--    save contractors, so this needed a trusted person; the check now takes an address
--    and nothing more. Not valid, so a row already saved doesn't stop this migration;
--    it is checked on the next save, and the app links only an address of this shape.

-- 1. Invoice files ----------------------------------------------------------------------

drop policy "invoices: write with log_cost" on storage.objects;
create policy "invoices: add with log_cost" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and public.service_record_restaurant(public.path_uuid(name)) is not null
    and public.can('log_cost', public.service_record_restaurant(public.path_uuid(name)))
  );

-- 2. The refusal's detail ---------------------------------------------------------------

create or replace function public.invoice_number_once()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_contractor uuid;
  v_other uuid;
  v_other_restaurant uuid;
begin
  if new.number is null then
    return new;
  end if;
  select contractor_id into v_contractor from public.service_records where id = new.service_record_id;
  if v_contractor is null then
    return new;
  end if;

  select i.service_record_id, s.restaurant_id into v_other, v_other_restaurant
  from public.invoices i
  join public.service_records s on s.id = i.service_record_id
  where s.contractor_id = v_contractor
    and lower(btrim(i.number)) = lower(btrim(new.number))
    and i.service_record_id <> new.service_record_id
  limit 1;

  if v_other is null then
    return new;
  end if;
  if public.can('see_costs', v_other_restaurant) then
    raise exception 'this invoice number is already logged for this contractor'
      using errcode = '23505', detail = v_other::text;
  end if;
  raise exception 'this invoice number is already logged for this contractor' using errcode = '23505';
end;
$$;

revoke all on function public.invoice_number_once() from public, anon;

-- 3. A contractor's email ---------------------------------------------------------------

alter table public.contractors
  drop constraint contractors_email_shape,
  add constraint contractors_email_shape
    check (email is null or email ~ '^[A-Za-z0-9._+''-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$') not valid;

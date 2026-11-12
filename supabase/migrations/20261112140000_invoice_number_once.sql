-- OT-92: an invoice number is logged once per contractor, as the save-failed board draws
-- it ("CL-19877 is already logged on OT-0988"). A second visit with the same number is
-- almost always the same bill typed twice, which would count its cost twice.
--
-- Checked on every write of an invoice row, so log_service, update_service_record (which
-- can change the contractor as well as the number) and attach_invoice are all covered,
-- ignoring case and spaces at the ends. In-house work has no contractor and no check.
-- The refusal's detail names the other record, so the app can say which visit has it;
-- the message alone tells the caller nothing they couldn't already read with see_costs.

create or replace function public.invoice_number_once()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_contractor uuid;
  v_other uuid;
begin
  if new.number is null then
    return new;
  end if;
  select contractor_id into v_contractor from public.service_records where id = new.service_record_id;
  if v_contractor is null then
    return new;
  end if;

  select i.service_record_id into v_other
  from public.invoices i
  join public.service_records s on s.id = i.service_record_id
  where s.contractor_id = v_contractor
    and lower(btrim(i.number)) = lower(btrim(new.number))
    and i.service_record_id <> new.service_record_id
  limit 1;

  if v_other is not null then
    raise exception 'this invoice number is already logged for this contractor'
      using errcode = '23505', detail = v_other::text;
  end if;
  return new;
end;
$$;

revoke all on function public.invoice_number_once() from public, anon;

create trigger invoices_number_once before insert or update of number, service_record_id on public.invoices
  for each row execute function public.invoice_number_once();

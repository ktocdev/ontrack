-- OT-28: ticket photos.
--
-- A photo's file follows its note. The file policy only asked whether you could see
-- the ticket, so anyone who could list the ticket's folder could open a photo on an
-- internal note they cannot read. can_see_ticket_photo() is security definer because
-- RLS hides those notes from the very people it has to check.
--
-- Leadership reads and does not write. The thread and photo policies only asked
-- whether you could see the ticket, and leadership sees them all.
--
-- A photo row must name a file in its own ticket's folder, and hang on that ticket's
-- update, written by the person adding it.
--
-- post_ticket_update() posts a message and its photos in one step, so a failure
-- leaves neither. A message may be only photos, so its body may be empty.

alter table public.ticket_photos
  add constraint ticket_photos_path_in_ticket check (path like ticket_id::text || '/%');

create or replace function public.can_see_ticket_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_ticket(public.path_uuid(p_name))
    and not exists (
      select 1
      from public.ticket_photos p
      join public.ticket_updates u on u.id = p.update_id
      where p.path = p_name
        and u.internal
        and u.author_id is distinct from auth.uid()
        and public.my_role() is distinct from 'ops'
    );
$$;

revoke all on function public.can_see_ticket_photo(text) from public, anon;
grant execute on function public.can_see_ticket_photo(text) to authenticated, service_role;

drop policy "ticket photos: read with ticket" on storage.objects;
create policy "ticket photos: read with ticket" on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-photos' and public.can_see_ticket_photo(name));

drop policy "ticket photos: upload with ticket" on storage.objects;
create policy "ticket photos: upload with ticket" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and owner_id = auth.uid()::text
    and public.can_see_ticket(public.path_uuid(name))
    and public.my_role() is distinct from 'leadership'
  );

drop policy ticket_updates_insert on public.ticket_updates;
create policy ticket_updates_insert on public.ticket_updates
  for insert to authenticated
  with check (
    kind = 'message'
    and author_id = auth.uid()
    and public.can_see_ticket(ticket_id)
    and (not internal or public.my_role() = 'ops')
    and public.my_role() is distinct from 'leadership'
  );

drop policy ticket_photos_insert on public.ticket_photos;
create policy ticket_photos_insert on public.ticket_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_see_ticket(ticket_id)
    and public.my_role() is distinct from 'leadership'
    and (
      update_id is null
      or exists (
        select 1 from public.ticket_updates u
        where u.id = update_id and u.ticket_id = ticket_photos.ticket_id and u.author_id = auth.uid()
      )
    )
  );

create or replace function public.post_ticket_update(p_ticket_id uuid, p_body text, p_paths text[] default '{}')
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_body), '') is null and coalesce(cardinality(p_paths), 0) = 0 then
    raise exception 'an update needs words or a photo' using errcode = '22023';
  end if;

  insert into public.ticket_updates (ticket_id, author_id, body)
  values (p_ticket_id, auth.uid(), coalesce(btrim(p_body), ''))
  returning id into v_id;

  insert into public.ticket_photos (ticket_id, update_id, path, created_by)
  select p_ticket_id, v_id, path, auth.uid()
  from unnest(coalesce(p_paths, '{}')) as path;

  return v_id;
end;
$$;

revoke all on function public.post_ticket_update(uuid, text, text[]) from public, anon;
grant execute on function public.post_ticket_update(uuid, text, text[]) to authenticated;

-- OT-40: an update can be an internal note, with its photos in one step, as any other
-- update is. The insert policy still decides who may write one (Ops only), and
-- can_see_ticket_photo() keeps its photos from anyone who can't read the note.

drop function public.post_ticket_update(uuid, text, text[]);

create function public.post_ticket_update(
  p_ticket_id uuid,
  p_body text,
  p_paths text[] default '{}',
  p_internal boolean default false
)
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

  insert into public.ticket_updates (ticket_id, author_id, body, internal)
  values (p_ticket_id, auth.uid(), coalesce(btrim(p_body), ''), p_internal)
  returning id into v_id;

  insert into public.ticket_photos (ticket_id, update_id, path, created_by)
  select p_ticket_id, v_id, path, auth.uid()
  from unnest(coalesce(p_paths, '{}')) as path;

  return v_id;
end;
$$;

revoke all on function public.post_ticket_update(uuid, text, text[], boolean) from public, anon;
grant execute on function public.post_ticket_update(uuid, text, text[], boolean) to authenticated;

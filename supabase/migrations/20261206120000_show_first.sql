-- Show first (OT-174, from feedback Nov 24, 2026): inside each restaurant on a list of
-- tickets, urgent ones come first, then one area's, then the other areas in their usual
-- order (Front of House, Back of House, IT), oldest first within each. Which area comes
-- first is the person's own and follows them from phone to laptop, so it is kept here
-- rather than on the device; it starts from their job title.
--
-- 1. job_titles.first_area: the area a title starts people on, Front of House unless
--    an admin picks another on the Job titles sheet. The IT title starts on IT.
-- 2. first_area_prefs: a person's own choice, one row each, kept only while it differs
--    from what their title gives (the app deletes the row instead). Read and written by
--    the person, read by admins for View as, like area_prefs.
-- 3. Giving a title (apply_job_title_view) also clears the person's own choice, as it
--    replaces their area settings, so they start from the new title's first area. A row
--    that is absent follows the title as it is now, so editing a title's first area moves
--    everyone who never picked their own; that is the one setting that follows the title.
-- 4. add_job_title and save_job_title take the first area, logged with the rest.

-- ---------------------------------------------------------------------------
-- 1. A title's first area
-- ---------------------------------------------------------------------------

alter table public.job_titles add column first_area public.area not null default 'foh';

-- The IT title from the job titles migration (OT-117).
update public.job_titles set first_area = 'it' where id = 'eeeeeeee-eeee-4eee-8eee-000000000004';

-- ---------------------------------------------------------------------------
-- 2. A person's own
-- ---------------------------------------------------------------------------

create table public.first_area_prefs (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  area       public.area not null,
  updated_at timestamptz not null default now()
);

alter table public.first_area_prefs enable row level security;

create policy first_area_prefs_read on public.first_area_prefs
  for select to authenticated
  using ((user_id = auth.uid() and public.my_role() is not null) or public.is_admin());
create policy first_area_prefs_insert on public.first_area_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy first_area_prefs_update on public.first_area_prefs
  for update to authenticated
  using (user_id = auth.uid() and public.my_role() is not null)
  with check (user_id = auth.uid() and public.my_role() is not null);
create policy first_area_prefs_delete on public.first_area_prefs
  for delete to authenticated
  using (user_id = auth.uid() and public.my_role() is not null);

revoke all on public.first_area_prefs from anon;
grant select, insert, update, delete on public.first_area_prefs to authenticated;

create trigger first_area_prefs_touch before insert or update on public.first_area_prefs
  for each row execute function public.prefs_touch();

-- ---------------------------------------------------------------------------
-- 3. Giving a title starts the person from it
-- ---------------------------------------------------------------------------

create or replace function public.apply_job_title_view(p_user uuid, p_title uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.area_prefs where user_id = p_user;
  insert into public.area_prefs (user_id, area, notify, shown)
  select p_user, area, notify, shown from public.job_title_areas where job_title_id = p_title;
  delete from public.first_area_prefs where user_id = p_user;
$$;
revoke all on function public.apply_job_title_view(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The Job titles sheet sets it
-- ---------------------------------------------------------------------------

drop function public.add_job_title(text, jsonb);
drop function public.save_job_title(uuid, text, jsonb);

create function public.add_job_title(p_name text, p_view jsonb, p_first_area public.area default 'foh')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can add a job title' using errcode = '42501';
  end if;
  if public.job_title_name_taken(p_name, null) then
    raise exception 'that job title already exists' using errcode = '23505';
  end if;

  insert into public.job_titles (name, sort_order, first_area)
  values (btrim(p_name), coalesce((select max(sort_order) + 1 from public.job_titles), 1),
          coalesce(p_first_area, 'foh'))
  returning id into v_id;
  perform public.job_title_write_view(v_id, p_view);

  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'job_title.add',
    jsonb_build_object('job_title_id', v_id, 'name', btrim(p_name), 'view', public.job_title_view(v_id),
      'first_area', coalesce(p_first_area, 'foh')));
  return v_id;
end;
$$;

-- Renames a title and sets its starting view and first area. People who have it keep
-- their area settings; those who never picked their own first area follow the new one.
-- A null first area leaves it as it is.
create function public.save_job_title(p_id uuid, p_name text, p_view jsonb, p_first_area public.area default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.job_titles;
  v_from jsonb;
  v_to jsonb;
  v_first public.area;
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a job title' using errcode = '42501';
  end if;
  select * into t from public.job_titles where id = p_id for update;
  if t.id is null then
    raise exception 'no such job title' using errcode = 'P0002';
  end if;
  if public.job_title_name_taken(p_name, p_id) then
    raise exception 'that job title already exists' using errcode = '23505';
  end if;

  v_first := coalesce(p_first_area, t.first_area);
  v_from := public.job_title_view(p_id);
  update public.job_titles set name = btrim(p_name), first_area = v_first where id = p_id;
  perform public.job_title_write_view(p_id, p_view);
  v_to := public.job_title_view(p_id);

  if t.name = btrim(p_name) and v_from = v_to and t.first_area = v_first then
    return;
  end if;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'job_title.save', jsonb_build_object(
    'job_title_id', p_id, 'from', t.name, 'to', btrim(p_name), 'view_from', v_from, 'view_to', v_to,
    'first_area_from', t.first_area, 'first_area_to', v_first));
end;
$$;

revoke all on function public.add_job_title(text, jsonb, public.area) from public, anon;
grant execute on function public.add_job_title(text, jsonb, public.area) to authenticated;
revoke all on function public.save_job_title(uuid, text, jsonb, public.area) from public, anon;
grant execute on function public.save_job_title(uuid, text, jsonb, public.area) to authenticated;

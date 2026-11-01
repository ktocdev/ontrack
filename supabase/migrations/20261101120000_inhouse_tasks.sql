-- OT-30: the In-house tab. A manager checks a task off, unchecks it, and deletes it
-- while it is still open.
--
-- Front / Back need an area, and a quarterly task's label doesn't say which, so the
-- task carries it. Null counts only under All.
--
-- Delete is permanent, as the board says, and the audit log keeps what was deleted.
-- That replaces deleted_at, which would keep the row counting as history against the
-- restaurant and the person long after it was gone.
--
-- The open write policy let anyone with create_tickets change any column or delete a
-- checked-off task. Tasks are now added by insert and changed only through these two
-- functions. They run as definer because a manager can't write audit_log, and a delete
-- the API could reach directly would skip the log; each checks the caller first.
-- Phase 6 adds what it needs for Convert to ticket.

alter table public.inhouse_fixes add column area public.area;

drop index public.inhouse_fixes_restaurant_idx;
alter table public.inhouse_fixes drop column deleted_at;
create index inhouse_fixes_restaurant_idx on public.inhouse_fixes (restaurant_id);

drop policy inhouse_fixes_write on public.inhouse_fixes;
create policy inhouse_fixes_insert on public.inhouse_fixes
  for insert to authenticated
  with check (
    public.can('create_tickets', restaurant_id)
    and created_by = auth.uid()
    and done_at is null
    and done_by is null
  );

create or replace function public.set_inhouse_fix_done(p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.inhouse_fixes where id = p_id;
  if v_restaurant is null or not public.can('create_tickets', v_restaurant) then
    raise exception 'you can''t change this task' using errcode = '42501';
  end if;

  update public.inhouse_fixes
  set done_at = case when p_done then now() end,
      done_by = case when p_done then auth.uid() end
  where id = p_id and (done_at is not null) <> p_done;
end;
$$;

create or replace function public.delete_inhouse_fix(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.inhouse_fixes;
begin
  select * into f from public.inhouse_fixes where id = p_id for update;
  if f.id is null or not public.can('create_tickets', f.restaurant_id) then
    raise exception 'you can''t delete this task' using errcode = '42501';
  end if;
  if f.done_at is not null then
    raise exception 'a checked-off task stays on the record' using errcode = '23514';
  end if;

  insert into public.audit_log (actor_id, action, target_restaurant_id, meta)
  values (auth.uid(), 'inhouse_fix.delete', f.restaurant_id,
          jsonb_build_object('title', f.title, 'origin', f.origin_label));

  delete from public.inhouse_fixes where id = p_id;
end;
$$;

revoke all on function public.set_inhouse_fix_done(uuid, boolean) from public, anon;
grant execute on function public.set_inhouse_fix_done(uuid, boolean) to authenticated;
revoke all on function public.delete_inhouse_fix(uuid) from public, anon;
grant execute on function public.delete_inhouse_fix(uuid) to authenticated;

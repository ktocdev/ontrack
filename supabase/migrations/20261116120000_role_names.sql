-- OT-114: the roles' names are the group's (planned in OT-112 and OT-113, Nov 16, 2026).
--
-- A role is a default set of rights and stays one of the four in `app_role`; what people
-- see it called is data, so this group can say Reporter and Support Team and another group
-- something else, with no code change. Each role has a name, shown wherever the app names
-- the role or beside a person, and a short name for the Roles & rights grid's narrow
-- columns. A role with nothing stored here uses the app's defaults (Manager / Mgr, Ops
-- manager / Ops, Leadership / Lead, Admin), so nothing changes until an admin renames one.
--
-- Like the group's name, it is written only through a function that checks for an admin
-- and logs, never through the API.

create or replace function public.role_names_ok(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1 from jsonb_each(p) e
    where e.key not in ('manager', 'ops', 'leadership', 'admin')
      or jsonb_typeof(e.value) <> 'object'
      or (select count(*) from jsonb_object_keys(e.value)) <> 2
      or jsonb_typeof(e.value -> 'name') <> 'string'
      or jsonb_typeof(e.value -> 'short') <> 'string'
      or char_length(e.value ->> 'name') not between 1 and 30
      or char_length(e.value ->> 'short') not between 1 and 8
      or e.value ->> 'name' <> btrim(e.value ->> 'name')
      or e.value ->> 'short' <> btrim(e.value ->> 'short')
  );
$$;
revoke all on function public.role_names_ok(jsonb) from public, anon;
grant execute on function public.role_names_ok(jsonb) to authenticated, service_role;

alter table public.group_settings
  add column role_names jsonb not null default '{}'::jsonb
  constraint group_settings_role_names_shape check (public.role_names_ok(role_names));

-- The whole set, as the sheet sends it: a name and a short name for any of the four
-- roles, trimmed here; a role left out goes back to the app's default. A bad shape or
-- length is refused by the table's check (23514).
create or replace function public.save_role_names(p_names jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'only an admin can rename the roles' using errcode = '42501';
  end if;
  if p_names is null or jsonb_typeof(p_names) <> 'object' then
    raise exception 'role names are an object of role to name and short name' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(e.key,
           case when jsonb_typeof(e.value) = 'object'
             then jsonb_build_object('name', btrim(e.value ->> 'name'), 'short', btrim(e.value ->> 'short'))
             else e.value end), '{}'::jsonb)
    into v_new
    from jsonb_each(p_names) e;
  select role_names into v_old from public.group_settings;
  update public.group_settings set role_names = v_new where id;
  insert into public.audit_log (actor_id, action, meta)
  values (auth.uid(), 'group.role_names', jsonb_build_object('from', v_old, 'to', v_new));
end;
$$;
revoke all on function public.save_role_names(jsonb) from public, anon;
grant execute on function public.save_role_names(jsonb) to authenticated;

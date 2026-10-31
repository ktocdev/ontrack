-- Phase 1, OT-22: signed-out visitors run no database functions.
--
-- The only thing they read is group_settings, which needs none. Yet Supabase's default
-- privileges grant anon every new function in public, and revoking from public alone,
-- as the early migrations do, doesn't touch that grant. The damage was small (the audit
-- could map an equipment id to its restaurant id), but nothing should be open by accident.
--
-- Triggers are not affected: Postgres checks EXECUTE when a trigger is created, not when
-- it fires. Authenticated and service_role have their own grants, so they keep what they
-- have. New functions start open to anon again, since Postgres can only change that
-- default globally; 18_anon_functions.test.sql fails CI on any that are left open.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;

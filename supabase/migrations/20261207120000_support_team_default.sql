-- OT-176: Support Team as a new group's name for the Ops role (from feedback, Nov 24, 2026).
--
-- The roles' names are the group's (OT-114), and a role with none stored reads as the boards
-- draw it ("Ops"). This group calls Ops the Support Team, and its live app had no names
-- saved, so Admin tickets read "View only · Ops manages tickets". A new group now starts with
-- Support Team (short name Support), and a group with no Ops name saved takes it; a name an
-- admin saved stays. Like any name, an admin changes it on Roles & rights. No code names it:
-- it is data, in the column's default.

alter table public.group_settings
  alter column role_names set default '{"ops": {"name": "Support Team", "short": "Support"}}'::jsonb;

update public.group_settings
set role_names = role_names || '{"ops": {"name": "Support Team", "short": "Support"}}'::jsonb
where not role_names ? 'ops';

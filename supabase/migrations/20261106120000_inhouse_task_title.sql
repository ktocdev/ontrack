-- OT-83: a manager adds an in-house task by hand, from the In-house tab, as well as
-- from a walkthrough. The insert policy from OT-30 already allows it; what a person
-- types now needs the same bound as a ticket's title, and blank isn't a task.

alter table public.inhouse_fixes
  add constraint inhouse_fixes_title_length check (length(btrim(title)) between 1 and 140);

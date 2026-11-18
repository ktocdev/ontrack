-- A delivery of a task from Ops (OT-128) is about the task alone when it has no ticket (Add
-- task), but the log's constraint wanted a ticket or a walkthrough, so send-push's log of it
-- was refused and nothing showed it went out (found in OT-131). A delivery is now about a
-- walkthrough alone, or a ticket, a task, or both. Like a ticket's, a deleted task takes its
-- deliveries with it, as its notification already does.

alter table public.notification_deliveries drop constraint notification_deliveries_about_one;
alter table public.notification_deliveries add constraint notification_deliveries_about_one check (
  case
    when walkthrough_id is not null then ticket_id is null and inhouse_fix_id is null
    else ticket_id is not null or inhouse_fix_id is not null
  end
);

alter table public.notification_deliveries drop constraint notification_deliveries_inhouse_fix_id_fkey;
alter table public.notification_deliveries add constraint notification_deliveries_inhouse_fix_id_fkey
  foreign key (inhouse_fix_id) references public.inhouse_fixes (id) on delete cascade;

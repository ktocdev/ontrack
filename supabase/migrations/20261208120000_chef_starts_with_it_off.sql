-- OT-177: Chef starts with IT off (from feedback, Nov 24, 2026).
--
-- A title's starting view (OT-117) is written over someone's area settings once, when the title
-- is given. Chefs file kitchen tickets and have no use for IT's, so Chef now starts with IT off
-- on Notify and hidden from their lists, as Front of House already is. Editing a title changes
-- nobody who already has it, and the live app has no chefs yet, so nobody is moved.
--
-- Chef is matched by the fixed id OT-117 gave it, so a rename still finds it, and a title an
-- admin deleted gets nothing. An IT setting an admin already saved on it stays.

insert into public.job_title_areas (job_title_id, area, notify, shown)
select id, 'it', 'off', false
from public.job_titles
where id = 'eeeeeeee-eeee-4eee-8eee-000000000002'
on conflict (job_title_id, area) do nothing;

-- OT-56: v_closed_by_month cut months in UTC and nothing reads it. Closed tickets uses
-- closed_by_month(), which cuts them in the person's own time zone (20261102120000).

drop view public.v_closed_by_month;

-- Phase 1, OT-10: the restaurant group's name is data, not code.
--
-- One deployment serves one group, so this is a single row. It starts neutral so
-- a new deployment never inherits another group's name; the seed and, on a hosted
-- project, one update after the first deploy set the real one. Anyone may read
-- it, signed in or not, because Checking your invite shows it before sign-in.
-- Nobody writes it through the API yet; OT-14 adds an admin function.

create table public.group_settings (
  id          boolean primary key default true check (id),
  name        text not null default 'OnTrack' check (char_length(btrim(name)) between 1 and 80),
  short_name  text check (short_name is null or char_length(btrim(short_name)) between 1 and 12),
  updated_at  timestamptz not null default now()
);

create trigger group_settings_updated_at before update on public.group_settings
  for each row execute function public.set_updated_at();

insert into public.group_settings default values;

alter table public.group_settings enable row level security;

create policy group_settings_select on public.group_settings
  for select to anon, authenticated
  using (true);

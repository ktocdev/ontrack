-- Phase 1, OT-6: profile photos and Report a problem.
--
-- Profile photos live in a private bucket under the owner's id:
--   avatars/<user_id>/<uuid>.jpg
-- Everyone signed in may see them (they show beside names on tickets); only
-- the owner may add, replace or remove their own. profiles.avatar_path points
-- at the current one. protect_profile_columns already lets people edit their
-- own row apart from role, restaurant, email and status, so no change there.

alter table public.profiles add column avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: read when active" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.my_role() is not null);
create policy "avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.my_role() is not null
    and public.path_uuid(name) = auth.uid()
    and owner_id = auth.uid()::text
  );
create policy "avatars: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text)
  with check (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text);
create policy "avatars: owner removes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid() and owner_id = auth.uid()::text);

-- Report a problem. Saved here first; OT-8's send-email function forwards new
-- rows to the support inbox and stamps emailed_at. The reporter sees their own
-- reports (for the case number); admins see all. Nobody edits or deletes one.
create table public.support_reports (
  id           uuid primary key default gen_random_uuid(),
  case_no      bigint generated always as identity (start with 4800) unique,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  page         text check (char_length(page) <= 500),
  app_version  text check (char_length(app_version) <= 40),
  user_agent   text check (char_length(user_agent) <= 500),
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index support_reports_unsent on public.support_reports (created_at) where emailed_at is null;

alter table public.support_reports enable row level security;

create policy support_reports_insert on public.support_reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() is not null and emailed_at is null);
create policy support_reports_select on public.support_reports
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

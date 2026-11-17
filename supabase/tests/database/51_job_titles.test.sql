-- Job titles (OT-117): the group's list, changed only by an admin and logged; a title given
-- through set_person_access or an invite, and its starting view written once.
begin;
select plan(30);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- "area:notify:shown" for each of someone's area settings.
create function pg_temp.view_of(p_user uuid) returns text[] language plpgsql as $$
declare
  v text[];
begin
  perform set_config('role', 'postgres', true);
  select coalesce(array_agg(area::text || ':' || notify::text || ':' || shown::text order by area), '{}') into v
  from public.area_prefs where user_id = p_user;
  return v;
end $$;

\set gm '''eeeeeeee-eeee-4eee-8eee-000000000001'''
\set chef '''eeeeeeee-eeee-4eee-8eee-000000000002'''
\set opsmgr '''eeeeeeee-eeee-4eee-8eee-000000000003'''
\set it '''eeeeeeee-eeee-4eee-8eee-000000000004'''
\set maya '''22222222-2222-4222-8222-000000000001'''
\set dana '''22222222-2222-4222-8222-000000000007'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set porter '''11111111-1111-4111-8111-000000000003'''

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------

select pg_temp.login('dana.ortiz@example.com');
select is((select array_agg(name order by sort_order) from public.job_titles),
  array['General manager', 'Chef', 'Ops manager', 'IT'], 'anyone signed in reads the four titles');
select is((select count(*)::int from public.job_title_areas), 4, 'and their starting views');
select throws_ok($$ insert into public.job_titles (name, sort_order) values ('Sous chef', 9) $$, '42501', null,
  'nobody writes the list directly');
select throws_ok($$ select public.add_job_title('Sous chef', '{}') $$, '42501', null, 'a manager adds no title');
select pg_temp.login('bert.velilla@example.com');
select throws_ok($$ select public.add_job_title('Sous chef', '{}') $$, '42501', null, 'nor does Ops');
set local role anon;
select throws_ok($$ select * from public.job_titles $$, '42501', null, 'signed out reads nothing');

select pg_temp.login('admin@example.com');
select lives_ok($$ select public.add_job_title(' Sous chef ', '{"foh": {"notify": "urgent"}, "it": {"notify": "all", "shown": true}}') $$,
  'an admin adds one');
select is((select name from public.job_titles order by sort_order desc limit 1), 'Sous chef', 'trimmed, at the end');
select is((select array_agg(area::text || ':' || notify::text || ':' || shown::text) from public.job_title_areas a
  join public.job_titles t on t.id = a.job_title_id where t.name = 'Sous chef'), array['foh:urgent:true'],
  'keeping only the areas off the defaults');
select is((select action from public.audit_log order by created_at desc, id desc limit 1), 'job_title.add', 'logged');
select throws_ok($$ select public.add_job_title('chef', '{}') $$, '23505', null, 'a name already there is refused');
select throws_ok($$ select public.add_job_title('Porter', '{"patio": {"notify": "off"}}') $$, '22023', null,
  'and an area that doesn''t exist');

select lives_ok(format($$ select public.save_job_title(%L, 'Head chef', '{"foh": {"notify": "off", "shown": false}, "boh": {"notify": "urgent"}}') $$, :chef),
  'an admin renames one and changes its view');
select is((select count(*)::int from public.job_title_areas where job_title_id = (:chef)::uuid), 2, 'the view is replaced');
select is((select meta ->> 'to' from public.audit_log where action = 'job_title.save' order by created_at desc limit 1),
  'Head chef', 'logged');

-- ---------------------------------------------------------------------------
-- Giving a title
-- ---------------------------------------------------------------------------

-- Dana has a setting of her own on IT; Head chef replaces her area settings.
select pg_temp.login('dana.ortiz@example.com');
insert into public.area_prefs (user_id, area, notify) values (auth.uid(), 'it', 'urgent');
insert into public.category_prefs (user_id, category_id, notify) values (auth.uid(), '33333333-3333-4333-8333-000000000012', 'off');
select throws_ok(format($$ update public.profiles set job_title_id = %L where id = auth.uid() $$, :chef), '42501', null,
  'nobody gives themselves a title');

select pg_temp.login('admin@example.com');
select throws_ok(format($$ update public.profiles set job_title_id = %L where id = %L $$, :chef, :dana), '42501', null,
  'and an admin gives one only through set_person_access');
select lives_ok(format($$ select public.set_person_access(%L, 'manager', array[%L]::uuid[], %L) $$, :dana, :porter, :chef),
  'which gives it');
select is(pg_temp.view_of((:dana)::uuid), array['foh:off:false', 'boh:urgent:true'],
  'and writes its starting view over their area settings');
select is((select count(*)::int from public.category_prefs where user_id = (:dana)::uuid), 1, 'leaving their categories');
select is((select meta ->> 'job_title_to' from public.audit_log where action = 'user.access' order by created_at desc limit 1),
  (:chef)::text, 'logged');

-- Keeping the title, or editing it on the list, leaves their settings.
select pg_temp.login('dana.ortiz@example.com');
delete from public.area_prefs where user_id = auth.uid() and area = 'boh';
select pg_temp.login('admin@example.com');
select public.set_person_access((:dana)::uuid, 'manager', array[(:porter)::uuid], (:chef)::uuid);
select public.save_job_title((:chef)::uuid, 'Head chef', '{}');
select is(pg_temp.view_of((:dana)::uuid), array['foh:off:false'], 'keeping a title or editing it changes nobody''s settings');

-- A turned-off title is given to nobody new, but who has it keeps it.
select pg_temp.login('admin@example.com');
select public.set_job_title_active((:chef)::uuid, false);
select lives_ok(format($$ select public.set_person_access(%L, 'manager', array[%L]::uuid[], %L) $$, :dana, :porter, :chef),
  'someone keeps a title that was turned off');
select throws_ok(format($$ select public.set_person_access(%L, 'ops', '{}', %L) $$, :bert, :chef), '22023', null,
  'but nobody new is given it');

-- Delete only while nobody has it.
select throws_ok(format($$ select public.delete_job_title(%L) $$, :chef), '23503', null,
  'a title someone has can''t be deleted');
select public.set_person_access((:dana)::uuid, 'manager', array[(:porter)::uuid], null);
select is(pg_temp.view_of((:dana)::uuid), array['foh:off:false'], 'removing a title leaves their settings');

-- An invite carries a title, and setting up the account gives it with its view.
set local role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.invites (id, email, full_name, role, restaurant_ids, token_hash, invited_by, job_title_id)
values ('88888888-8888-4888-8888-000000000051', 'new.it@example.com', 'New IT', 'ops', '{}', 'hash-51',
  '22222222-2222-4222-8222-000000000006', (:it)::uuid);
select throws_ok(format($$ select public.delete_job_title(%L) $$, :it), '42501', null,
  'only an admin deletes a title');
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-000000000051', 'authenticated', 'authenticated',
  'new.it@example.com', '{"invite_id": "88888888-8888-4888-8888-000000000051"}', '{}');
select is((select job_title_id from public.profiles where id = '22222222-2222-4222-8222-000000000051'), (:it)::uuid,
  'an invite''s title is given when the account is set up');
select is(pg_temp.view_of('22222222-2222-4222-8222-000000000051'), array['foh:off:false', 'boh:off:false'],
  'with its starting view');

select pg_temp.login('admin@example.com');
select lives_ok(format($$ select public.delete_job_title(%L) $$, :chef), 'a title nobody has is deleted');

select * from finish();
rollback;

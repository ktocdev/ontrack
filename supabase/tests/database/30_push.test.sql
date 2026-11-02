-- Push (OT-44): each person reaches only their own devices and switches, a device follows
-- whoever signed in last, and only the browsers' own push services are accepted.
begin;
select plan(17);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

\set phone '''https://fcm.googleapis.com/fcm/send/phone'''
\set bert '''22222222-2222-4222-8222-000000000003'''

select pg_temp.login('bert.velilla@example.com');
select lives_ok(format($$ select public.save_push_subscription(%L, 'key', 'auth') $$, :phone), 'someone saves their device');
select is((select user_id from public.push_subscriptions where endpoint = :phone), (:bert)::uuid, 'and it is theirs');
select lives_ok(format($$ select public.save_push_subscription(%L, 'new-key', 'auth') $$, :phone), 'saving again is fine');
select is((select p256dh from public.push_subscriptions where endpoint = :phone), 'new-key', 'and updates the keys');

-- Only the browsers' push services, so the sender can't be pointed anywhere else.
select throws_ok($$ select public.save_push_subscription('https://evil.example.com/x', 'k', 'a') $$, '23514', null,
  'another address is refused');
select throws_ok($$ select public.save_push_subscription('http://fcm.googleapis.com/x', 'k', 'a') $$, '23514', null,
  'so is one without https');
select throws_ok($$ select public.save_push_subscription('https://fcm.googleapis.com.evil.example.com/x', 'k', 'a') $$, '23514', null,
  'and one that only starts like a push service');
select lives_ok($$ select public.save_push_subscription('https://updates.push.services.mozilla.com/wpush/v2/x', 'k', 'a') $$,
  'Firefox''s service is accepted');
select lives_ok($$ select public.save_push_subscription('https://web.push.apple.com/x', 'k', 'a') $$,
  'and an iPhone''s');

-- Someone else sees and removes nothing, and can't write a row directly.
select pg_temp.login('chris.novak@example.com');
select is((select count(*)::int from public.push_subscriptions), 0, 'nobody reads another person''s devices');
delete from public.push_subscriptions where endpoint = :phone;
select is((select count(*)::int from public.push_subscriptions where user_id = (:bert)::uuid), 0, 'or sees them, even to remove');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), 'https://web.push.apple.com/direct', 'k', 'a') $$, '42501', null, 'rows are not written directly');

-- The same phone, signed in by someone else, follows them.
select lives_ok(format($$ select public.save_push_subscription(%L, 'key', 'auth') $$, :phone), 'a new sign-in takes the device over');
select is((select count(*)::int from public.push_subscriptions where endpoint = :phone), 1, 'and it is theirs now');

-- Switches are each person's own.
insert into public.notification_prefs (user_id, kind, enabled) values (auth.uid(), 'new_ticket', false);
select throws_ok(format($$ insert into public.notification_prefs (user_id, kind, enabled) values (%L, 'update', false) $$, :bert),
  '42501', null, 'nobody sets another person''s switches');

select pg_temp.login('bert.velilla@example.com');
select is((select count(*)::int from public.notification_prefs), 0, 'or reads them');

-- Deactivating someone ends every device of theirs.
select public.save_push_subscription('https://web.push.apple.com/bert', 'k', 'a');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set deactivated_at = now() where id = (:bert)::uuid;
select is((select count(*)::int from public.push_subscriptions where user_id = (:bert)::uuid), 0,
  'a deactivated person''s devices are gone');

select * from finish();
rollback;

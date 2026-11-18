-- The delivery log takes a task from Ops with no ticket (OT-131's fix to OT-128).
begin;
select plan(5);

\set porter '''11111111-1111-4111-8111-000000000003'''
\set bert '''22222222-2222-4222-8222-000000000003'''
\set dana '''22222222-2222-4222-8222-000000000007'''

insert into public.inhouse_fixes (id, restaurant_id, title, area, created_by, from_ops)
values ('99999999-9999-4999-8999-000000000001', :porter, 'A task from Ops', 'foh', :bert, true);
insert into public.notifications (id, inhouse_fix_id, kind, actor_id, processed_at)
values ('99999999-9999-4999-8999-000000000002', '99999999-9999-4999-8999-000000000001', 'inhouse_task', :bert, now());

select lives_ok(
  $$insert into public.notification_deliveries (notification_id, user_id, inhouse_fix_id, kind, channel, status)
    values ('99999999-9999-4999-8999-000000000002', '22222222-2222-4222-8222-000000000007',
            '99999999-9999-4999-8999-000000000001', 'inhouse_task', 'email', 'sent')$$,
  'a task with no ticket is logged as sent'
);

select throws_ok(
  $$insert into public.notification_deliveries (notification_id, user_id, kind, channel, status)
    values ('99999999-9999-4999-8999-000000000002', '22222222-2222-4222-8222-000000000007', 'inhouse_task', 'email', 'sent')$$,
  '23514', null, 'a delivery about nothing is refused'
);

select throws_ok(
  $$insert into public.notification_deliveries (notification_id, user_id, inhouse_fix_id, walkthrough_id, kind, channel, status)
    values ('99999999-9999-4999-8999-000000000002', '22222222-2222-4222-8222-000000000007',
            '99999999-9999-4999-8999-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'inhouse_task', 'email', 'sent')$$,
  '23514', null, 'a walkthrough reminder is about the walkthrough alone'
);

select lives_ok(
  $$delete from public.inhouse_fixes where id = '99999999-9999-4999-8999-000000000001'$$,
  'deleting the task works with its deliveries logged'
);
select is(
  (select count(*)::int from public.notification_deliveries where notification_id = '99999999-9999-4999-8999-000000000002'),
  0, 'and takes them with it'
);

select * from finish();
rollback;

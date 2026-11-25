-- OnTrack seed: the same sample data the design screens show, so a built
-- screen can be compared with its PNG. Fictional except restaurant names and
-- colors. Applied by `supabase db reset` / `supabase db start` locally and in
-- CI; never run against production.
--
-- Fixed ids keep the pgTAP tests and fixtures readable:
--   restaurants 1111…000N, users 2222…000N, categories 3333…00NN,
--   equipment 4444…00NN, contractors 5555…00NN, tickets 6666…0NNNN,
--   service records 7777…00NN, invites 8888…000N, walkthrough checklist
--   8888…0001 (sections cccc…000N, items dddd…0001NN and …0002NN, from the
--   migration), quarterly tasks 9999…000N, walkthroughs aaaa…000N.
--
-- Every seeded person signs in with the password below (local only).

begin;

-- No role names stored (OT-176 gives a new group Support Team for Ops), so the flows read
-- the roles as the boards draw them; group-settings.spec names them and puts this back.
update public.group_settings set name = 'Four Corners', short_name = '4C', role_names = '{}';

-- ---------------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------------
insert into public.restaurants (id, name, address, phone, color, sort_order) values
  ('11111111-1111-4111-8111-000000000001', 'Federale’s Logan Square', '2600 N Milwaukee Ave, Chicago', '(312) 555-0141', '#A3336D', 1),
  ('11111111-1111-4111-8111-000000000002', 'Federale’s West Loop',    '180 N Morgan St, Chicago',      '(312) 555-0142', '#6B3FA0', 2),
  ('11111111-1111-4111-8111-000000000003', 'Porter',                  '1400 W Randolph St, Chicago',   '(312) 555-0143', '#9A6A00', 3),
  ('11111111-1111-4111-8111-000000000004', 'Ranalli’s Logan Square',  '2700 N Kedzie Ave, Chicago',    '(312) 555-0144', '#1B4F91', 4);

-- ---------------------------------------------------------------------------
-- People. Inserting into auth.users fires handle_new_user, which creates the
-- profile and memberships. Role and restaurants travel in app_metadata, which
-- only the service role can write; user metadata carries the name only.
-- ---------------------------------------------------------------------------
create temp table seed_people (id uuid, full_name text, email text, phone text, role text, restaurant_ids jsonb) on commit drop;
insert into seed_people values
  ('22222222-2222-4222-8222-000000000001', 'Maya Reyes',          'maya.reyes@example.com',   '(773) 555-0101', 'manager',    '["11111111-1111-4111-8111-000000000001"]'),
  ('22222222-2222-4222-8222-000000000002', 'Ari Kim',             'ari.kim@example.com',      '(773) 555-0102', 'manager',    '["11111111-1111-4111-8111-000000000004"]'),
  ('22222222-2222-4222-8222-000000000003', 'Bert Velilla',        'bert.velilla@example.com', '(312) 555-0103', 'ops',        '[]'),
  ('22222222-2222-4222-8222-000000000004', 'Chris Novak',         'chris.novak@example.com',  '(312) 555-0104', 'ops',        '[]'),
  ('22222222-2222-4222-8222-000000000005', 'Lee Chen',            'lee.chen@example.com',     null,             'leadership', '[]'),
  ('22222222-2222-4222-8222-000000000006', 'Four Corners Admin',  'admin@example.com',        null,             'admin',      '[]'),
  -- Not on the boards: Phase 2's done test needs a manager at Porter.
  ('22222222-2222-4222-8222-000000000007', 'Dana Ortiz',          'dana.ortiz@example.com',   '(312) 555-0107', 'manager',    '["11111111-1111-4111-8111-000000000003"]'),
  -- Not on the boards: the group's IT person, on the Ops role (Support Team) everywhere (OT-116).
  ('22222222-2222-4222-8222-000000000008', 'Theo Grant',          'theo.grant@example.com',   '(312) 555-0108', 'ops',        '[]'),
  -- Not on the boards: the head ops manager, on the Support Team and holding Admin (OT-122).
  ('22222222-2222-4222-8222-000000000009', 'Rosa Delgado',        'rosa.delgado@example.com', '(312) 555-0109', 'ops',        '[]');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('ontrack-demo-2026', extensions.gen_salt('bf')), now() - interval '30 days',
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', role, 'restaurant_ids', restaurant_ids),
  jsonb_build_object('full_name', full_name),
  now() - interval '30 days', now() - interval '30 days', '', '', '', '', false
from seed_people;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now() - interval '1 day', now() - interval '30 days', now() - interval '30 days'
from seed_people;

update public.profiles p set phone = s.phone from seed_people s where s.id = p.id;

-- Admins must have 2-step on. e2e/stack/helpers.ts works out the code from this secret.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values
  ('33333333-3333-4333-8333-000000000006', '22222222-2222-4222-8222-000000000006', 'OnTrack', 'totp', 'verified',
  'JBSWY3DPEHPK3PXP', now() - interval '30 days', now() - interval '30 days'),
  ('33333333-3333-4333-8333-000000000009', '22222222-2222-4222-8222-000000000009', 'OnTrack', 'totp', 'verified',
  'KRUGKZLBMRWWS3TT', now() - interval '30 days', now() - interval '30 days');

-- Rosa holds Admin on top of the Support Team role (OT-122). The seed runs as the database
-- owner, so it sets the flag directly; the app gives it through set_admin.
update public.profiles set is_admin = true where id = '22222222-2222-4222-8222-000000000009';

update public.restaurants set manager_id = '22222222-2222-4222-8222-000000000001' where id = '11111111-1111-4111-8111-000000000001';
update public.restaurants set manager_id = '22222222-2222-4222-8222-000000000002' where id = '11111111-1111-4111-8111-000000000004';

-- Invites: Sam Patel pending (sent 2 days ago), Jordan Blake expired Oct 10.
insert into public.invites (id, email, full_name, role, restaurant_ids, token_hash, status, invited_by, sent_at, expires_at) values
  ('88888888-8888-4888-8888-000000000001', 'sam.patel@example.com', 'Sam Patel', 'manager', '{11111111-1111-4111-8111-000000000002}',
    encode(extensions.digest('seed-token-sam', 'sha256'), 'hex'), 'pending',
    '22222222-2222-4222-8222-000000000006', now() - interval '2 days', now() + interval '1 day'),
  ('88888888-8888-4888-8888-000000000002', 'jordan.blake@example.com', 'Jordan Blake', 'manager', '{11111111-1111-4111-8111-000000000003}',
    encode(extensions.digest('seed-token-jordan', 'sha256'), 'hex'), 'pending',
    '22222222-2222-4222-8222-000000000006', '2026-10-07 10:00-05', '2026-10-10 10:00-05');

-- ---------------------------------------------------------------------------
-- Rights: the role defaults come from a migration. These are Maya's two
-- overrides (the design shows her with See costs and Add / edit equipment granted),
-- and Theo's.
-- ---------------------------------------------------------------------------

insert into public.rights (user_id, key, allowed, updated_by) values
  ('22222222-2222-4222-8222-000000000001', 'see_costs',      true, '22222222-2222-4222-8222-000000000006'),
  ('22222222-2222-4222-8222-000000000001', 'edit_equipment', true, '22222222-2222-4222-8222-000000000006'),
  -- Theo works IT tickets, so costs and contractors are switched off for him.
  ('22222222-2222-4222-8222-000000000008', 'see_costs',      false, '22222222-2222-4222-8222-000000000006'),
  ('22222222-2222-4222-8222-000000000008', 'log_cost',       false, '22222222-2222-4222-8222-000000000006'),
  ('22222222-2222-4222-8222-000000000008', 'see_contractors', false, '22222222-2222-4222-8222-000000000006');

-- Job titles come from a migration (20261118120000). Maya is a General manager, which
-- starts with everything on; Theo is IT.
update public.profiles set job_title_id = 'eeeeeeee-eeee-4eee-8eee-000000000001' where id = '22222222-2222-4222-8222-000000000001';
update public.profiles set job_title_id = 'eeeeeeee-eeee-4eee-8eee-000000000004' where id = '22222222-2222-4222-8222-000000000008';
-- Rosa is the Ops manager.
update public.profiles set job_title_id = 'eeeeeeee-eeee-4eee-8eee-000000000003' where id = '22222222-2222-4222-8222-000000000009';

-- My categories (OT-116): Theo sees and hears only IT, the IT job title's starting view,
-- so a Front or Back of House ticket notifies the same two Ops people as before.
insert into public.area_prefs (user_id, area, notify, shown) values
  ('22222222-2222-4222-8222-000000000008', 'foh', 'off', false),
  ('22222222-2222-4222-8222-000000000008', 'boh', 'off', false),
  -- Rosa sees everything and is notified of nothing in the pool, so a fourth person on the
  -- Support Team changes nobody's count of who a new ticket notifies.
  ('22222222-2222-4222-8222-000000000009', 'foh', 'off', true),
  ('22222222-2222-4222-8222-000000000009', 'boh', 'off', true),
  ('22222222-2222-4222-8222-000000000009', 'it', 'off', true);

-- ---------------------------------------------------------------------------
-- Categories come from a migration (20261031140000), with the ids used below.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Equipment. The first eleven are the Ops equipment list; the rest are the
-- units the sample tickets and invoices name. Note: the design's equipment
-- list puts the Combi Oven at West Loop while its ticket OT-1039 is at Logan
-- Square; the ticket wins here.
-- ---------------------------------------------------------------------------
insert into public.equipment (id, restaurant_id, category_id, name, brand, model, serial, location_note, installed_on, warranty_note, warranty_until, manual_path, created_by) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Walk-in Cooler 1',      'Kolpak',      'KF7-0810-CT',  'KP-7XW-220418', 'Kitchen, north wall',  '2022-03-14', 'Parts through Mar 2027', '2027-03-14', '44444444-4444-4444-8444-000000000001/Kolpak-KF7.pdf', '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000011', 'Combi Oven',            'Rational',    'iCombi Pro 10','E11SH22091834', 'Hot line, center',     '2021-09-02', 'Expired',                '2023-09-02', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000012', 'Ice Machine',           'Hoshizaki',   'KM-660MAJ',    'HZ-K660-L1173', 'Back bar',             '2020-06-18', 'Expired',                '2023-06-18', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000017', 'Hood Exhaust Fan',      'Greenheck',   'CUBE-180',     'GH-CUBE-30441', 'Roof, above line',     '2019-04-22', 'Expired',                '2021-04-22', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000005', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000011', 'Espresso Machine',      'La Marzocco', 'GS3',          'LM-GS3-90127',  'Front bar',            '2023-01-10', 'Through Jan 2026',       '2026-01-10', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000006', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000012', 'Walk-in Freezer',       'Kolpak',      'KF7-1010-FR',  'KP-9FZ-190233', 'Basement prep',        '2019-02-11', 'Expired',                '2024-02-11', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000007', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000001', 'Dining Room Pendants',  'Hubbardton',  'Forge 18',     'HF-PND-4410',   'Dining room, 12 units','2022-11-05', null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000008', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000012', 'Reach-in Cooler, Line', 'True',        'T-49-HC',      'TR-49RR-55120', 'Line, station 2',      '2023-05-30', 'Through May 2026',       '2026-05-30', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000009', '11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000013', 'Floor Drain Pump',      'Zoeller',     'M53',          'ZL-M53-70188',  'Basement sump',        '2021-08-19', null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000010', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000014', 'Panel B Breaker Box',   'Square D',    'QO142M200PC',  'SD-QO-20931',   'Basement, east wall',  '2018-03-01', null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000011', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000016', 'Dish Machine',          'Hobart',      'AM15',         'HB-AM15-62207', 'Dish pit',             '2020-10-12', 'Expired',                '2022-10-12', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000012', '11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000016', 'Dish Machine',          'Hobart',      'AM15',         'HB-AM15-70114', 'Dish pit',             '2021-02-08', 'Expired',                '2023-02-08', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000013', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000012', 'Ice Machine',           'Hoshizaki',   'KM-660MAJ',    'HZ-K660-M2240', 'Service bar',          '2021-07-14', 'Expired',                '2024-07-14', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000014', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000012', 'Ice Machine',           'Manitowoc',   'IYT0620A',     'MW-IYT-0620',   'Back bar',             '2022-04-02', 'Through Apr 2027',       '2027-04-02', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000015', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000001', 'Patio string lights',   null,          null,           null,            'Patio, east side',     null,         null,                     null,         null, '22222222-2222-4222-8222-000000000001'),
  ('44444444-4444-4444-8444-000000000016', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000002', 'Bar sink 2',            null,          null,           null,            'Main bar, south end',  null,         null,                     null,         null, '22222222-2222-4222-8222-000000000001'),
  ('44444444-4444-4444-8444-000000000017', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000001', 'Host stand pendant',    null,          null,           null,            'Host stand',           null,         null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000018', '11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000011', 'Fryer 2',               'Pitco',       'SG14',         'PT-SG14-33190', 'Fry station',          '2020-01-20', 'Expired',                '2022-01-20', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000019', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000005', 'Booth 12',              null,          null,           null,            'Dining room, window',  null,         null,                     null,         null, '22222222-2222-4222-8222-000000000001'),
  ('44444444-4444-4444-8444-000000000020', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000002', 'Restroom faucet',       null,          null,           null,            'Restroom, left sink',  null,         null,                     null,         null, '22222222-2222-4222-8222-000000000002'),
  ('44444444-4444-4444-8444-000000000021', '11111111-1111-4111-8111-000000000003', '33333333-3333-4333-8333-000000000002', 'Bar sink',              null,          null,           null,            'Main bar',             null,         null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000022', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000001', 'Restroom exit sign',    null,          null,           null,            'Restroom corridor',    null,         null,                     null,         null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000023', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000017', 'Hood fan',              'Greenheck',   'CUBE-140',     'GH-CUBE-28810', 'Roof, above line',     '2020-05-11', 'Expired',                '2022-05-11', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000024', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000006', 'Patio heater, north',   'Bromic',      'Tungsten 500', 'BR-T500-11820', 'Patio, north rail',    '2023-10-01', 'Through Oct 2026',       '2026-10-01', null, '22222222-2222-4222-8222-000000000003'),
  ('44444444-4444-4444-8444-000000000025', '11111111-1111-4111-8111-000000000004', '33333333-3333-4333-8333-000000000015', 'Walk-in light',         null,          null,           null,            'Walk-in cooler',       null,         null,                     null,         null, '22222222-2222-4222-8222-000000000002'),
  ('44444444-4444-4444-8444-000000000026', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000007', 'Menu board screen',     'Samsung',     'QM55B',        'SS-QM55-40917', 'Above counter',        '2023-03-15', 'Through Mar 2026',       '2026-03-15', null, '22222222-2222-4222-8222-000000000003'),
  -- Not on the boards: IT's area (OT-115).
  ('44444444-4444-4444-8444-000000000027', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000021', 'POS terminal, bar',     'Toast',       'Flex 2',       'TS-FX2-30577',  'Main bar, service end', '2024-02-20', 'Through Feb 2027',       '2027-02-20', null, '22222222-2222-4222-8222-000000000003');

-- ---------------------------------------------------------------------------
-- Contractors ("All · 12")
-- ---------------------------------------------------------------------------
-- Each with one trade, as the boards draw them; a contractor can have several (OT-99).
with v (id, name, trade, contact_name, phone, email, preferred, insurance_until, notes, created_by) as (values
  ('55555555-5555-4555-8555-000000000001', 'Coldline Refrigeration',    'Refrigeration', 'Rosa Alvarez',    '(312) 555-0187', 'rosa@coldlinerefrigeration.example.com', true,  '2027-06-30', 'After hours: (312) 555-0190. Account #FC-2210.', '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000002', 'Northstar HVAC',            'HVAC',          'Kevin Brooks',    '(312) 555-0162', 'kevin@northstarhvac.example.com',        true,  '2027-02-28', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000003', 'Brightway Electric',        'Electrical',    'Tina Nguyen',     '(773) 555-0133', 'tina@brightwayelectric.example.com',     false, '2026-11-01', 'Ask for the restaurant rate.', '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000004', 'Pipeworks Plumbing',        'Plumbing',      'Marco Ruiz',      '(773) 555-0171', 'marco@pipeworks.example.com',            false, '2027-04-15', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000005', 'Hobart Service',            'Dishwashing',   'Factory service', '(800) 555-0199', 'service@hobart.example.com',             false, null,         'Use the serial number when calling.', '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000006', 'Booth Doctor Upholstery',   'Furniture',     'Dee Walsh',       '(773) 555-0150', 'dee@boothdoctor.example.com',            false, '2027-01-31', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000007', 'Lakeshore Gas & Cooking',   'Cooking',       'Omar Haddad',     '(312) 555-0118', 'omar@lakeshorecooking.example.com',      true,  '2027-03-31', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000008', 'Apex Fire & Hood',          'Ventilation',   'Priya Shah',      '(312) 555-0125', 'priya@apexhood.example.com',             false, '2026-12-31', 'Semi-annual hood cleaning contract.', '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000009', 'ClearSound AV',             'Audio & video', 'Jonah Pierce',    '(773) 555-0144', 'jonah@clearsoundav.example.com',         false, '2027-05-31', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000010', 'TechPoint POS',             'Audio & video', 'Support desk',    '(800) 555-0177', 'help@techpointpos.example.com',          false, null,         null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000011', 'Metro Lighting',            'Lighting',      'Celia Grant',     '(312) 555-0156', 'celia@metrolighting.example.com',        false, '2027-08-31', null, '22222222-2222-4222-8222-000000000003'),
  ('55555555-5555-4555-8555-000000000012', 'Windy City Glass & Decor',  'Decorations',   'Nate Okafor',     '(773) 555-0160', 'nate@windycityglass.example.com',        false, '2026-09-30', 'Insurance certificate requested.', '22222222-2222-4222-8222-000000000003')
), added as (
  insert into public.contractors (id, name, contact_name, phone, email, preferred, insurance_until, notes, created_by)
  select id::uuid, name, contact_name, phone, email, preferred, insurance_until::date, notes, created_by::uuid from v
)
insert into public.contractor_trades (contractor_id, trade_id)
select v.id::uuid, t.id from v join public.trades t on t.name = v.trade;

-- ---------------------------------------------------------------------------
-- Tickets. Events are inserted by hand with their own timestamps, so the
-- triggers that write them are paused for the seed.
-- ---------------------------------------------------------------------------
alter table public.tickets disable trigger tickets_log_events;
alter table public.tickets disable trigger tickets_guard;
alter table public.ticket_updates disable trigger ticket_updates_touch_ticket;
alter table public.ticket_updates disable trigger notify_on_ticket_update;

-- Shorthands used below
-- FLS 0001  FWL 0002  POR 0003  RLS 0004
-- maya 0001 ari 0002 bert 0003 chris 0004

insert into public.tickets (id, number, restaurant_id, equipment_id, category_id, title, description, urgency, status, assignee_id, source, created_by, created_at, updated_at, closed_at, closed_by, last_closed_at, reopened_at, reopen_count, resolution, scheduled_for) values
  -- Open, as on the Ops dashboard and the Logan Square list
  ('66666666-6666-4666-8666-000000001042', 1042, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Walk-in cooler not holding temp', 'Walk-in reading 46°F since this morning. Compressor runs but the box is not pulling down. Moved proteins to the reach-ins.', 'urgent', 'in_progress', '22222222-2222-4222-8222-000000000003', 'walkthrough', '22222222-2222-4222-8222-000000000001', '2026-10-19 09:12-05', now() - interval '1 hour', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001044', 1044, '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000012', '33333333-3333-4333-8333-000000000016', 'Dish machine not reaching rinse temp', 'Final rinse gauge stuck at 150°F. Sanitizer test strips failing.', 'urgent', 'open', null, 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '25 minutes', now() - interval '25 minutes', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001039', 1039, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000011', 'Combi oven showing service error', 'Display shows Service 34 on startup. Oven still heats but the steam mode is locked out.', 'normal', 'open', null, 'walkthrough', '22222222-2222-4222-8222-000000000001', now() - interval '3 hours', now() - interval '3 hours', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001035', 1035, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000017', '33333333-3333-4333-8333-000000000001', 'Host stand pendant flickering', 'Pendant over the host stand flickers and buzzes when dimmed.', 'normal', 'waiting_parts', '22222222-2222-4222-8222-000000000004', 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '2 days', now() - interval '2 days', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001033', 1033, '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000014', '33333333-3333-4333-8333-000000000012', 'Ice machine low output', 'Bin is only half full by open. Harvest cycles seem long.', 'normal', 'scheduled', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000002', now() - interval '3 days', now() - interval '3 days', null, null, null, null, 0, null, current_date + 2),
  ('66666666-6666-4666-8666-000000001047', 1047, '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000021', '33333333-3333-4333-8333-000000000002', 'Bar sink draining slowly', 'Left basin takes a few minutes to drain. Snaked it once already.', 'normal', 'open', null, 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '95 minutes', now() - interval '95 minutes', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001045', 1045, '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000023', '33333333-3333-4333-8333-000000000017', 'Hood fan rattling at high speed', 'Loud rattle from the roof fan on high. Fine on low.', 'normal', 'in_progress', '22222222-2222-4222-8222-000000000004', 'reported', '22222222-2222-4222-8222-000000000002', now() - interval '5 hours', now() - interval '5 hours', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001041', 1041, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000022', '33333333-3333-4333-8333-000000000001', 'Restroom exit sign dark', 'Exit sign by the restrooms is out, battery test button does nothing.', 'normal', 'open', null, 'walkthrough', '22222222-2222-4222-8222-000000000004', now() - interval '1 day', now() - interval '1 day', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001046', 1046, '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000018', '33333333-3333-4333-8333-000000000011', 'Fryer 2 pilot won’t stay lit', 'Pilot lights but drops out after a minute. Thermocouple suspected.', 'normal', 'waiting_parts', '22222222-2222-4222-8222-000000000004', 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '36 hours', now() - interval '1 day', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001037', 1037, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000015', '33333333-3333-4333-8333-000000000001', 'Patio string lights out, east side', 'Whole east run is dark. West side fine.', 'normal', 'waiting_parts', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', now() - interval '4 days', now() - interval '1 day', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001031', 1031, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000016', '33333333-3333-4333-8333-000000000002', 'Bar sink draining slowly', 'South bar sink backs up during service.', 'normal', 'scheduled', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', now() - interval '6 days', now() - interval '2 days', null, null, null, null, 0, null, current_date + 2),
  ('66666666-6666-4666-8666-000000001040', 1040, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000024', '33333333-3333-4333-8333-000000000006', 'Patio heater not igniting', 'North patio heater clicks but never lights.', 'normal', 'open', null, 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '30 hours', now() - interval '30 hours', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001043', 1043, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000006', '33333333-3333-4333-8333-000000000012', 'Walk-in freezer door closer broken', 'Door does not swing shut on its own; staff keep finding it ajar.', 'normal', 'open', null, 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '20 hours', now() - interval '20 hours', null, null, null, null, 0, null, null),
  ('66666666-6666-4666-8666-000000001038', 1038, '11111111-1111-4111-8111-000000000003', null, '33333333-3333-4333-8333-000000000018', 'Dry storage shelving unit leaning', 'Back shelving unit is pulling away from the wall anchors.', 'normal', 'open', null, 'reported', '22222222-2222-4222-8222-000000000004', now() - interval '3 days', now() - interval '3 days', null, null, null, null, 0, null, null),
  -- Not on the boards: an open ticket in IT's area (OT-115)
  ('66666666-6666-4666-8666-000000001034', 1034, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000027', '33333333-3333-4333-8333-000000000021', 'Bar POS won''t print kitchen tickets', 'Orders go through on the bar terminal but nothing prints in the kitchen. Running tickets by hand.', 'normal', 'open', null, 'reported', '22222222-2222-4222-8222-000000000003', now() - interval '3 hours', now() - interval '3 hours', null, null, null, null, 0, null, null),
  -- Reopened: closed Oct 14, reopened 2h ago
  ('66666666-6666-4666-8666-000000000988',  988, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Door gasket torn', 'Bottom of the door gasket is torn about 6 inches. Door isn''t sealing all the way and frost is building on the threshold.', 'normal', 'reopened', null, 'reported', '22222222-2222-4222-8222-000000000001', '2026-10-10 09:12-05', now() - interval '2 hours', null, null, '2026-10-14 16:05-05', now() - interval '2 hours', 1, null, null),
  -- Closed in October (the Closed tickets screen: 9 closed, $2,418.60; the reopened ticket above is open work)
  ('66666666-6666-4666-8666-000000001036', 1036, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000013', '33333333-3333-4333-8333-000000000012', 'Ice machine scale buildup', 'Cubes cloudy and small; scale visible on the evaporator plate.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000004', '2026-10-15 08:30-05', '2026-10-17 15:20-05', '2026-10-17 15:20-05', '22222222-2222-4222-8222-000000000003', '2026-10-17 15:20-05', null, 0, 'Coldline descaled the unit and replaced the water filter. Full bin by close.', null),
  ('66666666-6666-4666-8666-000000001028', 1028, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000019', '33333333-3333-4333-8333-000000000005', 'Booth 12 upholstery torn', 'Seat panel split along the seam, foam showing.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', '2026-10-09 11:05-05', '2026-10-15 13:00-05', '2026-10-15 13:00-05', '22222222-2222-4222-8222-000000000003', '2026-10-15 13:00-05', null, 0, 'Booth Doctor reupholstered the seat panel in matching vinyl.', null),
  ('66666666-6666-4666-8666-000000001022', 1022, '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000004', '33333333-3333-4333-8333-000000000017', 'Hood filter replacement', 'Two baffle filters bent and not seating.', 'normal', 'closed', '22222222-2222-4222-8222-000000000004', 'walkthrough', '22222222-2222-4222-8222-000000000004', '2026-10-04 10:00-05', '2026-10-11 12:10-05', '2026-10-11 12:10-05', '22222222-2222-4222-8222-000000000004', '2026-10-11 12:10-05', null, 0, 'Northstar replaced both filters and checked the fan belt.', null),
  ('66666666-6666-4666-8666-000000001023', 1023, '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000012', '33333333-3333-4333-8333-000000000016', 'Dish machine booster heater fault', 'Booster heater tripping its breaker mid-shift.', 'urgent', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000004', '2026-10-09 07:45-05', '2026-10-11 16:40-05', '2026-10-11 16:40-05', '22222222-2222-4222-8222-000000000003', '2026-10-11 16:40-05', null, 0, 'Hobart replaced the booster element and contactor.', null),
  ('66666666-6666-4666-8666-000000001019', 1019, '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000020', '33333333-3333-4333-8333-000000000002', 'Restroom faucet dripping', 'Left restroom faucet drips constantly.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000002', '2026-10-02 14:20-05', '2026-10-06 11:30-05', '2026-10-06 11:30-05', '22222222-2222-4222-8222-000000000003', '2026-10-06 11:30-05', null, 0, 'Pipeworks replaced the cartridge.', null),
  ('66666666-6666-4666-8666-000000001020', 1020, '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000025', '33333333-3333-4333-8333-000000000015', 'Walk-in light out', 'Bulb in the walk-in is dead.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'walkthrough', '22222222-2222-4222-8222-000000000002', '2026-10-05 09:00-05', '2026-10-07 10:15-05', '2026-10-07 10:15-05', '22222222-2222-4222-8222-000000000003', '2026-10-07 10:15-05', null, 0, 'Replaced with a cold-rated LED bulb.', null),
  ('66666666-6666-4666-8666-000000001024', 1024, '11111111-1111-4111-8111-000000000001', null, '33333333-3333-4333-8333-000000000013', 'Hand sink faucet loose', 'Faucet at the line hand sink wobbles.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', '2026-10-10 15:00-05', '2026-10-12 09:40-05', '2026-10-12 09:40-05', '22222222-2222-4222-8222-000000000003', '2026-10-12 09:40-05', null, 0, 'Tightened the mounting nut; no parts needed.', null),
  ('66666666-6666-4666-8666-000000001026', 1026, '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000026', '33333333-3333-4333-8333-000000000007', 'Menu board screen frozen', 'Left menu board stuck on the breakfast layout.', 'normal', 'closed', '22222222-2222-4222-8222-000000000004', 'reported', '22222222-2222-4222-8222-000000000004', '2026-10-11 08:10-05', '2026-10-13 17:25-05', '2026-10-13 17:25-05', '22222222-2222-4222-8222-000000000004', '2026-10-13 17:25-05', null, 0, 'TechPoint replaced the media player.', null),
  ('66666666-6666-4666-8666-000000001029', 1029, '11111111-1111-4111-8111-000000000003', null, '33333333-3333-4333-8333-000000000018', 'Back door closer slamming', 'Door slams hard enough to rattle the shelving.', 'normal', 'closed', '22222222-2222-4222-8222-000000000004', 'reported', '22222222-2222-4222-8222-000000000004', '2026-10-13 12:00-05', '2026-10-16 14:00-05', '2026-10-16 14:00-05', '22222222-2222-4222-8222-000000000004', '2026-10-16 14:00-05', null, 0, 'Adjusted the closer speed screws.', null),
  -- Older history on Walk-in Cooler 1
  ('66666666-6666-4666-8666-000000000911',  911, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Evaporator fan noisy', 'Grinding noise from the evaporator fan.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', '2026-05-01 10:00-05', '2026-05-03 12:00-05', '2026-05-03 12:00-05', '22222222-2222-4222-8222-000000000003', '2026-05-03 12:00-05', null, 0, 'Cleaned the fan and replaced the mounting bracket in house.', null),
  ('66666666-6666-4666-8666-000000000820',  820, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Annual preventive maintenance', 'Scheduled PM visit.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000003', '2026-01-12 09:00-06', '2026-01-15 15:00-06', '2026-01-15 15:00-06', '22222222-2222-4222-8222-000000000003', '2026-01-15 15:00-06', null, 0, 'Coils cleaned, charge checked, door hardware tightened.', null),
  ('66666666-6666-4666-8666-000000000702',  702, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Walk-in warm, compressor short cycling', 'Compressor clicks on and off every minute.', 'urgent', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000001', '2025-08-11 07:30-05', '2025-08-12 14:00-05', '2025-08-12 14:00-05', '22222222-2222-4222-8222-000000000003', '2025-08-12 14:00-05', null, 0, 'Coldline replaced the compressor start relay and capacitor.', null),
  ('66666666-6666-4666-8666-000000000633',  633, '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000012', 'Spring PM and door closer', 'Scheduled PM; door closer also weak.', 'normal', 'closed', '22222222-2222-4222-8222-000000000003', 'reported', '22222222-2222-4222-8222-000000000003', '2025-03-03 09:00-06', '2025-03-04 16:00-06', '2025-03-04 16:00-06', '22222222-2222-4222-8222-000000000003', '2025-03-04 16:00-06', null, 0, 'PM done; door closer replaced.', null);

select setval('public.ticket_number_seq', 1047);

-- Thread events and messages (the Ops ticket screen and the closed ticket timeline)
insert into public.ticket_updates (ticket_id, author_id, kind, body, internal, meta, created_at) values
  -- OT-1042
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000001', 'created', null, false, '{"source":"walkthrough"}', '2026-10-19 09:12-05'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'assigned', null, false, '{"to":"22222222-2222-4222-8222-000000000003"}', '2026-10-19 09:40-05'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'status_changed', null, false, '{"from":"open","to":"in_progress"}', '2026-10-19 09:40-05'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'message', 'Refrigeration tech booked for today 2–4 PM. Keep the door closed as much as possible.', false, '{}', now() - interval '60 minutes'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'message', 'Coldline quoted $185 for the diagnostic. If it is the compressor relay, the part is about $240 more.', true, '{}', now() - interval '50 minutes'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000001', 'message', 'Thanks. Lunch rush ends at 2, so that window works. Proteins are holding at 36°F in the reach-ins.', false, '{}', now() - interval '45 minutes'),
  ('66666666-6666-4666-8666-000000001042', '22222222-2222-4222-8222-000000000003', 'message', 'Great. The tech will text you about 30 minutes before they arrive.', false, '{}', now() - interval '30 minutes'),
  -- OT-1044
  ('66666666-6666-4666-8666-000000001044', '22222222-2222-4222-8222-000000000004', 'created', null, false, '{"source":"reported"}', now() - interval '25 minutes'),
  -- OT-0988
  ('66666666-6666-4666-8666-000000000988', '22222222-2222-4222-8222-000000000001', 'created', null, false, '{"source":"reported"}', '2026-10-10 09:12-05'),
  ('66666666-6666-4666-8666-000000000988', '22222222-2222-4222-8222-000000000003', 'assigned', null, false, '{"to":"22222222-2222-4222-8222-000000000003"}', '2026-10-11 14:40-05'),
  ('66666666-6666-4666-8666-000000000988', '22222222-2222-4222-8222-000000000003', 'status_changed', 'Gasket ordered from Kolpak. Coldline booked for Oct 14.', false, '{"from":"open","to":"in_progress"}', '2026-10-11 14:40-05'),
  ('66666666-6666-4666-8666-000000000988', '22222222-2222-4222-8222-000000000003', 'closed', 'Replaced the full door gasket. Checked the seal with the door closed overnight, holding at 37°F.', false, '{"from":"in_progress","to":"closed"}', '2026-10-14 16:05-05'),
  ('66666666-6666-4666-8666-000000000988', '22222222-2222-4222-8222-000000000001', 'reopened', 'Frost is building on the threshold again and the door is not pulling shut.', false, '{"from":"closed","to":"reopened"}', now() - interval '2 hours');

-- Photo on Maya's message
insert into public.ticket_photos (ticket_id, update_id, path, width, height, created_by, created_at)
select u.ticket_id, u.id, u.ticket_id || '/seed-thermometer.jpg', 1200, 1600, u.author_id, u.created_at
from public.ticket_updates u
where u.ticket_id = '66666666-6666-4666-8666-000000001042' and u.author_id = '22222222-2222-4222-8222-000000000001' and u.kind = 'message';

-- Created events for every other ticket, so each thread starts with "Opened by"
insert into public.ticket_updates (ticket_id, author_id, kind, meta, created_at)
select t.id, t.created_by, 'created', jsonb_build_object('source', t.source), t.created_at
from public.tickets t
where not exists (select 1 from public.ticket_updates u where u.ticket_id = t.id and u.kind = 'created');

-- Closed events for the closed tickets
insert into public.ticket_updates (ticket_id, author_id, kind, body, meta, created_at)
select t.id, t.closed_by, 'closed', t.resolution, '{"to":"closed"}', t.closed_at
from public.tickets t
where t.status = 'closed' and not exists (select 1 from public.ticket_updates u where u.ticket_id = t.id and u.kind = 'closed');

alter table public.tickets enable trigger tickets_log_events;
alter table public.tickets enable trigger tickets_guard;
alter table public.ticket_updates enable trigger ticket_updates_touch_ticket;
alter table public.ticket_updates enable trigger notify_on_ticket_update;

-- ---------------------------------------------------------------------------
-- Service records, line items, invoices
-- Walk-in Cooler 1: 2026 = $860.90 (4 visits), lifetime = $2,115.90,
-- Coldline on this unit 2026 = $822.40. Matches the equipment screens.
-- ---------------------------------------------------------------------------
insert into public.service_records (id, ticket_id, contractor_id, kind, technician, service_date, title, notes, logged_by, created_at) values
  ('77777777-7777-4777-8777-000000000001', '66666666-6666-4666-8666-000000001042', '55555555-5555-4555-8555-000000000001', 'contractor', 'Rosa Alvarez', '2026-10-19', 'Condenser fan motor replaced', 'Replaced the condenser fan motor and run capacitor. Unit pulled down to 37°F within 40 minutes.', '22222222-2222-4222-8222-000000000003', '2026-10-19 16:50-05'),
  ('77777777-7777-4777-8777-000000000002', '66666666-6666-4666-8666-000000000988', '55555555-5555-4555-8555-000000000001', 'contractor', 'Rosa Alvarez', '2026-10-14', 'Door gasket replaced', 'Full gasket replaced; door sweep adjusted.', '22222222-2222-4222-8222-000000000003', '2026-10-14 16:10-05'),
  ('77777777-7777-4777-8777-000000000003', '66666666-6666-4666-8666-000000000911', null, 'in_house', null, '2026-05-03', 'Evaporator fan cleaned, bracket', 'Cleaned the fan blades and replaced the cracked mounting bracket.', '22222222-2222-4222-8222-000000000003', '2026-05-03 12:05-05'),
  ('77777777-7777-4777-8777-000000000004', '66666666-6666-4666-8666-000000000820', '55555555-5555-4555-8555-000000000001', 'contractor', 'Rosa Alvarez', '2026-01-15', 'Annual preventive maintenance', 'Coils cleaned, refrigerant charge checked, door hardware tightened.', '22222222-2222-4222-8222-000000000003', '2026-01-15 15:10-06'),
  ('77777777-7777-4777-8777-000000000005', '66666666-6666-4666-8666-000000000702', '55555555-5555-4555-8555-000000000001', 'contractor', 'Luis Ortega', '2025-08-12', 'Compressor start relay replaced', 'Relay and start capacitor replaced; cycling normal.', '22222222-2222-4222-8222-000000000003', '2025-08-12 14:05-05'),
  ('77777777-7777-4777-8777-000000000006', '66666666-6666-4666-8666-000000000633', '55555555-5555-4555-8555-000000000001', 'contractor', 'Rosa Alvarez', '2025-03-04', 'Spring PM and door closer', 'PM completed; hydraulic door closer replaced.', '22222222-2222-4222-8222-000000000003', '2025-03-04 16:05-06'),
  ('77777777-7777-4777-8777-000000000007', '66666666-6666-4666-8666-000000001036', '55555555-5555-4555-8555-000000000001', 'contractor', 'Rosa Alvarez', '2026-10-17', 'Ice machine descaled', 'Descaled evaporator, replaced water filter.', '22222222-2222-4222-8222-000000000003', '2026-10-17 15:25-05'),
  ('77777777-7777-4777-8777-000000000008', '66666666-6666-4666-8666-000000001023', '55555555-5555-4555-8555-000000000005', 'contractor', 'Factory tech', '2026-10-11', 'Booster heater element replaced', 'Element and contactor replaced under service call.', '22222222-2222-4222-8222-000000000003', '2026-10-11 16:45-05'),
  ('77777777-7777-4777-8777-000000000009', '66666666-6666-4666-8666-000000001022', '55555555-5555-4555-8555-000000000002', 'contractor', 'Kevin Brooks', '2026-10-11', 'Hood filter replacement', 'Two baffle filters replaced; belt checked.', '22222222-2222-4222-8222-000000000004', '2026-10-11 12:15-05'),
  ('77777777-7777-4777-8777-000000000010', '66666666-6666-4666-8666-000000001035', '55555555-5555-4555-8555-000000000003', 'contractor', 'Tina Nguyen', '2026-10-08', 'Diagnosed driver fault, part ordered', 'LED driver failing; replacement ordered.', '22222222-2222-4222-8222-000000000004', '2026-10-08 13:30-05'),
  ('77777777-7777-4777-8777-000000000011', '66666666-6666-4666-8666-000000001019', '55555555-5555-4555-8555-000000000004', 'contractor', 'Marco Ruiz', '2026-10-06', 'Cartridge replaced', 'Replaced the faucet cartridge and seat.', '22222222-2222-4222-8222-000000000003', '2026-10-06 11:35-05'),
  ('77777777-7777-4777-8777-000000000012', '66666666-6666-4666-8666-000000001028', '55555555-5555-4555-8555-000000000006', 'contractor', 'Dee Walsh', '2026-10-15', 'Reupholstered seat panel', 'Seat panel reupholstered in matching vinyl.', '22222222-2222-4222-8222-000000000003', '2026-10-15 13:05-05'),
  ('77777777-7777-4777-8777-000000000013', '66666666-6666-4666-8666-000000001020', null, 'in_house', null, '2026-10-07', 'Cold-rated LED bulb', null, '22222222-2222-4222-8222-000000000003', '2026-10-07 10:20-05'),
  ('77777777-7777-4777-8777-000000000014', '66666666-6666-4666-8666-000000001026', '55555555-5555-4555-8555-000000000010', 'contractor', 'Remote support', '2026-10-13', 'Media player replaced', 'Replaced the failed media player and reloaded the layouts.', '22222222-2222-4222-8222-000000000004', '2026-10-13 17:30-05');

insert into public.service_line_items (service_record_id, kind, description, amount_cents, sort_order) values
  ('77777777-7777-4777-8777-000000000001', 'labor', '2 hrs', 18000, 1),
  ('77777777-7777-4777-8777-000000000001', 'parts', 'fan motor, capacitor', 21740, 2),
  ('77777777-7777-4777-8777-000000000002', 'labor', '1.5 hrs', 13500, 1),
  ('77777777-7777-4777-8777-000000000002', 'parts', 'door gasket', 11000, 2),
  ('77777777-7777-4777-8777-000000000003', 'parts', 'mounting bracket', 3850, 1),
  ('77777777-7777-4777-8777-000000000004', 'labor', 'PM visit', 18000, 1),
  ('77777777-7777-4777-8777-000000000005', 'labor', '2 hrs', 18000, 1),
  ('77777777-7777-4777-8777-000000000005', 'parts', 'start relay, capacitor', 38000, 2),
  ('77777777-7777-4777-8777-000000000005', 'trip',  'after-hours call', 6000, 3),
  ('77777777-7777-4777-8777-000000000006', 'labor', 'PM visit', 18000, 1),
  ('77777777-7777-4777-8777-000000000006', 'parts', 'door closer', 45500, 2),
  ('77777777-7777-4777-8777-000000000007', 'labor', '1.5 hrs', 13500, 1),
  ('77777777-7777-4777-8777-000000000007', 'parts', 'descaler, water filter', 17500, 2),
  ('77777777-7777-4777-8777-000000000008', 'labor', 'service call', 26000, 1),
  ('77777777-7777-4777-8777-000000000008', 'parts', 'booster element, contactor', 38000, 2),
  ('77777777-7777-4777-8777-000000000009', 'labor', '1 hr', 9000, 1),
  ('77777777-7777-4777-8777-000000000009', 'parts', '2 baffle filters', 9660, 2),
  ('77777777-7777-4777-8777-000000000010', 'labor', 'diagnostic', 15200, 1),
  ('77777777-7777-4777-8777-000000000010', 'trip',  'trip fee', 6000, 2),
  ('77777777-7777-4777-8777-000000000011', 'labor', '1 hr', 12000, 1),
  ('77777777-7777-4777-8777-000000000011', 'parts', 'cartridge', 4500, 2),
  ('77777777-7777-4777-8777-000000000012', 'labor', 'reupholstery', 32000, 1),
  ('77777777-7777-4777-8777-000000000012', 'parts', 'vinyl, foam', 10000, 2),
  ('77777777-7777-4777-8777-000000000013', 'parts', 'LED bulb', 1200, 1),
  ('77777777-7777-4777-8777-000000000014', 'labor', 'on-site swap', 20000, 1),
  ('77777777-7777-4777-8777-000000000014', 'parts', 'media player', 48500, 2);

insert into public.invoices (service_record_id, number, amount_cents, status, path, attached_by, attached_at) values
  ('77777777-7777-4777-8777-000000000001', 'INV-58213', 39740, 'attached', '77777777-7777-4777-8777-000000000001/Coldline_INV-58213.pdf', '22222222-2222-4222-8222-000000000003', '2026-10-19 16:52-05'),
  ('77777777-7777-4777-8777-000000000002', 'INV-58102', 24500, 'attached', '77777777-7777-4777-8777-000000000002/Coldline_INV-58102.pdf', '22222222-2222-4222-8222-000000000003', '2026-10-14 16:12-05'),
  ('77777777-7777-4777-8777-000000000004', null,        18000, 'missing',  null, null, null),
  ('77777777-7777-4777-8777-000000000005', 'INV-55710', 62000, 'attached', '77777777-7777-4777-8777-000000000005/Coldline_INV-55710.pdf', '22222222-2222-4222-8222-000000000003', '2025-08-12 14:10-05'),
  ('77777777-7777-4777-8777-000000000006', 'INV-54120', 63500, 'attached', '77777777-7777-4777-8777-000000000006/Coldline_INV-54120.pdf', '22222222-2222-4222-8222-000000000003', '2025-03-04 16:10-06'),
  ('77777777-7777-4777-8777-000000000007', 'INV-58190', 31000, 'attached', '77777777-7777-4777-8777-000000000007/Coldline_INV-58190.pdf', '22222222-2222-4222-8222-000000000003', '2026-10-17 15:30-05'),
  ('77777777-7777-4777-8777-000000000008', 'H-20931',   64000, 'attached', '77777777-7777-4777-8777-000000000008/Hobart_H-20931.pdf',     '22222222-2222-4222-8222-000000000003', '2026-10-11 16:50-05'),
  ('77777777-7777-4777-8777-000000000009', 'NS-4410',   18660, 'attached', '77777777-7777-4777-8777-000000000009/Northstar_NS-4410.pdf',  '22222222-2222-4222-8222-000000000004', '2026-10-11 12:20-05'),
  ('77777777-7777-4777-8777-000000000010', 'BE-1177',   21200, 'attached', '77777777-7777-4777-8777-000000000010/Brightway_BE-1177.pdf',  '22222222-2222-4222-8222-000000000004', '2026-10-08 13:35-05'),
  ('77777777-7777-4777-8777-000000000011', null,        16500, 'missing',  null, null, null),
  ('77777777-7777-4777-8777-000000000012', null,        42000, 'missing',  null, null, null),
  ('77777777-7777-4777-8777-000000000014', 'TP-77102',  68500, 'attached', '77777777-7777-4777-8777-000000000014/TechPoint_TP-77102.pdf', '22222222-2222-4222-8222-000000000004', '2026-10-13 17:35-05');

-- ---------------------------------------------------------------------------
-- Walkthroughs: the board's two Q4 tasks, October's walkthroughs, and Logan
-- Square's in-house fixes from the Manager in-house list.
-- ---------------------------------------------------------------------------
-- The checklists and rotations from the schedule board (WT-Ops-Schedule, OT-126). The
-- migration's checklist (20261113120000) is B, the full walkthrough; A looks closer at the
-- kitchen and the outside. The group's cycle starts in January, so October is B and
-- November A, as the board's preview shows. Ranalli's has its own three months. Item ids
-- are …0kNN, k the section's number below and NN the item's place in its list.
update public.walkthrough_templates
set name = 'Back of House + Front of House', description = 'Full walkthrough', short_name = 'BOH + FOH'
where id = '88888888-8888-4888-8888-000000000001';

insert into public.walkthrough_templates (id, name, description, short_name) values
  ('88888888-8888-4888-8888-000000000002', 'Kitchen + Exterior', 'A closer look', 'Kitchen + Exterior'),
  ('88888888-8888-4888-8888-000000000003', 'Kitchen + Bar', 'A closer look', 'Kitchen + Bar'),
  ('88888888-8888-4888-8888-000000000004', 'Dining room + Patio', 'A closer look', 'Dining + Patio'),
  ('88888888-8888-4888-8888-000000000005', 'Exterior + Storage', 'A closer look', 'Exterior + Storage');

insert into public.walkthrough_sections (id, template_id, name, short_name, area, sort_order) values
  ('cccccccc-cccc-4ccc-8ccc-000000000003', '88888888-8888-4888-8888-000000000002', 'Kitchen', 'Kitchen', 'boh', 1),
  ('cccccccc-cccc-4ccc-8ccc-000000000004', '88888888-8888-4888-8888-000000000002', 'Exterior', 'Exterior', null, 2),
  ('cccccccc-cccc-4ccc-8ccc-000000000005', '88888888-8888-4888-8888-000000000003', 'Kitchen', 'Kitchen', 'boh', 1),
  ('cccccccc-cccc-4ccc-8ccc-000000000006', '88888888-8888-4888-8888-000000000003', 'Bar', 'Bar', 'foh', 2),
  ('cccccccc-cccc-4ccc-8ccc-000000000007', '88888888-8888-4888-8888-000000000004', 'Dining room', 'Dining', 'foh', 1),
  ('cccccccc-cccc-4ccc-8ccc-000000000008', '88888888-8888-4888-8888-000000000004', 'Patio', 'Patio', 'foh', 2),
  ('cccccccc-cccc-4ccc-8ccc-000000000009', '88888888-8888-4888-8888-000000000005', 'Exterior', 'Exterior', null, 1),
  ('cccccccc-cccc-4ccc-8ccc-000000000010', '88888888-8888-4888-8888-000000000005', 'Storage', 'Storage', 'boh', 2);

-- Category ids by their last two digits (33333333-…-0000000000NN), where one plainly fits.
with lists (list, n, group_name, title, cat) as (values
  ('kitchen', 1,  'Electrical',          'Appliances (plugs, etc.)',     '14'),
  ('kitchen', 2,  'Electrical',          'Light bulbs',                  '15'),
  ('kitchen', 3,  'Electrical',          'Emergency lights and signs',   '15'),
  ('kitchen', 4,  'Electrical',          'Outlets',                      '14'),
  ('kitchen', 5,  'Electrical',          'Feature',                      '14'),
  ('kitchen', 6,  'Plumbing',            'Hand sinks',                   '13'),
  ('kitchen', 7,  'Plumbing',            'Floor drains',                 '13'),
  ('kitchen', 8,  'Plumbing',            'Grease trap',                  '13'),
  ('kitchen', 9,  'Hood and ventilation','Hood filters',                 '17'),
  ('kitchen', 10, 'Hood and ventilation','Exhaust fan',                  '17'),
  ('kitchen', 11, 'Hood and ventilation','Fire suppression tags',        '17'),
  ('kitchen', 12, 'Refrigeration',       'Walk-in door gasket',          '12'),
  ('kitchen', 13, 'Refrigeration',       'Reach-in temperatures',        '12'),
  ('kitchen', 14, 'Refrigeration',       'Ice machine',                  '12'),
  ('kitchen', 15, 'Cooking line',        'Burners and pilots',           '11'),
  ('kitchen', 16, 'Cooking line',        'Fryer',                        '11'),
  ('kitchen', 17, 'Cooking line',        'Oven door and seals',          '11'),
  ('kitchen', 18, 'Dish',                'Dish machine',                 '16'),
  ('kitchen', 19, 'Dish',                'Three-compartment sink',       '16'),
  ('kitchen', 20, 'Floors and walls',    'Floor tiles and grout',        null),
  ('kitchen', 21, 'Floors and walls',    'Wall panels',                  null),
  ('kitchen', 22, 'Health and safety',   'First aid kit',                null),
  ('kitchen', 23, 'Health and safety',   'Fire extinguishers',           null),
  ('kitchen', 24, 'Storage',             'Dry storage shelving',         '18'),
  ('exterior', 1,  'Lighting',           'Parking lot lights',           null),
  ('exterior', 2,  'Lighting',           'Entrance lights',              null),
  ('exterior', 3,  'Lighting',           'Sign lights',                  null),
  ('exterior', 4,  'Lighting',           'Timers',                       null),
  ('exterior', 5,  'Roof and gutters',   'Gutters and downspouts',       null),
  ('exterior', 6,  'Roof and gutters',   'Roof drains',                  null),
  ('exterior', 7,  'Roof and gutters',   'Rooftop units',                null),
  ('exterior', 8,  'Doors and windows',  'Back door closes and locks',   null),
  ('exterior', 9,  'Doors and windows',  'Front door hardware',          null),
  ('exterior', 10, 'Doors and windows',  'Glass and frames',             null),
  ('exterior', 11, 'Signage',            'Main sign',                    null),
  ('exterior', 12, 'Signage',            'Hours and address',            null),
  ('exterior', 13, 'Signage',            'Accessible parking signs',     null),
  ('exterior', 14, 'Walks and parking',  'Sidewalk and curbs',           null),
  ('exterior', 15, 'Walks and parking',  'Lot surface and striping',     null),
  ('exterior', 16, 'Walks and parking',  'Ramps and rails',              null),
  ('exterior', 17, 'Patio',              'Furniture',                    null),
  ('exterior', 18, 'Patio',              'Heaters',                      null),
  ('exterior', 19, 'Patio',              'Fencing and planters',         null),
  ('exterior', 20, 'Trash and grease',   'Dumpster area clean',          null),
  ('exterior', 21, 'Trash and grease',   'Grease bin lid and pad',       null),
  ('exterior', 22, 'Trash and grease',   'Enclosure gate',               null),
  ('exterior', 23, 'Landscaping',        'Beds and trees',               null),
  ('exterior', 24, 'Landscaping',        'Irrigation',                   null),
  ('bar', 1,  'Electrical',              'Light bulbs',                  '01'),
  ('bar', 2,  'Electrical',              'Outlets',                      '03'),
  ('bar', 3,  'Electrical',              'Under-bar lights',             '01'),
  ('bar', 4,  'Plumbing',                'Bar sinks',                    '02'),
  ('bar', 5,  'Plumbing',                'Floor drains',                 '02'),
  ('bar', 6,  'Plumbing',                'Soda gun lines',               '02'),
  ('bar', 7,  'Refrigeration',           'Back bar coolers',             null),
  ('bar', 8,  'Refrigeration',           'Keg cooler temperature',       null),
  ('bar', 9,  'Refrigeration',           'Draft lines and taps',         null),
  ('bar', 10, 'Refrigeration',           'Ice bin',                      null),
  ('bar', 11, 'Surfaces',                'Bar top',                      '05'),
  ('bar', 12, 'Surfaces',                'Stools',                       '05'),
  ('bar', 13, 'Surfaces',                'Floor mats',                   null),
  ('bar', 14, 'Health and safety',       'Glass washer',                 null),
  ('bar', 15, 'Health and safety',       'Chemical storage',             null),
  ('bar', 16, 'Inventory control',       'Liquor room lock',             null),
  ('dining', 1,  'Electrical',           'Light bulbs',                  '01'),
  ('dining', 2,  'Electrical',           'Dimmers',                      '01'),
  ('dining', 3,  'Electrical',           'Emergency lights and signs',   '01'),
  ('dining', 4,  'Electrical',           'Outlets',                      '03'),
  ('dining', 5,  'Plumbing',             'Restroom fixtures',            '02'),
  ('dining', 6,  'Plumbing',             'Restroom drains',              '02'),
  ('dining', 7,  'HVAC',                 'Maintaining temp',             '06'),
  ('dining', 8,  'HVAC',                 'Vents and returns',            '06'),
  ('dining', 9,  'Envelope',             'Windows and doors',            '09'),
  ('dining', 10, 'Envelope',             'Walls',                        null),
  ('dining', 11, 'Envelope',             'Floors',                       null),
  ('dining', 12, 'Aesthetics',           'Paint',                        null),
  ('dining', 13, 'Aesthetics',           'Art and decor',                '04'),
  ('dining', 14, 'Aesthetics',           'Signage',                      '04'),
  ('dining', 15, 'Furniture',            'Tables level',                 '05'),
  ('dining', 16, 'Furniture',            'Chairs and booths',            '05'),
  ('dining', 17, 'Furniture',            'Host stand',                   '05'),
  ('dining', 18, 'Audio and video',      'Speakers',                     '07'),
  ('dining', 19, 'Audio and video',      'TVs',                          '07'),
  ('dining', 20, 'Health and safety',    'Exits clear',                  null),
  ('patio', 1,  'Lighting',              'String lights',                '01'),
  ('patio', 2,  'Lighting',              'Path lights',                  '01'),
  ('patio', 3,  'Comfort',               'Heaters',                      null),
  ('patio', 4,  'Comfort',               'Umbrellas',                    null),
  ('patio', 5,  'Comfort',               'Fans',                         null),
  ('patio', 6,  'Furniture',             'Tables level',                 '05'),
  ('patio', 7,  'Furniture',             'Chairs',                       '05'),
  ('patio', 8,  'Furniture',             'Cushions',                     '05'),
  ('patio', 9,  'Structure',             'Fencing',                      null),
  ('patio', 10, 'Structure',             'Planters',                     null),
  ('patio', 11, 'Structure',             'Retractable roof',             '09'),
  ('patio', 12, 'Surfaces',              'Pavers',                       null),
  ('patio', 13, 'Surfaces',              'Drainage',                     null),
  ('patio', 14, 'Health and safety',     'Gate latch',                   null),
  ('patio', 15, 'Health and safety',     'Fire extinguisher',            null),
  ('patio', 16, 'Inventory control',     'Furniture count',              null),
  ('storage', 1, 'Storage',              'Dry storage shelving',         '18'),
  ('storage', 2, 'Storage',              'Walk-in shelving',             '18'),
  ('storage', 3, 'Storage',              'Basement and back hall',       '18'),
  ('storage', 4, 'Storage',              'Chemical storage',             '18')
),
sections (k, list) as (values
  (3, 'kitchen'), (4, 'exterior'), (5, 'kitchen'), (6, 'bar'),
  (7, 'dining'), (8, 'patio'), (9, 'exterior'), (10, 'storage')
)
insert into public.walkthrough_items (id, section_id, group_name, title, sort_order, category_id)
select format('dddddddd-dddd-4ddd-8ddd-%s', lpad((s.k * 100 + l.n)::text, 12, '0'))::uuid,
       format('cccccccc-cccc-4ccc-8ccc-%s', lpad(s.k::text, 12, '0'))::uuid,
       l.group_name, l.title, l.n,
       case when l.cat is not null then format('33333333-3333-4333-8333-0000000000%s', l.cat)::uuid end
from sections s join lists l on l.list = s.list;

-- The group's rotation, A then B from January; Ranalli's own, three months from January.
update public.walkthrough_rotations
set starts_on = '2026-01-01', updated_by = '22222222-2222-4222-8222-000000000003'
where is_group;
delete from public.walkthrough_rotation_months
where rotation_id = (select id from public.walkthrough_rotations where is_group);
insert into public.walkthrough_rotation_months (rotation_id, position, template_id)
select g.id, m.position, m.template_id::uuid
from public.walkthrough_rotations g
cross join (values (0, '88888888-8888-4888-8888-000000000002'), (1, '88888888-8888-4888-8888-000000000001')) as m (position, template_id)
where g.is_group;

insert into public.walkthrough_rotations (id, name, starts_on, updated_by) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'Ranalli’s', '2026-01-01', '22222222-2222-4222-8222-000000000003');
insert into public.walkthrough_rotation_months (rotation_id, position, template_id) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 0, '88888888-8888-4888-8888-000000000003'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 1, '88888888-8888-4888-8888-000000000004'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 2, '88888888-8888-4888-8888-000000000005');
insert into public.restaurant_rotations (restaurant_id, rotation_id, updated_by) values
  ('11111111-1111-4111-8111-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', '22222222-2222-4222-8222-000000000003');

insert into public.quarterly_tasks (id, title, directions, video_url, months, sort_order) values
  ('99999999-9999-4999-8999-000000000001', 'Organize utility areas', 'Clear at least 3 feet in front of the electrical panel and the water heater. Move chemicals off the floor and away from food storage, and toss empty boxes and broken equipment. Submit a ticket if the water heater shows rust or leaks at the base, or if the panel door doesn''t close.', 'https://example.com/how-to/organize-utility-areas', '{1,4,7,10}', 1),
  ('99999999-9999-4999-8999-000000000002', 'Degrease BOH floors', 'Block off one section at a time. Apply degreaser per the label, let it sit 5 minutes, then scrub with a deck brush, focusing on grout and under equipment edges. Squeegee to the floor drain and rinse with clean water. Submit a ticket if a drain is slow or backs up.', null, '{1,4,7,10}', 2);

insert into public.walkthroughs (id, restaurant_id, template_id, period, due_on, status, started_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000001', '2026-10-01', '2026-10-31', 'open', '22222222-2222-4222-8222-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', '11111111-1111-4111-8111-000000000002', '88888888-8888-4888-8888-000000000001', '2026-10-01', '2026-10-31', 'open', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', '11111111-1111-4111-8111-000000000003', '88888888-8888-4888-8888-000000000001', '2026-10-01', '2026-10-31', 'open', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', '11111111-1111-4111-8111-000000000004', '88888888-8888-4888-8888-000000000001', '2026-10-01', '2026-10-31', 'open', '22222222-2222-4222-8222-000000000002'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', '11111111-1111-4111-8111-000000000001', '88888888-8888-4888-8888-000000000001', '2026-09-01', '2026-09-30', 'submitted', '22222222-2222-4222-8222-000000000001');
update public.walkthroughs set submitted_by = '22222222-2222-4222-8222-000000000001', submitted_at = '2026-09-24 17:30-05'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005';

-- The Ops overview's last six months (WT-Ops-Overview, OT-129), May to September; October
-- is above, and so is Logan Square's September. Each month has its rotation's checklist and
-- nothing checked. On time is submitted on the 26th, late on the 3rd of the next month, and
-- missed is still open. Ids …0001NN.
with history (n, restaurant_id, month, standing, person) as (values
  (1,  '11111111-1111-4111-8111-000000000001', date '2026-05-01', 'on_time', '22222222-2222-4222-8222-000000000001'),
  (2,  '11111111-1111-4111-8111-000000000001', date '2026-06-01', 'missed',  '22222222-2222-4222-8222-000000000001'),
  (3,  '11111111-1111-4111-8111-000000000001', date '2026-07-01', 'missed',  null),
  (4,  '11111111-1111-4111-8111-000000000001', date '2026-08-01', 'on_time', '22222222-2222-4222-8222-000000000001'),
  (5,  '11111111-1111-4111-8111-000000000002', date '2026-05-01', 'on_time', null),
  (6,  '11111111-1111-4111-8111-000000000002', date '2026-06-01', 'on_time', null),
  (7,  '11111111-1111-4111-8111-000000000002', date '2026-07-01', 'late',    null),
  (8,  '11111111-1111-4111-8111-000000000002', date '2026-08-01', 'on_time', null),
  (9,  '11111111-1111-4111-8111-000000000002', date '2026-09-01', 'on_time', null),
  (10, '11111111-1111-4111-8111-000000000003', date '2026-05-01', 'late',    '22222222-2222-4222-8222-000000000007'),
  (11, '11111111-1111-4111-8111-000000000003', date '2026-06-01', 'missed',  null),
  (12, '11111111-1111-4111-8111-000000000003', date '2026-07-01', 'late',    '22222222-2222-4222-8222-000000000007'),
  (13, '11111111-1111-4111-8111-000000000003', date '2026-08-01', 'missed',  '22222222-2222-4222-8222-000000000007'),
  (14, '11111111-1111-4111-8111-000000000003', date '2026-09-01', 'late',    '22222222-2222-4222-8222-000000000007'),
  (15, '11111111-1111-4111-8111-000000000004', date '2026-05-01', 'on_time', '22222222-2222-4222-8222-000000000002'),
  (16, '11111111-1111-4111-8111-000000000004', date '2026-06-01', 'on_time', '22222222-2222-4222-8222-000000000002'),
  (17, '11111111-1111-4111-8111-000000000004', date '2026-07-01', 'on_time', '22222222-2222-4222-8222-000000000002'),
  (18, '11111111-1111-4111-8111-000000000004', date '2026-08-01', 'on_time', '22222222-2222-4222-8222-000000000002'),
  (19, '11111111-1111-4111-8111-000000000004', date '2026-09-01', 'on_time', '22222222-2222-4222-8222-000000000002')
)
insert into public.walkthroughs (id, restaurant_id, template_id, period, due_on, status, started_by, submitted_by, submitted_at)
select format('aaaaaaaa-aaaa-4aaa-8aaa-%s', lpad((100 + h.n)::text, 12, '0'))::uuid,
       h.restaurant_id::uuid,
       public.rotation_template(public.restaurant_rotation(h.restaurant_id::uuid), h.month),
       h.month,
       (h.month + interval '1 month - 1 day')::date,
       case when h.standing = 'missed' then 'open' else 'submitted' end::public.walkthrough_status,
       h.person::uuid,
       case when h.standing <> 'missed' then h.person::uuid end,
       case h.standing
         when 'on_time' then format('%s 17:30-05', h.month + 25)::timestamptz
         when 'late' then format('%s 10:00-05', (h.month + interval '1 month')::date + 2)::timestamptz
       end
from history h;

-- A link, not activity: the lists show these tickets' times as the boards do.
alter table public.tickets disable trigger tickets_updated_at;
update public.tickets set walkthrough_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'
  where id in ('66666666-6666-4666-8666-000000001042', '66666666-6666-4666-8666-000000001039');
update public.tickets set walkthrough_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'
  where id = '66666666-6666-4666-8666-000000001041';
alter table public.tickets enable trigger tickets_updated_at;

-- Newest first gives the board's order.
insert into public.inhouse_fixes (restaurant_id, walkthrough_id, title, origin_label, area, done_at, done_by, created_by, created_at) values
  ('11111111-1111-4111-8111-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'Replace 2 bulbs over booths 4–6', 'Oct walkthrough · FOH › Electrical › Light bulbs', 'foh', null, null, '22222222-2222-4222-8222-000000000001', now() - interval '3 days'),
  ('11111111-1111-4111-8111-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'Tighten wobbly 2-top at table 14', 'Oct walkthrough · FOH › Aesthetics › Surfaces and seating', 'foh', null, null, '22222222-2222-4222-8222-000000000001', now() - interval '3 days 1 minute'),
  ('11111111-1111-4111-8111-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'Replaced cracked cover plate by mop sink', 'Oct walkthrough · BOH › Electrical › Outlets', 'boh', null, null, '22222222-2222-4222-8222-000000000001', now() - interval '3 days 2 minutes'),
  ('11111111-1111-4111-8111-000000000001', null, 'Clear boxes from utility closet', 'Q4 task · Organize utility areas', 'boh', null, null, '22222222-2222-4222-8222-000000000001', now() - interval '4 days'),
  ('11111111-1111-4111-8111-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 'Touch up scuffed baseboard by restrooms', 'Sep walkthrough · FOH › Aesthetics › Paint', 'foh', null, null, '22222222-2222-4222-8222-000000000001', '2026-09-24 17:00-05'),
  ('11111111-1111-4111-8111-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'Re-glue trim on pass shelf', 'Oct walkthrough · BOH › Electrical › Feature', 'boh', now() - interval '1 day', '22222222-2222-4222-8222-000000000001', '22222222-2222-4222-8222-000000000001', now() - interval '3 days');

-- How the database calls send-push on the local stack; the secret matches config.toml.
select vault.create_secret('http://supabase_kong_ontrack:8000/functions/v1/send-push', 'send_push_url');
select vault.create_secret('local-send-push-secret', 'send_push_secret');

commit;

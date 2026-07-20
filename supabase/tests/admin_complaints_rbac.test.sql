begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

insert into public.societies (id, name) values
  ('16000000-0000-0000-0000-000000000001', 'Complaint Test Society A'),
  ('16000000-0000-0000-0000-000000000002', 'Complaint Test Society B');
insert into auth.users (id) values
  ('46000000-0000-0000-0000-000000000001'),
  ('46000000-0000-0000-0000-000000000002'),
  ('46000000-0000-0000-0000-000000000003'),
  ('46000000-0000-0000-0000-000000000004'),
  ('46000000-0000-0000-0000-000000000005'),
  ('46000000-0000-0000-0000-000000000006'),
  ('46000000-0000-0000-0000-000000000007');
insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'Tower A', 'TA', 1, 1),
  ('26000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', 'Tower B', 'TB', 1, 1);
insert into public.flats (id, society_id, tower_id, number, floor) values
  ('36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '101', 1),
  ('36000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', '101', 1);
insert into public.profiles (id, society_id, role, flat_id, occupancy_type, full_name, is_active) values
  ('46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'ADMIN', null, null, 'Admin A', true),
  ('46000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', 'ADMIN', null, null, 'Admin B', true),
  ('46000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000001', 'RESIDENT', '36000000-0000-0000-0000-000000000001', 'OWNER', 'Resident A1', true),
  ('46000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000001', 'GUARD', null, null, 'Guard A', true),
  ('46000000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000002', 'RESIDENT', '36000000-0000-0000-0000-000000000002', 'OWNER', 'Resident B', true),
  ('46000000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000001', 'RESIDENT', '36000000-0000-0000-0000-000000000001', 'TENANT', 'Resident A2', true),
  ('46000000-0000-0000-0000-000000000007', '16000000-0000-0000-0000-000000000001', 'RESIDENT', '36000000-0000-0000-0000-000000000001', 'TENANT', 'Inactive Resident', false);

insert into public.complaints (
  id, society_id, flat_id, raised_by, title, description, category, priority, status, created_at, updated_at
) values
  ('56000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000003', 'Leak A1', 'Pipe leak', 'Plumbing', 'MEDIUM', 'OPEN', now() - interval '1 day', now() - interval '1 day'),
  ('56000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000006', 'Noise A2', 'Loud noise', 'Noise', 'LOW', 'OPEN', now() - interval '2 hours', now() - interval '2 hours'),
  ('56000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', '46000000-0000-0000-0000-000000000005', 'Light B', 'No light', 'Electrical', 'HIGH', 'OPEN', now(), now());

insert into public.complaint_events (id, complaint_id, society_id, status, note, created_by, created_at) values
  ('66000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'OPEN', 'Complaint raised', '46000000-0000-0000-0000-000000000003', now() - interval '1 day'),
  ('66000000-0000-0000-0000-000000000002', '56000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', 'OPEN', 'Complaint raised', '46000000-0000-0000-0000-000000000006', now() - interval '2 hours'),
  ('66000000-0000-0000-0000-000000000003', '56000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000002', 'OPEN', 'Complaint raised', '46000000-0000-0000-0000-000000000005', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.complaints), 1, 'resident sees only complaints they raised');
select is((select title from public.complaints), 'Leak A1', 'resident sees their own complaint');
select is((select count(*)::integer from public.complaints where raised_by = '46000000-0000-0000-0000-000000000006'), 0, 'resident cannot see another complaint from the same flat');
select is((select count(*)::integer from public.complaints where society_id = '16000000-0000-0000-0000-000000000002'), 0, 'resident cannot see cross-society complaints');
select is((select count(*)::integer from public.complaint_events), 1, 'resident sees only their own complaint timeline');

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.complaints), 0, 'guard has no complaint workflow');
select is((select count(*)::integer from public.complaint_events), 0, 'guard cannot read complaint timelines');

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.complaints), 2, 'admin sees all complaints in own society');
select is((select count(*)::integer from public.complaints where society_id = '16000000-0000-0000-0000-000000000002'), 0, 'admin cannot read cross-society complaints');
select is((select count(*)::integer from public.complaint_events), 2, 'admin sees own-society complaint timelines');

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$ select public.create_resident_complaint('  Lift issue  ', '  Lift is stuck  ', 'Electrical') $$,
  'resident atomically creates a complaint'
);
reset role;
select is((select society_id from public.complaints where title = 'Lift issue'), '16000000-0000-0000-0000-000000000001'::uuid, 'created complaint derives authenticated society');
select is((select flat_id from public.complaints where title = 'Lift issue'), '36000000-0000-0000-0000-000000000001'::uuid, 'created complaint derives authenticated flat');
select is((select raised_by from public.complaints where title = 'Lift issue'), '46000000-0000-0000-0000-000000000003'::uuid, 'created complaint derives authenticated owner');
select is((select count(*)::integer from public.complaint_events where complaint_id = (select id from public.complaints where title = 'Lift issue')), 1, 'complaint creation atomically writes initial timeline event');

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_resident_complaint('Bad category', 'Description', 'Invented') $$,
  '22023',
  'Complaint category is invalid',
  'invalid complaint category is rejected'
);
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_resident_complaint('Guard complaint', 'No', 'Other') $$,
  '42501',
  'Only active residents assigned to a flat can raise complaints',
  'guard cannot raise complaints'
);
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.create_resident_complaint('Admin complaint', 'No', 'Other') $$,
  '42501',
  'Only active residents assigned to a flat can raise complaints',
  'admin cannot raise complaints'
);
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000007', true);
select throws_ok(
  $$ select public.create_resident_complaint('Inactive complaint', 'No', 'Other') $$,
  '42501',
  'Only active residents assigned to a flat can raise complaints',
  'inactive resident cannot raise complaints'
);
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select throws_like(
  $$ insert into public.complaints (society_id, flat_id, raised_by, title, description) values ('16000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000003', 'Direct', 'No') $$,
  '%permission denied%',
  'direct complaint creation is denied'
);

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'IN_PROGRESS', 'Cross') $$,
  '42501',
  'Complaint is not available to this admin',
  'admin cannot update a cross-society complaint'
);
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'IN_PROGRESS', 'Resident') $$,
  '42501',
  'Only active society admins can update complaints',
  'resident cannot update complaints'
);

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'IN_PROGRESS', 'Assigned to maintenance') $$,
  'admin moves an open complaint into progress'
);
reset role;
select is((select status::text from public.complaints where id = '56000000-0000-0000-0000-000000000001'), 'IN_PROGRESS', 'status update persists');
select is((select priority::text from public.complaints where id = '56000000-0000-0000-0000-000000000001'), 'HIGH', 'priority update persists');
select ok((select updated_at > created_at from public.complaints where id = '56000000-0000-0000-0000-000000000001'), 'updated timestamp advances');
select is((select note from public.complaint_events where complaint_id = '56000000-0000-0000-0000-000000000001' order by created_at desc limit 1), 'Assigned to maintenance', 'admin timeline note persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.complaint_events where complaint_id = '56000000-0000-0000-0000-000000000001'), 2, 'owner receives updated complaint timeline');
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000006', true);
select is((select count(*)::integer from public.complaint_events where complaint_id = '56000000-0000-0000-0000-000000000001'), 0, 'same-flat resident cannot read another complaint timeline');

select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'OPEN', null) $$,
  '22023',
  'Complaint status cannot move backwards',
  'complaint status cannot move backwards'
);
select throws_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'IN_PROGRESS', null) $$,
  '22023',
  'No complaint changes were provided',
  'empty complaint update is rejected'
);
select lives_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'HIGH', 'RESOLVED', 'Repair completed') $$,
  'admin resolves an in-progress complaint'
);
reset role;
select is((select status::text from public.complaints where id = '56000000-0000-0000-0000-000000000001'), 'RESOLVED', 'resolved state persists');
select ok((select resolved_at is not null from public.complaints where id = '56000000-0000-0000-0000-000000000001'), 'resolved timestamp persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_complaint('56000000-0000-0000-0000-000000000001', 'LOW', 'RESOLVED', null) $$,
  'admin can reprioritize without changing status'
);
reset role;
select is((select note from public.complaint_events where complaint_id = '56000000-0000-0000-0000-000000000001' and note = 'Priority changed to Low'), 'Priority changed to Low', 'priority-only update creates a truthful timeline note');

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ insert into public.complaint_events (complaint_id, society_id, status, note, created_by) values ('56000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'RESOLVED', 'Direct', '46000000-0000-0000-0000-000000000001') $$,
  '%permission denied%',
  'direct complaint timeline mutations are denied'
);
reset role;
select is((select count(*)::integer from public.audit_events where society_id = '16000000-0000-0000-0000-000000000001'), 3, 'admin complaint lifecycle actions are audited');

select * from finish();
rollback;

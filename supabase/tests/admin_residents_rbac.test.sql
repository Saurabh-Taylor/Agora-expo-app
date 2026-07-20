begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into public.societies (id, name) values
  ('13000000-0000-0000-0000-000000000001', 'Resident Test Society A'),
  ('13000000-0000-0000-0000-000000000002', 'Resident Test Society B');
insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'Tower A', 'TA', 10, 3),
  ('23000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'Tower B', 'TB', 10, 1);
insert into public.flats (id, society_id, tower_id, number, floor) values
  ('33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '101', 1),
  ('33000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '102', 1),
  ('33000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '103', 1),
  ('33000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000002', '101', 1);
insert into auth.users (id) values
  ('43000000-0000-0000-0000-000000000001'),
  ('43000000-0000-0000-0000-000000000002'),
  ('43000000-0000-0000-0000-000000000003'),
  ('43000000-0000-0000-0000-000000000004'),
  ('43000000-0000-0000-0000-000000000005'),
  ('43000000-0000-0000-0000-000000000006');
insert into public.profiles (id, society_id, role, flat_id, occupancy_type, full_name, must_change_password) values
  ('43000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'ADMIN', null, null, 'Admin A', false),
  ('43000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'ADMIN', null, null, 'Admin B', false),
  ('43000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', 'RESIDENT', '33000000-0000-0000-0000-000000000001', 'OWNER', 'Resident A', true),
  ('43000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000001', 'RESIDENT', '33000000-0000-0000-0000-000000000003', 'TENANT', 'Resident A2', false),
  ('43000000-0000-0000-0000-000000000005', '13000000-0000-0000-0000-000000000001', 'GUARD', null, null, 'Guard A', false),
  ('43000000-0000-0000-0000-000000000006', '13000000-0000-0000-0000-000000000002', 'RESIDENT', '33000000-0000-0000-0000-000000000004', 'OWNER', 'Resident B', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_resident('43000000-0000-0000-0000-000000000003', 'Resident Updated', '9999999999', '33000000-0000-0000-0000-000000000002', 'TENANT', false) $$,
  'admin updates an own-society resident'
);
reset role;
select is((select full_name from public.profiles where id = '43000000-0000-0000-0000-000000000003'), 'Resident Updated', 'resident name update persists');
select is((select flat_id from public.profiles where id = '43000000-0000-0000-0000-000000000003'), '33000000-0000-0000-0000-000000000002'::uuid, 'resident reassignment persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.update_admin_resident('43000000-0000-0000-0000-000000000003', 'Resident Updated', '', '33000000-0000-0000-0000-000000000003', 'OWNER', false) $$,
  '23505',
  'This flat is already assigned to another resident',
  'occupied flat reassignment is rejected'
);
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.update_admin_resident('43000000-0000-0000-0000-000000000003', 'Cross Society', '', '33000000-0000-0000-0000-000000000004', 'OWNER', false) $$,
  '42501',
  'Resident is not available to this admin',
  'admin cannot update a cross-society resident'
);
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.update_admin_resident('43000000-0000-0000-0000-000000000004', 'No', '', '33000000-0000-0000-0000-000000000003', 'TENANT', false) $$,
  '42501',
  'Only active society admins can manage residents',
  'resident cannot manage residents'
);
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$ select public.set_admin_resident_active('43000000-0000-0000-0000-000000000003', false) $$,
  '42501',
  'Only active society admins can manage residents',
  'guard cannot change resident access'
);

select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.set_admin_resident_verified('43000000-0000-0000-0000-000000000003', true) $$,
  'admin verifies an own-society resident'
);
reset role;
select ok((select is_verified from public.profiles where id = '43000000-0000-0000-0000-000000000003'), 'resident verification persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.set_admin_resident_active('43000000-0000-0000-0000-000000000003', false) $$,
  'admin deactivates an own-society resident'
);
reset role;
select is((select is_active from public.profiles where id = '43000000-0000-0000-0000-000000000003'), false, 'deactivation persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000003', true);
select is((select public.current_user_role())::text, null, 'inactive resident has no RLS role');
select is((select public.current_society_id())::text, null, 'inactive resident has no RLS society');
select is((select count(*)::integer from public.towers), 0, 'inactive resident cannot read society domain data');
select throws_ok(
  $$ select public.complete_password_change() $$,
  '42501',
  'Account is inactive',
  'inactive resident cannot complete password workflow'
);

select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.set_admin_resident_active('43000000-0000-0000-0000-000000000003', true) $$,
  'admin reactivates the resident'
);
reset role;
select is((select is_active from public.profiles where id = '43000000-0000-0000-0000-000000000003'), true, 'reactivation persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000003', true);
select is((select public.current_user_role())::text, 'RESIDENT', 'reactivated resident regains the RLS role');
select lives_ok($$ select public.complete_password_change() $$, 'active resident completes first-login password workflow');
reset role;
select is((select must_change_password from public.profiles where id = '43000000-0000-0000-0000-000000000003'), false, 'password completion flag persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.profiles set role = 'ADMIN' where id = '43000000-0000-0000-0000-000000000003' $$,
  '%permission denied%',
  'direct profile updates are denied'
);
select is((select count(*)::integer from public.audit_events where society_id = '13000000-0000-0000-0000-000000000001'), 4, 'resident management actions are audited');

select * from finish();
rollback;

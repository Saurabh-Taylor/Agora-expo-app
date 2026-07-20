begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.societies (id, name) values
  ('12000000-0000-0000-0000-000000000001', 'Flat Test Society A'),
  ('12000000-0000-0000-0000-000000000002', 'Flat Test Society B');

insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Tower A', 'TA', 10, 1),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Tower B', 'TB', 10, 1);

insert into public.flats (id, society_id, tower_id, number, floor) values
  ('32000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '101', 1),
  ('32000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', '101', 1);

insert into auth.users (id) values
  ('42000000-0000-0000-0000-000000000001'),
  ('42000000-0000-0000-0000-000000000002'),
  ('42000000-0000-0000-0000-000000000003'),
  ('42000000-0000-0000-0000-000000000004');

insert into public.profiles (id, society_id, role, flat_id, full_name) values
  ('42000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A'),
  ('42000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'ADMIN', null, 'Admin B'),
  ('42000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001', 'RESIDENT', '32000000-0000-0000-0000-000000000001', 'Resident A'),
  ('42000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A');

set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.create_admin_flat('22000000-0000-0000-0000-000000000001', '205', 2) $$,
  'admin creates a flat in an own-society tower'
);
reset role;
select is(
  (select count(*)::integer from public.flats where society_id = '12000000-0000-0000-0000-000000000001' and number = '205'),
  1,
  'flat is created in admin society'
);
select is(
  (select count(*)::integer from public.flats where society_id = '12000000-0000-0000-0000-000000000002' and number = '205'),
  0,
  'flat creation cannot target another society'
);
select is(
  (select count(*)::integer from public.audit_events where society_id = '12000000-0000-0000-0000-000000000001' and action = 'Added flat 205'),
  1,
  'flat creation records an audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_flat((select id from public.flats where number = '205'), '206', 2) $$,
  'same-society admin updates flat details'
);
reset role;
select is(
  (select floor from public.flats where society_id = '12000000-0000-0000-0000-000000000001' and number = '206'),
  2,
  'flat update is persisted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.update_admin_flat('32000000-0000-0000-0000-000000000001', '999', 9) $$,
  '42501',
  'Flat is not available to this admin',
  'admin cannot update a cross-society flat'
);
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_admin_flat('22000000-0000-0000-0000-000000000001', '301', 3) $$,
  '42501',
  'Only society admins can create flats',
  'resident cannot create flats'
);
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_admin_flat('22000000-0000-0000-0000-000000000001', '302', 3) $$,
  '42501',
  'Only society admins can create flats',
  'guard cannot create flats'
);
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.create_admin_flat('22000000-0000-0000-0000-000000000001', '1501', 15) $$,
  '22023',
  'Flat floor must be within the tower',
  'flat floor must fit the selected tower'
);
select throws_like(
  $$ update public.flats set number = 'Direct' where id = '32000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'direct flat mutations are denied'
);
select throws_ok(
  $$ select public.delete_empty_admin_flat('32000000-0000-0000-0000-000000000001') $$,
  '23503',
  'This flat has residents or activity history and cannot be deleted',
  'occupied flat cannot be deleted'
);
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.delete_empty_admin_flat((select id from public.flats where number = '206')) $$,
  '42501',
  'Flat is not available to this admin',
  'admin cannot delete a cross-society flat'
);
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.delete_empty_admin_flat((select id from public.flats where number = '206')) $$,
  'same-society admin deletes an unused flat'
);
reset role;
select is(
  (select count(*)::integer from public.flats where society_id = '12000000-0000-0000-0000-000000000001' and number = '206'),
  0,
  'deleted flat is removed'
);

select * from finish();
rollback;

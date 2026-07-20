begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.societies (id, name) values
  ('11000000-0000-0000-0000-000000000001', 'Tower Test Society A'),
  ('11000000-0000-0000-0000-000000000002', 'Tower Test Society B');

insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Occupied Tower', 'OT', 1, 1),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Other Tower', 'BT', 1, 1);

insert into public.flats (id, society_id, tower_id, number, floor) values
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '101', 1),
  ('31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '101', 1);

insert into auth.users (id) values
  ('41000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002'),
  ('41000000-0000-0000-0000-000000000003'),
  ('41000000-0000-0000-0000-000000000004');

insert into public.profiles (id, society_id, role, flat_id, full_name) values
  ('41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A'),
  ('41000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'ADMIN', null, 'Admin B'),
  ('41000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'RESIDENT', '31000000-0000-0000-0000-000000000001', 'Resident A'),
  ('41000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.create_admin_tower('Cedar Tower', 2, 2) $$,
  'admin creates a tower in the authenticated society'
);
reset role;

select is(
  (select count(*)::integer from public.towers where society_id = '11000000-0000-0000-0000-000000000001' and name = 'Cedar Tower'),
  1,
  'tower is created in admin society'
);
select is(
  (
    select count(*)::integer
    from public.flats f
    join public.towers t on t.id = f.tower_id and t.society_id = f.society_id
    where t.society_id = '11000000-0000-0000-0000-000000000001' and t.name = 'Cedar Tower'
  ),
  4,
  'tower creation atomically generates flats'
);
select is(
  (select count(*)::integer from public.towers where society_id = '11000000-0000-0000-0000-000000000002' and name = 'Cedar Tower'),
  0,
  'tower creation cannot target another society'
);
select is(
  (select count(*)::integer from public.audit_events where society_id = '11000000-0000-0000-0000-000000000001' and action = 'Added Cedar Tower'),
  1,
  'tower creation records an audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_tower(
    (select id from public.towers where name = 'Cedar Tower'),
    'Cedar Heights',
    'CH'
  ) $$,
  'same-society admin updates tower details'
);
reset role;
select is(
  (select code from public.towers where society_id = '11000000-0000-0000-0000-000000000001' and name = 'Cedar Heights'),
  'CH',
  'tower update is persisted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.update_admin_tower('21000000-0000-0000-0000-000000000001', 'Hijacked', 'XX') $$,
  '42501',
  'Tower is not available to this admin',
  'admin cannot update a cross-society tower'
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_admin_tower('Resident Tower', 1, 1) $$,
  '42501',
  'Only society admins can create towers',
  'resident cannot create towers'
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_admin_tower('Guard Tower', 1, 1) $$,
  '42501',
  'Only society admins can create towers',
  'guard cannot create towers'
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.towers set name = 'Direct Update' where id = '21000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'direct tower mutations are denied'
);
select throws_ok(
  $$ select public.delete_empty_admin_tower('21000000-0000-0000-0000-000000000001') $$,
  '23503',
  'This tower has residents or activity history and cannot be deleted',
  'occupied tower cannot be deleted'
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.delete_empty_admin_tower(
    (select id from public.towers where name = 'Cedar Heights')
  ) $$,
  '42501',
  'Tower is not available to this admin',
  'admin cannot delete a cross-society tower'
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.delete_empty_admin_tower(
    (select id from public.towers where name = 'Cedar Heights')
  ) $$,
  'same-society admin deletes an unused tower'
);
reset role;
select is(
  (select count(*)::integer from public.towers where society_id = '11000000-0000-0000-0000-000000000001' and name = 'Cedar Heights'),
  0,
  'deleted tower is removed'
);

select * from finish();
rollback;

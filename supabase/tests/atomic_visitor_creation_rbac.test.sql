begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.societies (id, name) values
  ('71000000-0000-0000-0000-000000000001', 'Visitor Society A'),
  ('71000000-0000-0000-0000-000000000002', 'Visitor Society B');
insert into public.towers (id, society_id, name, code) values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Tower Alpha', 'A'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'Tower Beta', 'B');
insert into public.flats (id, society_id, tower_id, number) values
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '101'),
  ('73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '102'),
  ('73000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', '201');
insert into auth.users (id) values
  ('74000000-0000-0000-0000-000000000001'),
  ('74000000-0000-0000-0000-000000000002'),
  ('74000000-0000-0000-0000-000000000003'),
  ('74000000-0000-0000-0000-000000000004'),
  ('74000000-0000-0000-0000-000000000005'),
  ('74000000-0000-0000-0000-000000000006'),
  ('74000000-0000-0000-0000-000000000007');
insert into public.profiles (id, society_id, role, flat_id, full_name, is_active) values
  ('74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'RESIDENT', '73000000-0000-0000-0000-000000000001', 'Alice Resident', true),
  ('74000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'RESIDENT', '73000000-0000-0000-0000-000000000002', 'Arun Resident', true),
  ('74000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A', true),
  ('74000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A', true),
  ('74000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000002', 'RESIDENT', '73000000-0000-0000-0000-000000000003', 'Bob Resident', true),
  ('74000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000002', 'GUARD', null, 'Guard B', true),
  ('74000000-0000-0000-0000-000000000007', '71000000-0000-0000-0000-000000000001', 'RESIDENT', '73000000-0000-0000-0000-000000000001', 'Inactive Resident', false);

select ok(has_function_privilege('authenticated', 'public.search_guard_residents(text)', 'EXECUTE'), 'authenticated role can execute minimal resident search');
select ok(not has_function_privilege('anon', 'public.search_guard_residents(text)', 'EXECUTE'), 'anonymous role cannot execute resident search');

set local role authenticated;
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.search_guard_residents('')), 2, 'guard sees active residents in own society');
select is((select count(*)::integer from public.search_guard_residents('') where society_id = '71000000-0000-0000-0000-000000000002'), 0, 'guard search excludes another society');
select is((select count(*)::integer from public.search_guard_residents('A-102')), 1, 'guard can search the projected tower and flat label');
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select * from public.search_guard_residents('') $$, '42501', 'Only guards can search residents', 'resident cannot search guard directory');
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000004', true);
select throws_ok($$ select * from public.search_guard_residents('') $$, '42501', 'Only guards can search residents', 'admin cannot use guard resident search');

select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000003', true);
select lives_ok($$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', '  Gate Guest  ', '+91 98765 43210', 'GUEST', '  mh 12 ab 1234  ', 'CAR') $$, 'guard atomically creates a pending request with optional vehicle details');
reset role;
select is(
  (select concat_ws('|', society_id, flat_id, raised_by, status::text) from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Gate Guest')),
  '71000000-0000-0000-0000-000000000001|73000000-0000-0000-0000-000000000001|74000000-0000-0000-0000-000000000003|PENDING',
  'guard request derives society, flat, actor, and pending status'
);
select is((select society_id::text from public.visitors where name = 'Gate Guest'), '71000000-0000-0000-0000-000000000001', 'created visitor inherits guard society');
select is(
  (select concat_ws('|', vehicle_number, vehicle_type::text) from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Gate Guest')),
  'MH 12 AB 1234|CAR',
  'guard vehicle details are normalized and stored on the visit'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000003', 'Cross Tenant', null, 'GUEST') $$,
  '42501', 'Flat is not available for visitor routing', 'guard cannot route to another society'
);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', 'Bad Phone', '123', 'GUEST') $$,
  '22023', 'Visitor phone number is invalid', 'invalid visitor data is rejected'
);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', 'Partial Vehicle', null, 'GUEST', 'MH12AB1234', null) $$,
  '22023', 'Choose a vehicle type and enter its registration number', 'partial vehicle details are rejected atomically'
);
reset role;
select is((select count(*)::integer from public.visitors where name in ('Cross Tenant', 'Bad Phone')), 0, 'failed guard calls leave no orphan visitors');

set local role authenticated;
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', 'Wrong Role', null, 'GUEST') $$,
  '42501', 'Only guards can create visitor requests', 'resident cannot create guard requests'
);
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', 'Wrong Role', null, 'GUEST') $$,
  '42501', 'Only guards can create visitor requests', 'admin cannot create guard requests'
);

select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000001', true);
select lives_ok($$ select public.create_resident_visitor_preapproval('  Expected Guest  ', null, 'GUEST', ' ka 01 zz 9999 ', 'CAR') $$, 'resident atomically creates own-flat pre-approval with optional vehicle details');
reset role;
select is(
  (select concat_ws('|', society_id, flat_id, decision_by, status::text, is_pre_approved::text) from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expected Guest')),
  '71000000-0000-0000-0000-000000000001|73000000-0000-0000-0000-000000000001|74000000-0000-0000-0000-000000000001|APPROVED|true',
  'pre-approval derives resident society and flat and records the decision'
);
select matches(
  (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expected Guest')),
  '^[0-9]{3} [0-9]{3}$',
  'server generates a six-digit gate pass'
);
select is(
  (select concat_ws('|', vehicle_number, vehicle_type::text) from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expected Guest')),
  'KA 01 ZZ 9999|CAR',
  'resident pre-approval stores normalized vehicle details on the visit'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_resident_visitor_preapproval('Wrong Role', null, 'GUEST') $$,
  '42501', 'Only assigned residents can pre-approve visitors', 'guard cannot create resident pre-approval'
);
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_resident_visitor_preapproval('Wrong Role', null, 'GUEST') $$,
  '42501', 'Only assigned residents can pre-approve visitors', 'admin cannot create resident pre-approval'
);
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000007', true);
select throws_ok(
  $$ select public.create_resident_visitor_preapproval('Inactive Attempt', null, 'GUEST') $$,
  '42501', 'Only assigned residents can pre-approve visitors', 'inactive resident cannot pre-approve'
);
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000003', true);
select throws_like(
  $$ insert into public.visitors (society_id, name, category) values ('71000000-0000-0000-0000-000000000001', 'Direct Visitor', 'GUEST') $$,
  '%permission denied%', 'authenticated clients cannot directly insert visitors'
);
select throws_like(
  $$ insert into public.visitor_requests (society_id, visitor_id, flat_id, raised_by) values ('71000000-0000-0000-0000-000000000001', gen_random_uuid(), '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000003') $$,
  '%permission denied%', 'authenticated clients cannot directly insert visitor requests'
);
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000006', true);
select throws_ok(
  $$ select public.create_guard_visitor_request('73000000-0000-0000-0000-000000000001', 'Cross Guard', null, 'GUEST') $$,
  '42501', 'Flat is not available for visitor routing', 'another-society guard cannot create request for this society'
);

select * from finish();
rollback;

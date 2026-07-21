begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into public.societies (id, name) values
  ('81000000-0000-0000-0000-000000000001', 'Active Pass Society'),
  ('81000000-0000-0000-0000-000000000002', 'Second Pass Society');

insert into public.towers (id, society_id, name, code) values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Tower A', 'A'),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'Tower B', 'B');

insert into public.flats (id, society_id, tower_id, number) values
  ('83000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '101'),
  ('83000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '102'),
  ('83000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', '201');

insert into auth.users (id) values
  ('84000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000002'),
  ('84000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000004'),
  ('84000000-0000-0000-0000-000000000005'),
  ('84000000-0000-0000-0000-000000000006');

insert into public.profiles (id, society_id, role, flat_id, full_name, is_active) values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'RESIDENT', '83000000-0000-0000-0000-000000000001', 'Pass Owner', true),
  ('84000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'RESIDENT', '83000000-0000-0000-0000-000000000002', 'Other Resident', true),
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'GUARD', null, 'Gate Guard', true),
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', 'GUARD', null, 'Second Guard', true),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Society Admin', true),
  ('84000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000002', 'RESIDENT', '83000000-0000-0000-0000-000000000003', 'Second Resident', true);

select ok(
  has_function_privilege('authenticated', 'public.revoke_resident_visitor_preapproval(uuid)', 'EXECUTE'),
  'authenticated users can call the guarded revoke function'
);
select ok(
  not has_function_privilege('anon', 'public.revoke_resident_visitor_preapproval(uuid)', 'EXECUTE'),
  'anonymous users cannot call the revoke function'
);
select ok(
  has_function_privilege('authenticated', 'public.lookup_guard_gate_pass(text)', 'EXECUTE'),
  'authenticated users can call the guarded lookup function'
);
select ok(
  not has_function_privilege('anon', 'public.lookup_guard_gate_pass(text)', 'EXECUTE'),
  'anonymous users cannot call the lookup function'
);
select ok(
  to_regclass('public.visitor_requests_active_gate_pass_code_uidx') is not null,
  'active gate-pass uniqueness index exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.create_resident_visitor_preapproval('Recoverable Guest', null, 'GUEST') $$,
  'resident creates a recoverable pre-approval'
);
reset role;

select ok(
  (select valid_until > decision_at + interval '23 hours'
      and valid_until <= decision_at + interval '24 hours 1 minute'
   from public.visitor_requests
   where visitor_id = (select id from public.visitors where name = 'Recoverable Guest')),
  'new gate pass receives a server-controlled 24-hour validity window'
);
select matches(
  (select gate_pass_code from public.visitor_requests
   where visitor_id = (select id from public.visitors where name = 'Recoverable Guest')),
  '^[0-9]{3} [0-9]{3}$',
  'resident receives a persisted six-digit gate-pass code'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select * from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) $$,
  '42501', 'Only active guards can verify gate passes',
  'resident cannot use guard gate-pass verification'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$ select * from public.lookup_guard_gate_pass('000 000') $$,
  '42501', 'Only active guards can verify gate passes',
  'admin cannot use guard gate-pass verification'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.revoke_resident_visitor_preapproval(
    (select id from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) $$,
  '42501', 'Gate pass is not available to this resident',
  'another resident cannot revoke the pass'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.revoke_resident_visitor_preapproval(
    (select id from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) $$,
  '42501', 'Only assigned residents can revoke gate passes',
  'guard cannot revoke the resident pass'
);
select lives_ok(
  $$ select * from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) $$,
  'same-society guard verifies the active pass'
);
select is(
  (select society_id::text from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) limit 1),
  '81000000-0000-0000-0000-000000000001',
  'guard lookup returns only the authenticated guard society'
);
reset role;

insert into public.visitors (id, society_id, name, category) values
  ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Duplicate Guest', 'GUEST'),
  ('85000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'Second Society Guest', 'GUEST');

select throws_ok(
  $$ insert into public.visitor_requests (
    id, society_id, visitor_id, flat_id, decision_by, status,
    is_pre_approved, gate_pass_code, decision_at, valid_until
  ) values (
    '86000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'APPROVED', true,
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest')),
    statement_timestamp(), statement_timestamp() + interval '24 hours'
  ) $$,
  '23505',
  'duplicate key value violates unique constraint "visitor_requests_active_gate_pass_code_uidx"',
  'two active passes in one society cannot share a code'
);

select lives_ok(
  $$ insert into public.visitor_requests (
    id, society_id, visitor_id, flat_id, decision_by, status,
    is_pre_approved, gate_pass_code, decision_at, valid_until
  ) values (
    '86000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000003',
    '84000000-0000-0000-0000-000000000006',
    'APPROVED', true,
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest')),
    statement_timestamp(), statement_timestamp() + interval '24 hours'
  ) $$,
  'the same active code is allowed in a different society'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000004', true);
select is(
  (select society_id::text from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where id = '86000000-0000-0000-0000-000000000002')
  ) limit 1),
  '81000000-0000-0000-0000-000000000002',
  'second-society guard resolves the same code only inside their society'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.revoke_resident_visitor_preapproval(
    (select id from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) $$,
  'owner revokes the active pass'
);
reset role;

select is(
  (select status::text from public.visitor_requests
   where visitor_id = (select id from public.visitors where name = 'Recoverable Guest')),
  'CANCELLED',
  'revoked pass remains in history as cancelled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000003', true);
select is(
  (select status::text from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Recoverable Guest'))
  ) limit 1),
  'CANCELLED',
  'guard lookup returns the truthful revoked status'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.create_resident_visitor_preapproval('Expired Guest', null, 'DELIVERY') $$,
  'resident creates another pass for expiry enforcement'
);
reset role;

update public.visitor_requests
set valid_until = statement_timestamp() - interval '1 minute'
where visitor_id = (select id from public.visitors where name = 'Expired Guest');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.mark_visitor_entry(
    (select id from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expired Guest'))
  ) $$,
  '22023', 'Gate pass has expired',
  'guard cannot enter an expired pass'
);
select is(
  (select status::text from public.lookup_guard_gate_pass(
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expired Guest'))
  ) limit 1),
  'EXPIRED',
  'indexed lookup returns the expired pass status truthfully'
);
reset role;

select is(
  (select status::text from public.visitor_requests
   where visitor_id = (select id from public.visitors where name = 'Expired Guest')),
  'EXPIRED',
  'lookup persists the expired status for history'
);

insert into public.visitors (id, society_id, name, category)
values ('85000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'Replacement Guest', 'GUEST');

select lives_ok(
  $$ insert into public.visitor_requests (
    id, society_id, visitor_id, flat_id, decision_by, status,
    is_pre_approved, gate_pass_code, decision_at, valid_until
  ) values (
    '86000000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000003',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'APPROVED', true,
    (select gate_pass_code from public.visitor_requests where visitor_id = (select id from public.visitors where name = 'Expired Guest')),
    statement_timestamp(), statement_timestamp() + interval '24 hours'
  ) $$,
  'expired codes are released for reuse without affecting active uniqueness'
);

select * from finish();
rollback;

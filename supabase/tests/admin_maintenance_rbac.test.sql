begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into public.societies (id, name) values
  ('85000000-0000-0000-0000-000000000001', 'Maintenance Society A'),
  ('85000000-0000-0000-0000-000000000002', 'Maintenance Society B');
insert into public.towers (id, society_id, name, code) values
  ('86000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'Tower A', 'A'),
  ('86000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000002', 'Tower B', 'B');
insert into public.flats (id, society_id, tower_id, number) values
  ('87000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '101'),
  ('87000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '102'),
  ('87000000-0000-0000-0000-000000000003', '85000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000002', '201');
insert into auth.users (id) values
  ('88000000-0000-0000-0000-000000000001'),
  ('88000000-0000-0000-0000-000000000002'),
  ('88000000-0000-0000-0000-000000000003'),
  ('88000000-0000-0000-0000-000000000004');
insert into public.profiles (id, society_id, role, full_name, is_active) values
  ('88000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'ADMIN', 'Admin A', true),
  ('88000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000001', 'GUARD', 'Guard A', true),
  ('88000000-0000-0000-0000-000000000003', '85000000-0000-0000-0000-000000000002', 'ADMIN', 'Admin B', true),
  ('88000000-0000-0000-0000-000000000004', '85000000-0000-0000-0000-000000000001', 'ADMIN', 'Inactive Admin', false);

select ok(has_function_privilege('authenticated', 'public.create_admin_maintenance_dues(uuid[],text,numeric,date)', 'EXECUTE'), 'authenticated users can reach the guarded invoice RPC');
select ok(not has_function_privilege('anon', 'public.create_admin_maintenance_dues(uuid[],text,numeric,date)', 'EXECUTE'), 'anonymous users cannot create invoices');

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select * from public.create_admin_maintenance_dues(
    array['87000000-0000-0000-0000-000000000001'::uuid, '87000000-0000-0000-0000-000000000002'::uuid],
    'August 2026',
    2750,
    '2026-08-10'
  ) $$,
  'admin creates invoices for selected own-society flats'
);
reset role;
select is((select count(*)::integer from public.maintenance_dues where society_id = '85000000-0000-0000-0000-000000000001'), 2, 'one invoice is created for each selected flat');
select is((select sum(amount) from public.maintenance_dues where society_id = '85000000-0000-0000-0000-000000000001'), 5500::numeric, 'invoice amount is applied authoritatively');
select is((select count(*)::integer from public.audit_events where action = 'Created maintenance invoices'), 1, 'batch invoice creation is audited');

select ok(has_function_privilege('authenticated', 'public.cancel_admin_maintenance_due(uuid,text)', 'EXECUTE'), 'authenticated users can reach the guarded cancellation RPC');
select ok(not has_function_privilege('anon', 'public.cancel_admin_maintenance_due(uuid,text)', 'EXECUTE'), 'anonymous users cannot cancel invoices');

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.cancel_admin_maintenance_due(
    (select id from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001'),
    'Duplicate invoice created during demo setup'
  ) $$,
  'admin cancels an unpaid own-society invoice'
);
reset role;
select ok((select cancelled_at is not null and cancelled_by = '88000000-0000-0000-0000-000000000001' from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001'), 'cancellation actor and timestamp persist');
select is((select cancel_reason from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001'), 'Duplicate invoice created during demo setup', 'cancellation reason persists');
select is((select count(*)::integer from public.audit_events where action like 'Cancelled maintenance invoice %'), 1, 'invoice cancellation is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.cancel_admin_maintenance_due((select id from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000002'), 'Guard attempt') $$,
  '42501', 'Only active society admins can cancel maintenance invoices',
  'guard cannot cancel invoices'
);
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.cancel_admin_maintenance_due((select id from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001'), 'Cross society') $$,
  '42501', 'Maintenance invoice is not available to this admin',
  'another society admin cannot cancel the invoice'
);
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.cancel_admin_maintenance_due((select id from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001'), 'Again') $$,
  '22023', 'Only an active unpaid invoice can be cancelled',
  'an already cancelled invoice cannot be cancelled again'
);
reset role;
select throws_ok(
  $$ insert into public.payments (due_id, society_id, flat_id, paid_by, amount, method, receipt_no)
     select id, society_id, flat_id, '88000000-0000-0000-0000-000000000001', amount, 'TEST', 'CANCELLED-TEST'
     from public.maintenance_dues where flat_id = '87000000-0000-0000-0000-000000000001' $$,
  '22023', 'Cancelled maintenance invoices cannot be paid',
  'payment insertion is blocked for a cancelled invoice'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array['87000000-0000-0000-0000-000000000001'::uuid], 'August 2026', 2750, '2026-08-10') $$,
  '23505',
  'An invoice already exists for this billing period',
  'duplicate billing period for a flat is rejected'
);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array['87000000-0000-0000-0000-000000000001'::uuid, '87000000-0000-0000-0000-000000000003'::uuid], 'September 2026', 2750, '2026-09-10') $$,
  '42501',
  'One or more flats are not available in this society',
  'mixed cross-society batch is rejected atomically'
);
reset role;
select is((select count(*)::integer from public.maintenance_dues where quarter_label = 'September 2026'), 0, 'failed cross-society batch creates no partial invoices');

set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array['87000000-0000-0000-0000-000000000001'::uuid], 'Guard attempt', 100, '2026-08-10') $$,
  '42501',
  'Only active society admins can create maintenance invoices',
  'guard cannot create invoices'
);
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array['87000000-0000-0000-0000-000000000001'::uuid], 'Inactive attempt', 100, '2026-08-10') $$,
  '42501',
  'Only active society admins can create maintenance invoices',
  'inactive admin cannot create invoices'
);
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array['87000000-0000-0000-0000-000000000001'::uuid], 'Zero amount', 0, '2026-08-10') $$,
  '22023',
  'Invoice amount must be greater than zero',
  'zero-value invoice is rejected'
);
select throws_ok(
  $$ select * from public.create_admin_maintenance_dues(array[]::uuid[], 'Empty selection', 100, '2026-08-10') $$,
  '22023',
  'Choose between 1 and 500 flats',
  'empty flat selection is rejected'
);
select throws_like(
  $$ insert into public.maintenance_dues (society_id, flat_id, quarter_label, amount, due_date) values ('85000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', 'Direct write', 1, '2026-08-10') $$,
  '%permission denied%',
  'authenticated clients cannot insert invoices directly'
);
select set_config('request.jwt.claim.sub', '88000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.maintenance_dues), 0, 'another society admin cannot see these invoices');
reset role;
select is((select count(*)::integer from public.maintenance_dues where society_id = '85000000-0000-0000-0000-000000000002'), 0, 'no cross-society invoice was created');

select * from finish();
rollback;

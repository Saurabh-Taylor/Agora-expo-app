begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.societies (id, name) values
  ('81000000-0000-0000-0000-000000000001', 'History Society A'),
  ('81000000-0000-0000-0000-000000000002', 'History Society B');
insert into public.towers (id, society_id, name, code) values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Alpha Tower', 'A'),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'Beta Tower', 'B');
insert into public.flats (id, society_id, tower_id, number, floor) values
  ('83000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '101', 1),
  ('83000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '102', 1),
  ('83000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', '201', 2);
insert into auth.users (id) values
  ('84000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000002'),
  ('84000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000004'),
  ('84000000-0000-0000-0000-000000000005'),
  ('84000000-0000-0000-0000-000000000006');
insert into public.profiles (id, society_id, role, flat_id, full_name, is_active) values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A', true),
  ('84000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'RESIDENT', '83000000-0000-0000-0000-000000000001', 'Resident A', true),
  ('84000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A', true),
  ('84000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', 'ADMIN', null, 'Admin B', true),
  ('84000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000002', 'RESIDENT', '83000000-0000-0000-0000-000000000003', 'Resident B', true),
  ('84000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Inactive Admin', false);
insert into public.visitors (id, society_id, name, category) values
  ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Guest One', 'GUEST'),
  ('85000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'Delivery Two', 'DELIVERY'),
  ('85000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', 'Cab Three', 'CAB'),
  ('85000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', 'Guest Four', 'GUEST');
insert into public.visitor_requests (
  id, society_id, visitor_id, flat_id, raised_by, status, created_at, decision_at, entry_at, exit_at
) values
  ('86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000003', 'PENDING', '2026-07-20 10:00:00+00', null, null, null),
  ('86000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000003', 'APPROVED', '2026-07-20 11:00:00+00', '2026-07-20 11:05:00+00', null, null),
  ('86000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000003', 'EXITED', '2026-07-20 12:00:00+00', '2026-07-20 12:05:00+00', '2026-07-20 12:10:00+00', '2026-07-20 12:20:00+00'),
  ('86000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000004', '83000000-0000-0000-0000-000000000003', null, 'APPROVED', '2026-07-20 13:00:00+00', '2026-07-20 13:05:00+00', null, null);

select ok(
  has_function_privilege('authenticated', 'public.list_admin_visitor_history(integer,timestamptz,uuid,timestamptz,visitor_request_status,visitor_category,uuid,text)', 'EXECUTE'),
  'authenticated role can call the checked history function'
);
select ok(
  not has_function_privilege('anon', 'public.list_admin_visitor_history(integer,timestamptz,uuid,timestamptz,visitor_request_status,visitor_category,uuid,text)', 'EXECUTE'),
  'anonymous role cannot call admin visitor history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)),
  3,
  'admin sees all own-society visitor history'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)
    where society_id = '81000000-0000-0000-0000-000000000002'),
  0,
  'history function never returns another society'
);
select is(
  (select string_agg(right(request_id::text, 1), ',' order by created_at desc, request_id desc)
    from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)),
  '3,2,1',
  'history is ordered newest first with a stable id tie-breaker'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, 'PENDING', null, null, null)),
  1,
  'status filter runs in Postgres'
);
select is(
  (select visitor_name from public.list_admin_visitor_history(25, null, null, null, null, 'DELIVERY', null, null)),
  'Delivery Two',
  'category filter runs in Postgres'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, '82000000-0000-0000-0000-000000000001', null)),
  3,
  'tower filter remains society scoped'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, null, '101')),
  2,
  'exact flat-number filter returns only matching flats'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, '2026-07-20 11:00:00+00', null, null, null, null)),
  2,
  'date filter runs in Postgres'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(2, null, null, null, null, null, null, null)),
  2,
  'page size bounds the returned records'
);
select is(
  (select request_id::text from public.list_admin_visitor_history(2, '2026-07-20 11:00:00+00', '86000000-0000-0000-0000-000000000002', null, null, null, null, null)),
  '86000000-0000-0000-0000-000000000001',
  'cursor returns the next record without overlap'
);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(51, null, null, null, null, null, null, null) $$,
  '22023',
  'History page size must be between 1 and 50',
  'oversized history pages are rejected'
);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(25, '2026-07-20 11:00:00+00', null, null, null, null, null, null) $$,
  '22023',
  'History cursor is incomplete',
  'partial cursors are rejected'
);
select is(
  (select count(*)::integer from public.visitor_requests where society_id = '81000000-0000-0000-0000-000000000001'),
  3,
  'admin RLS directly exposes own-society request rows'
);
select is(
  (select count(*)::integer from public.visitor_requests where society_id = '81000000-0000-0000-0000-000000000002'),
  0,
  'admin RLS hides cross-society request rows'
);
select throws_like(
  $$ update public.visitor_requests set status = 'REJECTED' where id = '86000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'admin visitor history remains read only'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(25, null, null, null, null, null, null, null) $$,
  '42501',
  'Only admins can view admin visitor history',
  'resident cannot call the admin history endpoint'
);
select is(
  (select count(*)::integer from public.visitor_requests),
  2,
  'resident direct reads remain limited to their own flat'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(25, null, null, null, null, null, null, null) $$,
  '42501',
  'Only admins can view admin visitor history',
  'guard cannot call the admin history endpoint'
);
select is(
  (select count(*)::integer from public.visitor_requests),
  3,
  'guard operational society history access is preserved'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000006', true);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(25, null, null, null, null, null, null, null) $$,
  '42501',
  'Only admins can view admin visitor history',
  'inactive admin cannot read visitor history'
);

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)),
  1,
  'second admin sees only the second society'
);
select is(
  (select distinct society_id::text from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)),
  '81000000-0000-0000-0000-000000000002',
  'returned society scope is derived from the authenticated admin'
);

select * from finish();
rollback;

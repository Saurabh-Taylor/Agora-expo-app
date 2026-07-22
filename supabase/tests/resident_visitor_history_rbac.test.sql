begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into public.societies (id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'Resident History Society A'),
  ('a1000000-0000-0000-0000-000000000002', 'Resident History Society B');

insert into public.towers (id, society_id, name, code) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Alpha', 'A'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Beta', 'B');

insert into public.flats (id, society_id, tower_id, number, floor) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', '101', 1),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', '102', 1),
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', '201', 2);

insert into auth.users (id) values
  ('a4000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000002'),
  ('a4000000-0000-0000-0000-000000000003'),
  ('a4000000-0000-0000-0000-000000000004'),
  ('a4000000-0000-0000-0000-000000000005'),
  ('a4000000-0000-0000-0000-000000000006');

insert into public.profiles (id, society_id, role, flat_id, full_name, is_active) values
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'RESIDENT', 'a3000000-0000-0000-0000-000000000001', 'Resident A101', true),
  ('a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'RESIDENT', 'a3000000-0000-0000-0000-000000000002', 'Resident A102', true),
  ('a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'RESIDENT', 'a3000000-0000-0000-0000-000000000003', 'Resident B201', true),
  ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A', true),
  ('a4000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A', true),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'RESIDENT', 'a3000000-0000-0000-0000-000000000001', 'Inactive Resident', false);

insert into public.visitors (id, society_id, name, phone, category) values
  ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Guest One', '9000000001', 'GUEST'),
  ('a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Guest Two', '9000000002', 'GUEST'),
  ('a5000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Delivery Three', '9000000003', 'DELIVERY'),
  ('a5000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Other Flat', '9000000004', 'GUEST'),
  ('a5000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'Other Society', '9000000005', 'GUEST');

insert into public.visitor_requests (
  id, society_id, visitor_id, flat_id, status, created_at, decision_at, entry_at, exit_at
) values
  ('a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'ENTERED', '2026-07-20 08:00:00+00', '2026-07-20 08:05:00+00', '2026-07-20 08:10:00+00', null),
  ('a6000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'EXITED', '2026-07-21 08:00:00+00', '2026-07-21 08:05:00+00', '2026-07-21 08:10:00+00', '2026-07-21 09:00:00+00'),
  ('a6000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001', 'EXITED', '2026-07-22 08:00:00+00', '2026-07-22 08:05:00+00', '2026-07-22 08:10:00+00', '2026-07-22 08:40:00+00'),
  ('a6000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000002', 'EXITED', '2026-07-22 07:00:00+00', '2026-07-22 07:05:00+00', '2026-07-22 07:10:00+00', '2026-07-22 07:40:00+00'),
  ('a6000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000003', 'EXITED', '2026-07-22 06:00:00+00', '2026-07-22 06:05:00+00', '2026-07-22 06:10:00+00', '2026-07-22 06:40:00+00');

select ok(
  has_function_privilege('authenticated', 'public.list_resident_visitor_history(integer,timestamptz,uuid,timestamptz,timestamptz,visitor_request_status,visitor_category,boolean)', 'EXECUTE'),
  'authenticated role can call resident visitor history'
);
select ok(
  not has_function_privilege('anon', 'public.list_resident_visitor_history(integer,timestamptz,uuid,timestamptz,timestamptz,visitor_request_status,visitor_category,boolean)', 'EXECUTE'),
  'anonymous role cannot call resident visitor history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);

select is(((public.list_resident_visitor_history())->>'total_count')::integer, 3, 'resident sees all visits for own flat');
select is(jsonb_array_length(public.list_resident_visitor_history()->'items'), 3, 'resident history returns own-flat visit rows');
select is(
  (select count(*)::integer from jsonb_array_elements(public.list_resident_visitor_history()->'items') item where item->>'society_id' <> 'a1000000-0000-0000-0000-000000000001'),
  0,
  'resident history never returns another society'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.list_resident_visitor_history()->'items') item where item->>'flat_id' <> 'a3000000-0000-0000-0000-000000000001'),
  0,
  'resident history never returns another flat'
);
select is(public.list_resident_visitor_history()->'items'->0->>'request_id', 'a6000000-0000-0000-0000-000000000003', 'history is newest first');
select is(((public.list_resident_visitor_history(requested_since => '2026-07-21 00:00:00+00'))->>'total_count')::integer, 2, 'start date filters entry time');
select is(((public.list_resident_visitor_history(requested_until => '2026-07-21 00:00:00+00'))->>'total_count')::integer, 1, 'end date filters entry time');
select is(((public.list_resident_visitor_history(requested_status => 'ENTERED'))->>'total_count')::integer, 1, 'inside filter is server-side');
select is(((public.list_resident_visitor_history(requested_category => 'DELIVERY'))->>'total_count')::integer, 1, 'visitor type filter is server-side');
select is(jsonb_array_length(public.list_resident_visitor_history(requested_limit => 2)->'items'), 2, 'page size bounds results');
select is(
  public.list_resident_visitor_history(
    requested_limit => 2,
    cursor_entry_at => '2026-07-21 08:10:00+00',
    cursor_id => 'a6000000-0000-0000-0000-000000000002'
  )->'items'->0->>'request_id',
  'a6000000-0000-0000-0000-000000000001',
  'cursor returns the next older visit without overlap'
);
select throws_ok(
  $$ select public.list_resident_visitor_history(cursor_entry_at => '2026-07-21 08:10:00+00') $$,
  '22023', 'Resident history cursor is incomplete', 'partial cursors are rejected'
);
select throws_ok(
  $$ select public.list_resident_visitor_history(requested_since => '2026-07-22 00:00:00+00', requested_until => '2026-07-21 00:00:00+00') $$,
  '22023', 'Resident history date range is invalid', 'invalid date ranges are rejected'
);
select throws_ok(
  $$ select public.list_resident_visitor_history(requested_status => 'PENDING') $$,
  '22023', 'Resident history status must be Inside or Exited', 'non-visit statuses are rejected'
);
select throws_ok(
  $$ select public.list_resident_visitor_history(requested_limit => 52) $$,
  '22023', 'Resident history page size must be between 1 and 51', 'oversized pages are rejected'
);

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000002', true);
select is(((public.list_resident_visitor_history())->>'total_count')::integer, 1, 'second resident sees only the second flat');

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000003', true);
select is(((public.list_resident_visitor_history())->>'total_count')::integer, 1, 'other-society resident sees only own society flat');

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.list_resident_visitor_history() $$,
  '42501', 'Active resident flat assignment is required', 'guard cannot call resident visitor history'
);

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$ select public.list_resident_visitor_history() $$,
  '42501', 'Active resident flat assignment is required', 'admin cannot call resident visitor history'
);

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000006', true);
select throws_ok(
  $$ select public.list_resident_visitor_history() $$,
  '42501', 'Active resident flat assignment is required', 'inactive resident cannot call resident visitor history'
);

select * from finish();
rollback;

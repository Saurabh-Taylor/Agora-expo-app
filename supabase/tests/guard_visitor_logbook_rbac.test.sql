begin;

create extension if not exists pgtap with schema extensions;
select plan(47);

insert into public.societies (id, name) values
  ('91000000-0000-0000-0000-000000000001', 'Logbook Society A'),
  ('91000000-0000-0000-0000-000000000002', 'Logbook Society B');

insert into public.towers (id, society_id, name, code) values
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Alpha Tower', 'A'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Charlie Tower', 'C'),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000002', 'Beta Tower', 'B');

insert into public.flats (id, society_id, tower_id, number, floor) values
  ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '101', 1),
  ('93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '102', 1),
  ('93000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '101', 1),
  ('93000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000003', '201', 2);

insert into auth.users (id) values
  ('94000000-0000-0000-0000-000000000001'),
  ('94000000-0000-0000-0000-000000000002'),
  ('94000000-0000-0000-0000-000000000003'),
  ('94000000-0000-0000-0000-000000000004'),
  ('94000000-0000-0000-0000-000000000005');

insert into public.profiles (id, society_id, role, flat_id, full_name, is_active) values
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A', true),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A', true),
  ('94000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'RESIDENT', '93000000-0000-0000-0000-000000000001', 'Resident A', true),
  ('94000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', 'GUARD', null, 'Inactive Guard', false),
  ('94000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000002', 'GUARD', null, 'Guard B', true);

insert into public.visitors (id, society_id, name, phone, category) values
  ('95000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Guest One', '9000000001', 'GUEST'),
  ('95000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Delivery Two', '9000000002', 'DELIVERY'),
  ('95000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'Pending Three', '9000000003', 'GUEST'),
  ('95000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', 'Cab Four', '9000000004', 'CAB'),
  ('95000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000002', 'Guest Five', '9000000005', 'GUEST');

insert into public.visitor_requests (
  id, society_id, visitor_id, flat_id, raised_by, status, created_at, decision_at, entry_at, exit_at
) values
  ('96000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'ENTERED', '2026-07-20 09:50:00+00', '2026-07-20 09:55:00+00', '2026-07-20 10:00:00+00', null),
  ('96000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000001', 'EXITED', '2026-07-21 10:50:00+00', '2026-07-21 10:55:00+00', '2026-07-21 11:00:00+00', '2026-07-21 11:30:00+00'),
  ('96000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'PENDING', '2026-07-22 08:00:00+00', null, null, null),
  ('96000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000001', 'EXITED', '2026-07-22 08:50:00+00', '2026-07-22 08:55:00+00', '2026-07-22 09:00:00+00', '2026-07-22 09:20:00+00'),
  ('96000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000004', '94000000-0000-0000-0000-000000000005', 'EXITED', '2026-07-22 07:50:00+00', '2026-07-22 07:55:00+00', '2026-07-22 08:00:00+00', '2026-07-22 08:30:00+00');

select ok(
  has_function_privilege('authenticated', 'public.list_society_visitor_logbook(integer,timestamptz,uuid,timestamptz,timestamptz,visitor_request_status,visitor_category,uuid,uuid,text,boolean,boolean)', 'EXECUTE'),
  'authenticated role can call the checked logbook function'
);
select ok(
  not has_function_privilege('anon', 'public.list_society_visitor_logbook(integer,timestamptz,uuid,timestamptz,timestamptz,visitor_request_status,visitor_category,uuid,uuid,text,boolean,boolean)', 'EXECUTE'),
  'anonymous role cannot call the logbook function'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);

select is(
  ((public.list_society_visitor_logbook())->>'total_count')::integer,
  3,
  'guard default total counts actual visits'
);
select is(
  jsonb_array_length(public.list_society_visitor_logbook()->'items'),
  3,
  'guard default items exclude requests that never entered'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.list_society_visitor_logbook()->'items') item
    where item->>'society_id' <> '91000000-0000-0000-0000-000000000001'),
  0,
  'guard logbook never returns another society'
);
select is(
  public.list_society_visitor_logbook()->'items'->0->>'request_id',
  '96000000-0000-0000-0000-000000000001',
  'visit register is ordered by entry time oldest first'
);
select is(
  public.list_society_visitor_logbook()->'items'->0->>'vehicle_number',
  null,
  'logbook preserves null vehicle metadata for existing visits'
);
select is(
  ((public.list_society_visitor_logbook(requested_tower_id => '92000000-0000-0000-0000-000000000001'))->>'total_count')::integer,
  2,
  'tower filter returns the exact entered-visit count'
);
select is(
  ((public.list_society_visitor_logbook(requested_tower_id => '92000000-0000-0000-0000-000000000001', requested_flat_id => '93000000-0000-0000-0000-000000000001'))->>'total_count')::integer,
  1,
  'flat id filter is unambiguous inside a selected tower'
);
select is(
  ((public.list_society_visitor_logbook(requested_category => 'DELIVERY'))->>'total_count')::integer,
  1,
  'visitor category filter runs in Postgres'
);
select is(
  ((public.list_society_visitor_logbook(requested_since => '2026-07-21 00:00:00+00'))->>'total_count')::integer,
  2,
  'visit start date filters on entry time'
);
select is(
  ((public.list_society_visitor_logbook(requested_until => '2026-07-21 00:00:00+00'))->>'total_count')::integer,
  1,
  'visit end date filters on entry time'
);
select is(
  ((public.list_society_visitor_logbook(requested_status => 'EXITED'))->>'total_count')::integer,
  2,
  'status filter combines with entered visits'
);
select is(
  ((public.list_society_visitor_logbook(requested_entry_only => false))->>'total_count')::integer,
  4,
  'all-request mode includes requests that never entered'
);
select is(
  jsonb_array_length(public.list_society_visitor_logbook(requested_limit => 2)->'items'),
  2,
  'server page size bounds the returned items'
);
select is(
  public.list_society_visitor_logbook(
    requested_limit => 2,
    cursor_activity_at => '2026-07-21 11:00:00+00',
    cursor_id => '96000000-0000-0000-0000-000000000002'
  )->'items'->0->>'request_id',
  '96000000-0000-0000-0000-000000000004',
  'ascending cursor returns the next visit without overlap'
);
select is(
  public.list_society_visitor_logbook(requested_include_total => false)->>'total_count',
  null,
  'later pages may skip the exact count'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(cursor_activity_at => '2026-07-21 11:00:00+00') $$,
  '22023',
  'Logbook cursor is incomplete',
  'partial cursors are rejected'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(requested_limit => 52) $$,
  '22023',
  'Logbook page size must be between 1 and 51',
  'oversized pages are rejected'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(requested_since => '2026-07-22 00:00:00+00', requested_until => '2026-07-21 00:00:00+00') $$,
  '22023',
  'Logbook date range is invalid',
  'invalid date ranges are rejected'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(requested_tower_id => '92000000-0000-0000-0000-000000000003') $$,
  '22023',
  'Tower filter is not available in this society',
  'cross-society tower filters are rejected'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(requested_flat_id => '93000000-0000-0000-0000-000000000004') $$,
  '22023',
  'Flat filter is not available in this society',
  'cross-society flat filters are rejected'
);
select throws_ok(
  $$ select public.list_society_visitor_logbook(requested_tower_id => '92000000-0000-0000-0000-000000000001', requested_flat_id => '93000000-0000-0000-0000-000000000003') $$,
  '22023',
  'Flat filter does not belong to the selected tower',
  'tower and flat filters cannot form an ambiguous relationship'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.list_society_visitor_logbook() $$,
  '42501',
  'Only guards and admins can view the society visitor logbook',
  'resident cannot call the society logbook'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select is(
  ((public.list_society_visitor_logbook())->>'total_count')::integer,
  3,
  'admin can use the shared read-only history core'
);
select is(
  (select count(*)::integer from public.list_admin_visitor_history(25, null, null, null, null, null, null, null)),
  4,
  'legacy admin history wrapper remains compatible'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select * from public.list_admin_visitor_history(25, null, null, null, null, null, null, null) $$,
  '42501',
  'Only admins can view admin visitor history',
  'guard still cannot call the admin-only compatibility endpoint'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.list_society_visitor_logbook() $$,
  '42501',
  'Active society membership is required',
  'inactive guard cannot read the logbook'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000005', true);
select is(
  ((public.list_society_visitor_logbook())->>'total_count')::integer,
  1,
  'second-society guard sees only the second society'
);



reset role;

insert into public.visitors (id, society_id, name, phone, category)
values (
  '95000000-0000-0000-0000-000000000006',
  '91000000-0000-0000-0000-000000000001',
  'June Guest',
  '9000000006',
  'GUEST'
);

insert into public.visitor_requests (
  id, society_id, visitor_id, flat_id, raised_by, status, created_at, decision_at, entry_at, exit_at
)
values (
  '96000000-0000-0000-0000-000000000006',
  '91000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000006',
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  'EXITED',
  '2026-06-15 09:50:00+00',
  '2026-06-15 09:55:00+00',
  '2026-06-15 10:00:00+00',
  '2026-06-15 10:30:00+00'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);
select is(
  public.list_society_visitor_logbook(
    requested_since => '2026-07-01 00:00:00+00',
    requested_until => '2026-08-01 00:00:00+00'
  )->'items'->0->>'register_number',
  '1',
  'July register starts at 001'
);
select is(
  public.list_society_visitor_logbook(
    requested_since => '2026-06-01 00:00:00+00',
    requested_until => '2026-07-01 00:00:00+00'
  )->'items'->0->>'register_number',
  '1',
  'June register independently starts at 001'
);

select is(
  public.list_society_visitor_logbook(
    requested_tower_id => '92000000-0000-0000-0000-000000000002'
  )->'items'->0->>'register_number',
  '3',
  'location filtering preserves the original monthly register number'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.search_guard_logbook_locations(text,integer)',
    'EXECUTE'
  ),
  'authenticated role can call checked location search'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.search_guard_logbook_locations(text,integer)',
    'EXECUTE'
  ),
  'anonymous role cannot call location search'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('A', 20)),
  3,
  'guard search returns matching own-society tower and flats'
);

select is(
  (select count(*)::integer from public.search_guard_logbook_locations('Tower A', 20)),
  3,
  'guard can search using a natural Tower A phrase'
);

select is(
  (select result_type from public.search_guard_logbook_locations('A', 20) limit 1),
  'TOWER',
  'exact tower code ranks before its matching flats'
);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('A-101', 20)),
  1,
  'combined tower-flat search resolves one unambiguous flat'
);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('101', 20)),
  2,
  'flat-number search can return same-number flats in different towers'
);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('A', 1)),
  1,
  'server result limit bounds location search'
);
select throws_ok(
  $$ select * from public.search_guard_logbook_locations('', 20) $$,
  '22023',
  'Location search must contain between 1 and 40 characters',
  'blank location search is rejected'
);
select throws_ok(
  $$ select * from public.search_guard_logbook_locations('A', 21) $$,
  '22023',
  'Location result limit must be between 1 and 20',
  'oversized location result limits are rejected'
);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('B', 20)),
  0,
  'guard cannot discover another society location'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select * from public.search_guard_logbook_locations('A', 20) $$,
  '42501',
  'Only guards and admins can search logbook locations',
  'resident cannot search society logbook locations'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('A-101', 20)),
  1,
  'admin can use the shared read-only location search'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select * from public.search_guard_logbook_locations('A', 20) $$,
  '42501',
  'Active society membership is required',
  'inactive guard cannot search logbook locations'
);

select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000005', true);
select is(
  (select count(*)::integer from public.search_guard_logbook_locations('B', 20)),
  2,
  'second-society guard sees only the matching second-society tower and flat'
);

select * from finish();
rollback;

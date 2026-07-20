begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

insert into public.societies (id, name) values
  ('15000000-0000-0000-0000-000000000001', 'Poll Test Society A'),
  ('15000000-0000-0000-0000-000000000002', 'Poll Test Society B');
insert into auth.users (id) values
  ('45000000-0000-0000-0000-000000000001'),
  ('45000000-0000-0000-0000-000000000002'),
  ('45000000-0000-0000-0000-000000000003'),
  ('45000000-0000-0000-0000-000000000004'),
  ('45000000-0000-0000-0000-000000000005'),
  ('45000000-0000-0000-0000-000000000006');
insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'Tower A', 'TA', 1, 2),
  ('25000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'Tower B', 'TB', 1, 1);
insert into public.flats (id, society_id, tower_id, number, floor) values
  ('35000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '101', 1),
  ('35000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '102', 1),
  ('35000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000002', '101', 1);
insert into public.profiles (id, society_id, role, flat_id, occupancy_type, full_name) values
  ('45000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'ADMIN', null, null, 'Admin A'),
  ('45000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'ADMIN', null, null, 'Admin B'),
  ('45000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', 'RESIDENT', '35000000-0000-0000-0000-000000000001', 'OWNER', 'Resident A1'),
  ('45000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000001', 'GUARD', null, null, 'Guard A'),
  ('45000000-0000-0000-0000-000000000005', '15000000-0000-0000-0000-000000000002', 'RESIDENT', '35000000-0000-0000-0000-000000000003', 'OWNER', 'Resident B'),
  ('45000000-0000-0000-0000-000000000006', '15000000-0000-0000-0000-000000000001', 'RESIDENT', '35000000-0000-0000-0000-000000000002', 'TENANT', 'Resident A2');

insert into public.polls (id, society_id, question, state, created_by, closes_at, archived_at) values
  ('55000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'Active A?', 'ACTIVE', '45000000-0000-0000-0000-000000000001', now() + interval '1 day', null),
  ('55000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'Closed A?', 'CLOSED', '45000000-0000-0000-0000-000000000001', now(), null),
  ('55000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', 'Archived A?', 'CLOSED', '45000000-0000-0000-0000-000000000001', now(), now()),
  ('55000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000002', 'Active B?', 'ACTIVE', '45000000-0000-0000-0000-000000000002', null, null),
  ('55000000-0000-0000-0000-000000000005', '15000000-0000-0000-0000-000000000001', 'Expired A?', 'ACTIVE', '45000000-0000-0000-0000-000000000001', now() - interval '1 minute', null);

insert into public.poll_options (id, poll_id, society_id, label, sort_order) values
  ('65000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'Yes', 0),
  ('65000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'No', 1),
  ('65000000-0000-0000-0000-000000000003', '55000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'One', 0),
  ('65000000-0000-0000-0000-000000000004', '55000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'Two', 1),
  ('65000000-0000-0000-0000-000000000005', '55000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', 'Old', 0),
  ('65000000-0000-0000-0000-000000000006', '55000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000002', 'Other', 0),
  ('65000000-0000-0000-0000-000000000007', '55000000-0000-0000-0000-000000000005', '15000000-0000-0000-0000-000000000001', 'Late', 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.polls), 3, 'resident sees non-archived own-society polls');
select is((select count(*)::integer from public.polls where society_id = '15000000-0000-0000-0000-000000000002'), 0, 'resident cannot read cross-society polls');
select is((select count(*)::integer from public.poll_options), 5, 'resident sees options only for visible own-society polls');
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.polls), 0, 'guard has no poll workflow');
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.polls), 4, 'admin sees active closed expired and archived own-society polls');
select is((select count(*)::integer from public.polls where society_id = '15000000-0000-0000-0000-000000000002'), 0, 'admin cannot read cross-society polls');

select lives_ok(
  $$ select public.create_admin_poll('  New community poll?  ', array[' First ', 'Second', 'Third'], now() + interval '3 days') $$,
  'admin atomically creates a poll'
);
reset role;
select is((select count(*)::integer from public.poll_options where poll_id = (select id from public.polls where question = 'New community poll?')), 3, 'atomic creation writes every option');
select is((select min(sort_order) from public.poll_options where poll_id = (select id from public.polls where question = 'New community poll?')), 0, 'created options are ordered from zero');

set local role authenticated;
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_admin_poll('Resident poll?', array['Yes', 'No'], null) $$,
  '42501',
  'Only active society admins can create polls',
  'resident cannot create polls'
);
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_admin_poll('Guard poll?', array['Yes', 'No'], null) $$,
  '42501',
  'Only active society admins can create polls',
  'guard cannot create polls'
);
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.create_admin_poll('Duplicates?', array['Yes', ' yes '], null) $$,
  '22023',
  'Poll options must be unique',
  'duplicate options are rejected'
);
select throws_ok(
  $$ select public.create_admin_poll('Past close?', array['Yes', 'No'], now() - interval '1 minute') $$,
  '22023',
  'Poll closing time must be in the future',
  'past closing times are rejected'
);

select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.close_admin_poll('55000000-0000-0000-0000-000000000001') $$,
  '42501',
  'Poll is not available to this admin',
  'admin cannot close a cross-society poll'
);

select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000001') $$,
  'resident votes in an active own-society poll'
);
reset role;
select is((select vote_count from public.poll_options where id = '65000000-0000-0000-0000-000000000001'), 1, 'vote atomically increments aggregate count');

set local role authenticated;
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.poll_votes), 1, 'resident can read own vote row');
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000006', true);
select is((select count(*)::integer from public.poll_votes), 0, 'another resident cannot read voter identity');
select is((select vote_count from public.poll_options where id = '65000000-0000-0000-0000-000000000001'), 1, 'another resident can read anonymous aggregate results');

select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000002') $$,
  '23505',
  'You have already voted in this poll',
  'resident cannot change or duplicate a vote'
);
select throws_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000006') $$,
  '22023',
  'The selected option does not belong to this poll',
  'resident cannot submit an option from another poll or society'
);
select throws_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000005', '65000000-0000-0000-0000-000000000007') $$,
  '22023',
  'This poll is closed',
  'resident cannot vote after the automatic closing time'
);
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000002') $$,
  '42501',
  'Only active residents assigned to a flat can vote',
  'guard cannot vote'
);

select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.close_admin_poll('55000000-0000-0000-0000-000000000001') $$,
  'admin closes an own-society poll'
);
reset role;
select is((select state::text from public.polls where id = '55000000-0000-0000-0000-000000000001'), 'CLOSED', 'closed state persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.cast_poll_vote('55000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000002') $$,
  '22023',
  'This poll is closed',
  'resident cannot vote after manual close'
);
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.archive_admin_poll('55000000-0000-0000-0000-000000000005') $$,
  '22023',
  'Close the poll before archiving it',
  'admin must explicitly close an expired active poll before archiving'
);
select lives_ok(
  $$ select public.archive_admin_poll('55000000-0000-0000-0000-000000000001') $$,
  'admin archives a closed poll'
);
reset role;
select ok((select archived_at is not null from public.polls where id = '55000000-0000-0000-0000-000000000001'), 'archive timestamp persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.polls where id = '55000000-0000-0000-0000-000000000001'), 0, 'archived poll disappears from resident reads');
select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.polls set question = 'Direct mutation' where id = '55000000-0000-0000-0000-000000000002' $$,
  '%permission denied%',
  'direct poll mutations are denied'
);
reset role;
select is((select count(*)::integer from public.audit_events where society_id = '15000000-0000-0000-0000-000000000001'), 3, 'poll lifecycle actions are audited');

select * from finish();
rollback;

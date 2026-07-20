begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

insert into public.societies (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Society A'),
  ('10000000-0000-0000-0000-000000000002', 'Society B');
insert into public.towers (id, society_id, name, code) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Tower A', 'A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Tower B', 'B');
insert into public.flats (id, society_id, tower_id, number) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '101'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '102'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '201');
insert into auth.users (id) values
  ('40000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000005'),
  ('40000000-0000-0000-0000-000000000006');
insert into public.profiles (id, society_id, role, flat_id, full_name) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'RESIDENT', '30000000-0000-0000-0000-000000000001', 'Resident A'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'RESIDENT', '30000000-0000-0000-0000-000000000002', 'Resident A2'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'GUARD', null, 'Guard A'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'ADMIN', null, 'Admin A'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'RESIDENT', '30000000-0000-0000-0000-000000000003', 'Resident B'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'GUARD', null, 'Guard B');
insert into public.visitors (id, society_id, name, category) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Visitor A', 'GUEST'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Visitor B', 'GUEST');
insert into public.visitor_requests (id, society_id, visitor_id, flat_id, raised_by, status, entry_at) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'PENDING', null),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', 'PENDING', null),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000006', 'PENDING', null),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'APPROVED', null),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'ENTERED', now()),
  ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000006', 'APPROVED', null);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select lives_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000001', 'APPROVED') $$, 'resident decides own-flat pending request');
reset role;
select is((select status::text from public.visitor_requests where id = '60000000-0000-0000-0000-000000000001'), 'APPROVED', 'decision is persisted');
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000001', 'REJECTED') $$, '22023', 'Visitor request has already been decided', 'duplicate decision is rejected');
select throws_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000002', 'APPROVED') $$, '42501', 'Visitor request is not available to this resident', 'resident cannot decide another flat request');
select throws_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000003', 'APPROVED') $$, '42501', 'Visitor request is not available to this resident', 'resident cannot decide cross-society request');
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select throws_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000002', 'APPROVED') $$, '42501', 'Only residents can decide visitor requests', 'guard cannot decide request');
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select throws_ok($$ select public.decide_visitor_request('60000000-0000-0000-0000-000000000002', 'APPROVED') $$, '42501', 'Only residents can decide visitor requests', 'admin cannot decide request');
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select lives_ok($$ select public.mark_visitor_entry('60000000-0000-0000-0000-000000000004') $$, 'same-society guard marks approved entry');
reset role;
select is((select status::text from public.visitor_requests where id = '60000000-0000-0000-0000-000000000004'), 'ENTERED', 'entry status is persisted');
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000006', true);
select throws_ok($$ select public.mark_visitor_entry('60000000-0000-0000-0000-000000000004') $$, '42501', 'Visitor request is not available to this guard', 'cross-society guard cannot mark entry');
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select throws_ok($$ select public.mark_visitor_entry('60000000-0000-0000-0000-000000000002') $$, '22023', 'Only an approved visitor can enter', 'guard cannot skip pending to entered');
select lives_ok($$ select public.mark_visitor_exit('60000000-0000-0000-0000-000000000005') $$, 'same-society guard marks entered exit');
reset role;
select is((select status::text from public.visitor_requests where id = '60000000-0000-0000-0000-000000000005'), 'EXITED', 'exit status is persisted');
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select throws_ok($$ select public.mark_visitor_entry('60000000-0000-0000-0000-000000000006') $$, '42501', 'Only guards can mark visitor entry', 'resident cannot mark entry');
select throws_like($$ update public.visitor_requests set status = 'EXITED' where id = '60000000-0000-0000-0000-000000000004' $$, '%permission denied%', 'direct visitor updates are denied');
select is((select count(*)::integer from public.visitor_requests where society_id = '10000000-0000-0000-0000-000000000002'), 0, 'RLS hides cross-society requests');
reset role;
select throws_like($$ insert into public.visitor_requests (society_id, visitor_id, flat_id, status) values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'PENDING') $$, '%violates foreign key constraint%', 'cross-society relationships are rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select throws_like($$ update public.profiles set role = 'GUARD', flat_id = null where id = '40000000-0000-0000-0000-000000000001' $$, '%permission denied%', 'resident cannot escalate profile role');

select throws_like($$ insert into public.visitor_requests (id, society_id, visitor_id, flat_id, status, is_pre_approved, decision_by, decision_at, gate_pass_code) values ('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'APPROVED', true, '40000000-0000-0000-0000-000000000001', now(), '111 222') $$, '%permission denied%', 'resident cannot directly pre-approve another flat');
select throws_like($$ insert into public.visitor_requests (id, society_id, visitor_id, flat_id, status, is_pre_approved, decision_by, decision_at, gate_pass_code) values ('60000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'EXITED', true, '40000000-0000-0000-0000-000000000001', now(), '111 222') $$, '%permission denied%', 'resident cannot directly create an invalid visitor state');
select throws_like($$ insert into public.visitor_requests (id, society_id, visitor_id, flat_id, status, is_pre_approved, decision_by, decision_at, gate_pass_code) values ('60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'APPROVED', true, '40000000-0000-0000-0000-000000000001', now(), '111 222') $$, '%permission denied%', 'resident must use the atomic pre-approval function');
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select throws_like($$ insert into public.visitor_requests (id, society_id, visitor_id, flat_id, raised_by, status) values ('60000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'APPROVED') $$, '%permission denied%', 'guard cannot directly create an approved request');
select throws_like($$ insert into public.visitor_requests (id, society_id, visitor_id, flat_id, raised_by, status) values ('60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'PENDING') $$, '%permission denied%', 'guard must use the atomic request function');

select * from finish();
rollback;

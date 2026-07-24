begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.societies (id, name) values
  ('83000000-0000-0000-0000-000000000001', 'Guard Admin Society A'),
  ('83000000-0000-0000-0000-000000000002', 'Guard Admin Society B');
insert into auth.users (id) values
  ('84000000-0000-0000-0000-000000000001'),
  ('84000000-0000-0000-0000-000000000002'),
  ('84000000-0000-0000-0000-000000000003'),
  ('84000000-0000-0000-0000-000000000004'),
  ('84000000-0000-0000-0000-000000000005'),
  ('84000000-0000-0000-0000-000000000006');
insert into public.profiles (id, society_id, role, full_name, is_active) values
  ('84000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'ADMIN', 'Admin A', true),
  ('84000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001', 'GUARD', 'Guard A', true),
  ('84000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000002', 'ADMIN', 'Admin B', true),
  ('84000000-0000-0000-0000-000000000004', '83000000-0000-0000-0000-000000000002', 'GUARD', 'Guard B', true),
  ('84000000-0000-0000-0000-000000000005', '83000000-0000-0000-0000-000000000001', 'ADMIN', 'Inactive Admin', false),
  ('84000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000001', 'GUARD', 'Second Guard A', true);
insert into public.push_tokens (profile_id, society_id, token, platform)
values (
  '84000000-0000-0000-0000-000000000002',
  '83000000-0000-0000-0000-000000000001',
  'ExpoPushToken[guard_admin_test]',
  'android'
);

select ok(has_function_privilege('authenticated', 'public.set_admin_guard_active(uuid,boolean)', 'EXECUTE'), 'authenticated users can reach the guarded guard-management RPC');
select ok(not has_function_privilege('anon', 'public.set_admin_guard_active(uuid,boolean)', 'EXECUTE'), 'anonymous users cannot manage guard accounts');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.profiles where role = 'GUARD'), 2, 'admin sees guards only in their own society');
select is((select count(*)::integer from public.profiles where society_id = '83000000-0000-0000-0000-000000000002'), 0, 'admin cannot read another society guard');
select lives_ok(
  $$ select public.set_admin_guard_active('84000000-0000-0000-0000-000000000002', false) $$,
  'admin deactivates an own-society guard'
);
reset role;
select is((select is_active from public.profiles where id = '84000000-0000-0000-0000-000000000002'), false, 'guard account is deactivated');
select is((select count(*)::integer from public.push_tokens where profile_id = '84000000-0000-0000-0000-000000000002'), 0, 'deactivation removes guard push tokens');
select is((select count(*)::integer from public.audit_events where actor_id = '84000000-0000-0000-0000-000000000001' and action = 'Deactivated guard account'), 1, 'guard deactivation is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.set_admin_guard_active('84000000-0000-0000-0000-000000000002', true) $$,
  'admin reactivates an own-society guard'
);
reset role;
select is((select is_active from public.profiles where id = '84000000-0000-0000-0000-000000000002'), true, 'guard account is reactivated');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.set_admin_guard_active('84000000-0000-0000-0000-000000000004', false) $$,
  '42501',
  'Guard account is not available',
  'admin cannot manage another society guard'
);
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.set_admin_guard_active('84000000-0000-0000-0000-000000000006', false) $$,
  '42501',
  'Only active society admins can manage guard access',
  'guard cannot manage another guard'
);
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$ select public.set_admin_guard_active('84000000-0000-0000-0000-000000000002', false) $$,
  '42501',
  'Only active society admins can manage guard access',
  'inactive admin cannot manage guards'
);
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.profiles set role = 'ADMIN' where id = '84000000-0000-0000-0000-000000000002' $$,
  '%permission denied%',
  'admin cannot bypass the RPC to change guard profile fields'
);
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.profiles), 1, 'guard can directly read only their own profile');
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.profiles where role = 'GUARD'), 1, 'other society admin sees only their own guard');

select * from finish();
rollback;

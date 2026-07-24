begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

insert into public.societies (id, name) values
  ('81000000-0000-0000-0000-000000000001', 'Push Society A'),
  ('81000000-0000-0000-0000-000000000002', 'Push Society B');
insert into auth.users (id) values
  ('82000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002'),
  ('82000000-0000-0000-0000-000000000003'),
  ('82000000-0000-0000-0000-000000000004');
insert into public.profiles (id, society_id, role, full_name, is_active) values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'GUARD', 'Member A', true),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'GUARD', 'Guard A', true),
  ('82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 'GUARD', 'Member B', true),
  ('82000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', 'GUARD', 'Inactive Member', false);

select ok(has_function_privilege('authenticated', 'public.register_current_push_token(text,text)', 'EXECUTE'), 'authenticated members can register their device token');
select ok(not has_function_privilege('anon', 'public.register_current_push_token(text,text)', 'EXECUTE'), 'anonymous clients cannot register a device token');
select ok(has_function_privilege('authenticated', 'public.unregister_current_push_token(text)', 'EXECUTE'), 'authenticated members can unregister their device token');
select ok(not has_function_privilege('anon', 'public.unregister_current_push_token(text)', 'EXECUTE'), 'anonymous clients cannot unregister a device token');
select ok(not has_table_privilege('authenticated', 'public.push_delivery_receipts', 'SELECT'), 'authenticated clients cannot read push delivery receipts');
select ok(not has_table_privilege('authenticated', 'public.push_delivery_receipts', 'INSERT'), 'authenticated clients cannot forge push delivery receipts');

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.register_current_push_token('ExponentPushToken[shared_device_123]', 'ANDROID') $$,
  'resident registers a device token'
);
reset role;
select is((select profile_id from public.push_tokens), '82000000-0000-0000-0000-000000000001'::uuid, 'registration derives the current profile');
select is((select society_id from public.push_tokens), '81000000-0000-0000-0000-000000000001'::uuid, 'registration derives the current society');
select is((select platform from public.push_tokens), 'android', 'registration normalizes the device platform');

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ insert into public.push_tokens (profile_id, society_id, token, platform) values ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'ExpoPushToken[bypass]', 'android') $$,
  '%permission denied%',
  'authenticated clients cannot bypass the registration function'
);
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.register_current_push_token('ExponentPushToken[shared_device_123]', 'android') $$,
  'a shared device is atomically reassigned to the new account'
);
reset role;
select is((select count(*)::integer from public.push_tokens), 1, 'one installation token has only one current owner');
select is((select profile_id from public.push_tokens), '82000000-0000-0000-0000-000000000002'::uuid, 'the previous account no longer owns the shared token');

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.push_tokens), 0, 'the previous account cannot read the reassigned token');
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$ select public.register_current_push_token('ExponentPushToken[shared_device_123]', 'ios') $$,
  'the token can move safely across societies on account change'
);
reset role;
select is((select society_id from public.push_tokens), '81000000-0000-0000-0000-000000000002'::uuid, 'token reassignment also replaces the society scope');

set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.register_current_push_token('not-an-expo-token', 'ios') $$,
  '22023',
  'Push token is invalid',
  'invalid push tokens are rejected'
);
select throws_ok(
  $$ select public.register_current_push_token('ExpoPushToken[valid_123]', 'web') $$,
  '22023',
  'Push platform is invalid',
  'unsupported platforms are rejected'
);
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.register_current_push_token('ExpoPushToken[inactive_123]', 'android') $$,
  '42501',
  'Only active society members can register notifications',
  'inactive accounts cannot register notifications'
);
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select is(
  public.unregister_current_push_token('ExponentPushToken[shared_device_123]'),
  0,
  'a previous owner cannot unregister the current owner token'
);
select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000003', true);
select is(
  public.unregister_current_push_token('ExponentPushToken[shared_device_123]'),
  1,
  'the current owner can unregister their device token'
);
reset role;
select is((select count(*)::integer from public.push_tokens), 0, 'unregister removes the installation token');

select * from finish();
rollback;

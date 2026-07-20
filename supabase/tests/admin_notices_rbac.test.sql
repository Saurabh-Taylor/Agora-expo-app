begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into public.societies (id, name) values
  ('14000000-0000-0000-0000-000000000001', 'Notice Test Society A'),
  ('14000000-0000-0000-0000-000000000002', 'Notice Test Society B');
insert into auth.users (id) values
  ('44000000-0000-0000-0000-000000000001'),
  ('44000000-0000-0000-0000-000000000002'),
  ('44000000-0000-0000-0000-000000000003'),
  ('44000000-0000-0000-0000-000000000004'),
  ('44000000-0000-0000-0000-000000000005');
insert into public.towers (id, society_id, name, code, floors, units_per_floor) values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'Tower A', 'TA', 1, 1),
  ('24000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000002', 'Tower B', 'TB', 1, 1);
insert into public.flats (id, society_id, tower_id, number, floor) values
  ('34000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '101', 1),
  ('34000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000002', '101', 1);
insert into public.profiles (id, society_id, role, flat_id, occupancy_type, full_name) values
  ('44000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'ADMIN', null, null, 'Admin A'),
  ('44000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000002', 'ADMIN', null, null, 'Admin B'),
  ('44000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000001', 'RESIDENT', '34000000-0000-0000-0000-000000000001', 'OWNER', 'Resident A'),
  ('44000000-0000-0000-0000-000000000004', '14000000-0000-0000-0000-000000000001', 'GUARD', null, null, 'Guard A'),
  ('44000000-0000-0000-0000-000000000005', '14000000-0000-0000-0000-000000000002', 'RESIDENT', '34000000-0000-0000-0000-000000000002', 'OWNER', 'Resident B');

insert into public.notices (id, society_id, title, body, state, published_at, archived_at, created_by) values
  ('54000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'Published A', 'Visible', 'PUBLISHED', now(), null, '44000000-0000-0000-0000-000000000001'),
  ('54000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', 'Draft A', 'Hidden', 'SCHEDULED', null, null, '44000000-0000-0000-0000-000000000001'),
  ('54000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000001', 'Archived A', 'Hidden', 'PUBLISHED', now(), now(), '44000000-0000-0000-0000-000000000001'),
  ('54000000-0000-0000-0000-000000000004', '14000000-0000-0000-0000-000000000002', 'Published B', 'Other society', 'PUBLISHED', now(), null, '44000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.notices), 1, 'resident sees only active published notices');
select is((select title from public.notices), 'Published A', 'resident sees own-society published notice');
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000004', true);
select is((select count(*)::integer from public.notices), 0, 'guard has no notice workflow');
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.notices), 3, 'admin sees published drafts and archived notices in own society');
select is((select count(*)::integer from public.notices where society_id = '14000000-0000-0000-0000-000000000002'), 0, 'admin cannot read cross-society notices');

select lives_ok(
  $$ select public.create_admin_notice('New Draft', 'Draft body', 'GENERAL', false) $$,
  'admin creates a draft'
);
reset role;
select is((select state::text from public.notices where title = 'New Draft'), 'SCHEDULED', 'new draft remains unpublished');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.create_admin_notice('Resident Notice', 'No', 'GENERAL', false) $$,
  '42501',
  'Only active society admins can create notices',
  'resident cannot create notices'
);
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$ select public.create_admin_notice('Guard Notice', 'No', 'GENERAL', false) $$,
  '42501',
  'Only active society admins can create notices',
  'guard cannot create notices'
);
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.update_admin_notice('54000000-0000-0000-0000-000000000002', 'Cross', 'Cross', 'WATER') $$,
  '42501',
  'Notice is not available to this admin',
  'admin cannot edit cross-society notice'
);

select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.update_admin_notice((select id from public.notices where title = 'New Draft'), 'Updated Draft', 'Updated body', 'WATER') $$,
  'admin edits an own-society draft'
);
reset role;
select is((select title from public.notices where body = 'Updated body'), 'Updated Draft', 'notice update persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.publish_admin_notice((select id from public.notices where title = 'Updated Draft')) $$,
  'admin publishes a draft'
);
reset role;
select is((select state::text from public.notices where title = 'Updated Draft'), 'PUBLISHED', 'publish state persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.publish_admin_notice((select id from public.notices where title = 'Updated Draft')) $$,
  '22023',
  'Notice is already published',
  'duplicate publish is rejected'
);
select lives_ok(
  $$ select public.archive_admin_notice((select id from public.notices where title = 'Updated Draft')) $$,
  'admin archives a published notice'
);
reset role;
select ok((select archived_at is not null from public.notices where title = 'Updated Draft'), 'archive timestamp persists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.notices), 1, 'archived notice disappears from resident reads');
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$ select public.update_admin_notice((select id from public.notices where title = 'Updated Draft'), 'Again', 'Again', 'EVENT') $$,
  '22023',
  'Archived notices cannot be edited',
  'archived notice cannot be edited'
);
select throws_like(
  $$ update public.notices set title = 'Direct' where id = '54000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'direct notice mutations are denied'
);
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.archive_admin_notice('54000000-0000-0000-0000-000000000001') $$,
  '42501',
  'Notice is not available to this admin',
  'admin cannot archive cross-society notice'
);
reset role;
select is((select count(*)::integer from public.audit_events where society_id = '14000000-0000-0000-0000-000000000001'), 4, 'notice lifecycle actions are audited');

select * from finish();
rollback;

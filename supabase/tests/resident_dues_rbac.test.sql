begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(
  not has_function_privilege('authenticated', 'public.mark_due_paid_on_payment()', 'EXECUTE'),
  'authenticated clients cannot execute the internal payment trigger'
);

insert into public.societies(id,name) values
('19000000-0000-0000-0000-000000000001','Dues Test A'),
('19000000-0000-0000-0000-000000000002','Dues Test B');
insert into auth.users(id) values
('49000000-0000-0000-0000-000000000001'),('49000000-0000-0000-0000-000000000002'),
('49000000-0000-0000-0000-000000000003'),('49000000-0000-0000-0000-000000000004'),
('49000000-0000-0000-0000-000000000005'),('49000000-0000-0000-0000-000000000006');
insert into public.towers(id,society_id,name,code,floors,units_per_floor) values
('29000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','Tower A','TA',1,1),
('29000000-0000-0000-0000-000000000002','19000000-0000-0000-0000-000000000002','Tower B','TB',1,1);
insert into public.flats(id,society_id,tower_id,number,floor) values
('39000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','29000000-0000-0000-0000-000000000001','101',1),
('39000000-0000-0000-0000-000000000002','19000000-0000-0000-0000-000000000002','29000000-0000-0000-0000-000000000002','101',1);
insert into public.profiles(id,society_id,role,flat_id,occupancy_type,full_name,is_active) values
('49000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','RESIDENT','39000000-0000-0000-0000-000000000001','OWNER','Resident A1',true),
('49000000-0000-0000-0000-000000000002','19000000-0000-0000-0000-000000000001','RESIDENT','39000000-0000-0000-0000-000000000001','TENANT','Resident A2',true),
('49000000-0000-0000-0000-000000000003','19000000-0000-0000-0000-000000000002','RESIDENT','39000000-0000-0000-0000-000000000002','OWNER','Resident B',true),
('49000000-0000-0000-0000-000000000004','19000000-0000-0000-0000-000000000001','GUARD',null,null,'Guard A',true),
('49000000-0000-0000-0000-000000000005','19000000-0000-0000-0000-000000000001','ADMIN',null,null,'Admin A',true),
('49000000-0000-0000-0000-000000000006','19000000-0000-0000-0000-000000000002','ADMIN',null,null,'Admin B',true);
insert into public.maintenance_dues(id,society_id,flat_id,quarter_label,amount,due_date,status) values
('59000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','Q1 2026',2500,current_date-30,'UNPAID'),
('59000000-0000-0000-0000-000000000002','19000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','Q2 2026',2750,current_date+30,'UNPAID'),
('59000000-0000-0000-0000-000000000003','19000000-0000-0000-0000-000000000002','39000000-0000-0000-0000-000000000002','Q1 2026',3000,current_date+30,'UNPAID');
insert into public.payments(id,due_id,society_id,flat_id,paid_by,amount,method,receipt_no) values
('69000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000001','19000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002',2500,'UPI','SEED-1');

set local role authenticated;
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.maintenance_dues),2,'resident sees dues for own flat');
select is((select count(*)::int from public.payments),0,'resident cannot see another resident payment from same flat');
select is((select count(*)::int from public.maintenance_dues where society_id='19000000-0000-0000-0000-000000000002'),0,'resident cannot see cross-society dues');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.payments),1,'resident sees their own payments');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000004',true);
select is((select count(*)::int from public.maintenance_dues),0,'guard sees no dues');
select is((select count(*)::int from public.payments),0,'guard sees no payments');
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000005',true);
select is((select count(*)::int from public.maintenance_dues),2,'admin sees own-society dues');
select is((select count(*)::int from public.payments),1,'admin sees own-society payments');

reset role;
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'record_demo_razorpay_payment'
), 'client-callable demo payment RPC is removed');
select ok(not has_function_privilege('authenticated', 'public.pay_resident_maintenance_due(uuid,text)', 'EXECUTE'), 'unverified production-style payment RPC is disabled');
select ok(not has_function_privilege('authenticated', 'public.record_verified_razorpay_payment(uuid,text,text)', 'EXECUTE'), 'verified payment recording is server-only');

set local role authenticated;
select set_config('request.jwt.claim.sub','49000000-0000-0000-0000-000000000001',true);
select throws_like($$insert into public.payments(due_id,society_id,flat_id,paid_by,amount,method,receipt_no) values('59000000-0000-0000-0000-000000000002','19000000-0000-0000-0000-000000000001','39000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001',1,'UPI','FAKE')$$,'%permission denied%','direct payment writes denied');
select throws_like($$update public.maintenance_dues set status='UNPAID' where id='59000000-0000-0000-0000-000000000002'$$,'%permission denied%','direct due writes denied');
select * from finish();
rollback;

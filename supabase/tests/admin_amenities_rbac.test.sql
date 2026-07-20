begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
insert into public.societies(id,name) values ('17000000-0000-0000-0000-000000000001','Amenity A'),('17000000-0000-0000-0000-000000000002','Amenity B');
insert into auth.users(id) values ('47000000-0000-0000-0000-000000000001'),('47000000-0000-0000-0000-000000000002'),('47000000-0000-0000-0000-000000000003'),('47000000-0000-0000-0000-000000000004'),('47000000-0000-0000-0000-000000000005');
insert into public.towers(id,society_id,name,code,floors,units_per_floor) values ('27000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','Tower A','TA',1,2),('27000000-0000-0000-0000-000000000002','17000000-0000-0000-0000-000000000002','Tower B','TB',1,1);
insert into public.flats(id,society_id,tower_id,number,floor) values ('37000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','101',1),('37000000-0000-0000-0000-000000000002','17000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','102',1),('37000000-0000-0000-0000-000000000003','17000000-0000-0000-0000-000000000002','27000000-0000-0000-0000-000000000002','101',1);
insert into public.profiles(id,society_id,role,flat_id,occupancy_type,full_name,is_active) values
('47000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','ADMIN',null,null,'Admin A',true),
('47000000-0000-0000-0000-000000000002','17000000-0000-0000-0000-000000000002','ADMIN',null,null,'Admin B',true),
('47000000-0000-0000-0000-000000000003','17000000-0000-0000-0000-000000000001','RESIDENT','37000000-0000-0000-0000-000000000001','OWNER','Resident A1',true),
('47000000-0000-0000-0000-000000000004','17000000-0000-0000-0000-000000000001','GUARD',null,null,'Guard A',true),
('47000000-0000-0000-0000-000000000005','17000000-0000-0000-0000-000000000001','RESIDENT','37000000-0000-0000-0000-000000000002','TENANT','Resident A2',true);
insert into public.amenities(id,society_id,name,open_time,close_time,is_active) values ('57000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','Clubhouse','07:00','21:00',true),('57000000-0000-0000-0000-000000000002','17000000-0000-0000-0000-000000000002','Pool B','07:00','21:00',true);
insert into public.amenity_bookings(id,amenity_id,society_id,flat_id,booked_by,slot_start,slot_end,status) values ('67000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000003',(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '1 day 10 hours') at time zone 'Asia/Kolkata',(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '1 day 12 hours') at time zone 'Asia/Kolkata','PENDING');

set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from public.amenities),1,'resident sees active own-society amenities');
select is((select count(*)::int from public.amenity_bookings),1,'resident sees own bookings');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000004',true);
select is((select count(*)::int from public.amenities),0,'guard sees no amenities');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.amenities),1,'admin sees only own-society amenities');
select lives_ok($$select public.create_admin_amenity('  Gym  ','Fitness','06:00','22:00')$$,'admin creates amenity');
reset role;
select is((select society_id from public.amenities where name='Gym'),'17000000-0000-0000-0000-000000000001'::uuid,'amenity derives society');
set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.update_admin_amenity('57000000-0000-0000-0000-000000000001','Cross',null,'07:00','21:00')$$,'42501','Amenity is not available to this admin','cross-society update denied');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.set_admin_amenity_active('57000000-0000-0000-0000-000000000001',false)$$,'23503','Decide pending bookings before archiving this amenity','pending booking blocks archive');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.create_resident_amenity_booking((select id from public.amenities where name='Gym'),(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '2 days 10 hours') at time zone 'Asia/Kolkata',(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '2 days 12 hours') at time zone 'Asia/Kolkata')$$,'resident creates booking');
reset role;
select is((select society_id from public.amenity_bookings where amenity_id=(select id from public.amenities where name='Gym')),'17000000-0000-0000-0000-000000000001'::uuid,'booking derives society');
set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000005',true);
select throws_ok($$select public.create_resident_amenity_booking((select id from public.amenities where name='Gym'),(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '2 days 11 hours') at time zone 'Asia/Kolkata',(date_trunc('day',now() at time zone 'Asia/Kolkata')+interval '2 days 13 hours') at time zone 'Asia/Kolkata')$$,'23P01','Booking slot is no longer available','overlap rejected');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from public.get_amenity_unavailable_slots('57000000-0000-0000-0000-000000000001',now(),now()+interval '2 days')),1,'availability returns blocked ranges');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.decide_admin_amenity_booking('67000000-0000-0000-0000-000000000001','CONFIRMED')$$,'42501','Booking is not available to this admin','cross-society decision denied');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.decide_admin_amenity_booking('67000000-0000-0000-0000-000000000001','CONFIRMED')$$,'admin confirms booking');
reset role;
select ok((select status='CONFIRMED' and decided_by='47000000-0000-0000-0000-000000000001' from public.amenity_bookings where id='67000000-0000-0000-0000-000000000001'),'decision persists with actor');
set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.cancel_resident_amenity_booking('67000000-0000-0000-0000-000000000001')$$,'resident cancels own booking');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000005',true);
select throws_ok($$select public.cancel_resident_amenity_booking('67000000-0000-0000-0000-000000000001')$$,'42501','Booking is not available to this resident','resident cannot cancel another booking');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000001',true);
select throws_like($$insert into public.amenities(society_id,name) values('17000000-0000-0000-0000-000000000001','Direct')$$,'%permission denied%','direct amenity writes denied');
select throws_like($$update public.amenity_bookings set status='CONFIRMED' where id='67000000-0000-0000-0000-000000000001'$$,'%permission denied%','direct booking writes denied');
reset role;
select is((select count(*)::int from public.audit_events where society_id='17000000-0000-0000-0000-000000000001'),2,'admin actions audited');
select * from finish();
rollback;

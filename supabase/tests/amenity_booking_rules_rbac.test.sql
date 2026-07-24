begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into public.societies(id,name) values
('18000000-0000-0000-0000-000000000001','Rules A'),
('18000000-0000-0000-0000-000000000002','Rules B');
insert into public.towers(id,society_id,name,code,floors,units_per_floor) values
('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Tower A','TA',1,3),
('28000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','Tower B','TB',1,1);
insert into public.flats(id,society_id,tower_id,number,floor) values
('38000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','101',1),
('38000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','102',1),
('38000000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','103',1),
('38000000-0000-0000-0000-000000000004','18000000-0000-0000-0000-000000000002','28000000-0000-0000-0000-000000000002','101',1);
insert into auth.users(id) values
('48000000-0000-0000-0000-000000000001'),
('48000000-0000-0000-0000-000000000002'),
('48000000-0000-0000-0000-000000000003'),
('48000000-0000-0000-0000-000000000004'),
('48000000-0000-0000-0000-000000000005'),
('48000000-0000-0000-0000-000000000006');
insert into public.profiles(id,society_id,role,flat_id,occupancy_type,full_name,is_active) values
('48000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','ADMIN',null,null,'Admin A',true),
('48000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','ADMIN',null,null,'Admin B',true),
('48000000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000001','RESIDENT','38000000-0000-0000-0000-000000000001','OWNER','Resident A1',true),
('48000000-0000-0000-0000-000000000004','18000000-0000-0000-0000-000000000001','RESIDENT','38000000-0000-0000-0000-000000000002','TENANT','Resident A2',true),
('48000000-0000-0000-0000-000000000005','18000000-0000-0000-0000-000000000001','RESIDENT','38000000-0000-0000-0000-000000000003','OWNER','Resident A3',true),
('48000000-0000-0000-0000-000000000006','18000000-0000-0000-0000-000000000001','GUARD',null,null,'Guard A',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.create_admin_amenity('Shared Gym','Fitness','06:00','10:00','SHARED',60,2,7,1,false,'Carry indoor shoes')$$,'admin creates configured shared amenity');
reset role;
select is((select society_id from public.amenities where name='Shared Gym'),'18000000-0000-0000-0000-000000000001'::uuid,'amenity derives society');
select is((select count(*)::int from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and is_active),4,'slot templates are generated');
select ok((select max_bookings_per_slot=2 and not requires_admin_approval from public.amenities where name='Shared Gym'),'configuration persists');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000006',true);
select is((select count(*)::int from public.amenity_slots),0,'guard cannot view slots');
select is((select count(*)::int from public.amenity_blocks),0,'guard cannot view blocks');
select throws_ok($$select * from public.get_amenity_slot_availability((select id from public.amenities where name='Shared Gym'),(now() at time zone 'Asia/Kolkata')::date+1)$$,'42501','Amenity availability is not available to this role','guard cannot call availability');

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from public.amenity_slots),4,'resident sees active own-society slots');
select lives_ok($$select public.create_resident_amenity_booking(
  (select id from public.amenities where name='Shared Gym'),
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00'),
  (now() at time zone 'Asia/Kolkata')::date+1
)$$,'first resident books shared slot');
reset role;
select is((select status::text from public.amenity_bookings where booked_by='48000000-0000-0000-0000-000000000003'),'CONFIRMED','auto approval confirms booking');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000004',true);
select lives_ok($$select public.create_resident_amenity_booking(
  (select id from public.amenities where name='Shared Gym'),
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00'),
  (now() at time zone 'Asia/Kolkata')::date+1
)$$,'second resident fills shared slot');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000005',true);
select throws_ok($$select public.create_resident_amenity_booking(
  (select id from public.amenities where name='Shared Gym'),
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00'),
  (now() at time zone 'Asia/Kolkata')::date+1
)$$,'23P01','Booking slot is no longer available','capacity limit is enforced');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.create_resident_amenity_booking(
  (select id from public.amenities where name='Shared Gym'),
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='07:00'),
  (now() at time zone 'Asia/Kolkata')::date+1
)$$,'23514','You have reached the daily booking limit','daily fair-use limit is enforced');
select is((select status from public.get_amenity_slot_availability(
  (select id from public.amenities where name='Shared Gym'),
  (now() at time zone 'Asia/Kolkata')::date+1
) where slot_start::time='00:30'),'FULL','availability reports full capacity');

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000002',true);
select throws_ok($$select * from public.get_amenity_slot_availability(
  (select id from public.amenities where name='Shared Gym'),
  (now() at time zone 'Asia/Kolkata')::date+1
)$$,'42501','Amenity is not available','cross-society availability denied');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select throws_ok($$select * from public.create_admin_amenity_block(
  (select id from public.amenities where name='Shared Gym'),
  (now() at time zone 'Asia/Kolkata')::date+1,
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00'),
  'Equipment service',false
)$$,'23503','Active bookings must be explicitly cancelled before blocking this period','block requires cancellation confirmation');
select lives_ok($$select * from public.create_admin_amenity_block(
  (select id from public.amenities where name='Shared Gym'),
  (now() at time zone 'Asia/Kolkata')::date+1,
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00'),
  'Equipment service',true
)$$,'admin blocks slot and cancels bookings');
reset role;
select is((select count(*)::int from public.amenity_bookings where status='CANCELLED'),2,'block cancels affected bookings');
select is((select count(*)::int from public.amenity_bookings where status_reason like 'Cancelled because%'),2,'maintenance reason is retained');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.remove_admin_amenity_block((select id from public.amenity_blocks where is_active))$$,'admin removes block');
reset role;
select is((select count(*)::int from public.amenity_blocks where is_active),0,'removed block is retained as inactive history');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000005',true);
select lives_ok($$select public.create_resident_amenity_booking(
  (select id from public.amenities where name='Shared Gym'),
  (select id from public.amenity_slots where amenity_id=(select id from public.amenities where name='Shared Gym') and start_time='06:00' and is_active),
  (now() at time zone 'Asia/Kolkata')::date+2
)$$,'resident books before a schedule change');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.update_admin_amenity(
  (select id from public.amenities where name='Shared Gym'),
  'Shared Gym','Fitness','06:00','10:00','SHARED',120,2,7,1,false,'Carry indoor shoes'
)$$,'admin safely replaces the recurring slot schedule');
select is((select active_bookings from public.get_amenity_slot_availability(
  (select id from public.amenities where name='Shared Gym'),
  (now() at time zone 'Asia/Kolkata')::date+2
) where slot_start::time='00:30'),1,'replacement slots retain overlapping booking capacity');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000006',true);
select throws_like($$insert into public.amenity_blocks(society_id,amenity_id,block_date,reason,created_by)
values('18000000-0000-0000-0000-000000000001',(select id from public.amenities where name='Shared Gym'),current_date,'Direct','48000000-0000-0000-0000-000000000006')$$,'%permission denied%','direct block writes are denied');
select throws_like($$insert into public.amenity_slots(society_id,amenity_id,start_time,end_time)
values('18000000-0000-0000-0000-000000000001',(select id from public.amenities where name='Shared Gym'),'10:00','11:00')$$,'%permission denied%','direct slot writes are denied');
reset role;
select is((select count(*)::int from public.audit_events where society_id='18000000-0000-0000-0000-000000000001'),4,'admin changes are audited');
select ok((select count(*)::int > 0 from public.amenity_slots where not is_active),'replaced slot templates remain as inactive history');

select * from finish();
rollback;

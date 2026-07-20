begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into public.societies(id,name) values
('18000000-0000-0000-0000-000000000001','Directory Test A'),
('18000000-0000-0000-0000-000000000002','Directory Test B');
insert into auth.users(id) values
('48000000-0000-0000-0000-000000000001'),('48000000-0000-0000-0000-000000000002'),
('48000000-0000-0000-0000-000000000003'),('48000000-0000-0000-0000-000000000004');
insert into public.towers(id,society_id,name,code,floors,units_per_floor) values
('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Tower A','TA',1,1),
('28000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','Tower B','TB',1,1);
insert into public.flats(id,society_id,tower_id,number,floor) values
('38000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','101',1);
insert into public.profiles(id,society_id,role,flat_id,occupancy_type,full_name,is_active) values
('48000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','ADMIN',null,null,'Admin A',true),
('48000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','ADMIN',null,null,'Admin B',true),
('48000000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000001','RESIDENT','38000000-0000-0000-0000-000000000001','OWNER','Resident A',true),
('48000000-0000-0000-0000-000000000004','18000000-0000-0000-0000-000000000001','GUARD',null,null,'Guard A',true);
insert into public.staff(id,society_id,name,role,shift,phone,status) values
('58000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Staff A','Security','Morning','9876543210','ON_DUTY'),
('58000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','Staff B','Security','Night',null,'ON_DUTY');
insert into public.service_providers(id,society_id,name,category,phone,status) values
('68000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Provider A','Plumber','9876500000','ON_DUTY'),
('68000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','Provider B','Electrician',null,'ON_DUTY');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from public.staff),0,'resident cannot read staff');
select is((select count(*)::int from public.service_providers),0,'resident cannot read service providers');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000004',true);
select is((select count(*)::int from public.staff),0,'guard cannot read staff directory');
select is((select count(*)::int from public.service_providers),0,'guard cannot read service provider directory');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.staff),1,'admin reads own-society staff');
select is((select count(*)::int from public.service_providers),1,'admin reads own-society providers');
select is((select count(*)::int from public.staff where society_id='18000000-0000-0000-0000-000000000002'),0,'admin cannot read cross-society staff');

select lives_ok($$select public.save_admin_staff(null,'  New Staff  ','  Maintenance  ',' Evening ',' 99999 88888 ')$$,'admin creates staff');
reset role;
select is((select society_id from public.staff where name='New Staff'),'18000000-0000-0000-0000-000000000001'::uuid,'staff create derives society');
select is((select role from public.staff where name='New Staff'),'Maintenance','staff create trims text');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.save_admin_staff(null,'Resident Staff','Security','Morning',null)$$,'42501','Only active society admins can save staff','resident cannot save staff');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000004',true);
select throws_ok($$select public.save_admin_staff(null,'Guard Staff','Security','Morning',null)$$,'42501','Only active society admins can save staff','guard cannot save staff');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.save_admin_staff(null,'Bad Phone','Security','Morning','abc')$$,'22023','Staff phone number is invalid','invalid staff phone rejected');
select lives_ok($$select public.save_admin_staff('58000000-0000-0000-0000-000000000001','Staff A Updated','Security','Night','9876543210')$$,'admin updates staff');
reset role;
select is((select shift from public.staff where id='58000000-0000-0000-0000-000000000001'),'Night','staff update persists');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.save_admin_staff('58000000-0000-0000-0000-000000000001','Cross','Security','Night',null)$$,'42501','Staff member is not available to this admin','cross-society staff update denied');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.set_admin_staff_status('58000000-0000-0000-0000-000000000001','OFF_DUTY')$$,'admin changes staff status');
reset role;
select is((select status::text from public.staff where id='58000000-0000-0000-0000-000000000001'),'OFF_DUTY','staff status persists');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.save_admin_service_provider(null,'  Fix It  ',' Plumber ','9999988888')$$,'admin creates provider');
reset role;
select is((select society_id from public.service_providers where name='Fix It'),'18000000-0000-0000-0000-000000000001'::uuid,'provider create derives society');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.save_admin_service_provider(null,'Resident Provider','Plumber',null)$$,'42501','Only active society admins can save service providers','resident cannot save provider');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000004',true);
select throws_ok($$select public.save_admin_service_provider(null,'Guard Provider','Plumber',null)$$,'42501','Only active society admins can save service providers','guard cannot save provider');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.save_admin_service_provider('68000000-0000-0000-0000-000000000001','Provider Updated','Electrician','9876500000')$$,'admin updates provider');
reset role;
select is((select category from public.service_providers where id='68000000-0000-0000-0000-000000000001'),'Electrician','provider update persists');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.set_admin_service_provider_status('68000000-0000-0000-0000-000000000001','OFF_DUTY')$$,'42501','Service provider is not available to this admin','cross-society provider status denied');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.set_admin_service_provider_status('68000000-0000-0000-0000-000000000001','OFF_DUTY')$$,'admin changes provider status');
reset role;
select is((select status::text from public.service_providers where id='68000000-0000-0000-0000-000000000001'),'OFF_DUTY','provider status persists');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select throws_like($$insert into public.staff(society_id,name,role) values('18000000-0000-0000-0000-000000000001','Direct','Security')$$,'%permission denied%','direct staff writes denied');
select throws_like($$update public.service_providers set status='ON_DUTY' where id='68000000-0000-0000-0000-000000000001'$$,'%permission denied%','direct provider writes denied');
reset role;
select is((select count(*)::int from public.audit_events where society_id='18000000-0000-0000-0000-000000000001'),6,'directory lifecycle actions are audited');
select * from finish();
rollback;

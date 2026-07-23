begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.societies(id,name) values
('18000000-0000-0000-0000-000000000001','Gallery A'),
('18000000-0000-0000-0000-000000000002','Gallery B');
insert into auth.users(id) values
('48000000-0000-0000-0000-000000000001'),
('48000000-0000-0000-0000-000000000002'),
('48000000-0000-0000-0000-000000000003'),
('48000000-0000-0000-0000-000000000004');
insert into public.towers(id,society_id,name,code,floors,units_per_floor) values
('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','A','A',1,1),
('28000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','B','B',1,1);
insert into public.flats(id,society_id,tower_id,number,floor) values
('38000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','101',1);
insert into public.profiles(id,society_id,role,flat_id,occupancy_type,full_name,is_active) values
('48000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','ADMIN',null,null,'Admin A',true),
('48000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000002','ADMIN',null,null,'Admin B',true),
('48000000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000001','RESIDENT','38000000-0000-0000-0000-000000000001','OWNER','Resident A',true),
('48000000-0000-0000-0000-000000000004','18000000-0000-0000-0000-000000000001','GUARD',null,null,'Guard A',true);
insert into public.amenities(id,society_id,name,open_time,close_time,is_active,image_paths) values
('58000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Active A','07:00','21:00',true,array['18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001.jpg']),
('58000000-0000-0000-0000-000000000002','18000000-0000-0000-0000-000000000001','Inactive A','07:00','21:00',false,array['18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000002/78000000-0000-0000-0000-000000000002.jpg']),
('58000000-0000-0000-0000-000000000003','18000000-0000-0000-0000-000000000002','Active B','07:00','21:00',true,array['18000000-0000-0000-0000-000000000002/58000000-0000-0000-0000-000000000003/78000000-0000-0000-0000-000000000003.jpg']);
insert into storage.objects(bucket_id,name,owner_id) values
('amenity-images','18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001.jpg','48000000-0000-0000-0000-000000000001'),
('amenity-images','18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000002/78000000-0000-0000-0000-000000000002.jpg','48000000-0000-0000-0000-000000000001'),
('amenity-images','18000000-0000-0000-0000-000000000002/58000000-0000-0000-0000-000000000003/78000000-0000-0000-0000-000000000003.jpg','48000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000003',true);
select is((select count(*)::int from storage.objects where bucket_id='amenity-images'),1,'resident reads only active own-society amenity photos');
select throws_like($$insert into storage.objects(bucket_id,name,owner_id) values('amenity-images','18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000004.jpg','48000000-0000-0000-0000-000000000003')$$,'%row-level security%','resident cannot upload amenity photos');
select throws_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001','{}')$$,'42501','Only active society admins can manage amenity photos','resident cannot manage gallery');

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000004',true);
select is((select count(*)::int from storage.objects where bucket_id='amenity-images'),0,'guard cannot read amenity photos');
select throws_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001','{}')$$,'42501','Only active society admins can manage amenity photos','guard cannot manage gallery');

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from storage.objects where bucket_id='amenity-images'),2,'admin reads only own-society amenity photos');
select lives_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001',array['18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001.jpg'])$$,'admin saves verified gallery');
select is((select cardinality(image_paths) from public.amenities where id='58000000-0000-0000-0000-000000000001'),1,'gallery order persists on amenity');
select throws_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001',array['x','x','x','x','x'])$$,'22023','An amenity can have at most 4 photos','gallery limit enforced');
select throws_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001',array['18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001.jpg','18000000-0000-0000-0000-000000000001/58000000-0000-0000-0000-000000000001/78000000-0000-0000-0000-000000000001.jpg'])$$,'22023','Amenity photos must be unique','duplicate photos rejected');

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from storage.objects where bucket_id='amenity-images'),1,'second admin reads only second society photos');
select throws_ok($$select public.set_admin_amenity_images('58000000-0000-0000-0000-000000000001','{}')$$,'42501','Amenity is not available to this admin','cross-society gallery update denied');

select * from finish();
rollback;

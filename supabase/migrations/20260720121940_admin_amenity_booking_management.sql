alter table public.amenities
add column is_active boolean not null default true,
add column updated_at timestamptz not null default now();

alter table public.amenity_bookings
add column decided_by uuid,
add column decided_at timestamptz,
add column updated_at timestamptz not null default now(),
add constraint amenity_bookings_slot_order check (slot_end > slot_start),
add constraint amenity_bookings_decided_by_same_society_fkey
  foreign key (decided_by, society_id)
  references public.profiles (id, society_id)
  on delete set null (decided_by);

create index amenity_bookings_active_slot_idx
on public.amenity_bookings (amenity_id, slot_start, slot_end)
where status in ('PENDING', 'CONFIRMED');

drop policy if exists amenities_select on public.amenities;
drop policy if exists amenities_admin_write on public.amenities;
create policy amenities_select on public.amenities
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or ((select public.current_user_role()) = 'RESIDENT' and is_active)
  )
);

drop policy if exists amenity_bookings_select on public.amenity_bookings;
drop policy if exists amenity_bookings_resident_insert on public.amenity_bookings;
drop policy if exists amenity_bookings_admin_update on public.amenity_bookings;
create policy amenity_bookings_select on public.amenity_bookings
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and booked_by = (select auth.uid())
    )
  )
);

create or replace function public.create_admin_amenity(
  requested_name text,
  requested_description text,
  requested_open_time time,
  requested_close_time time
)
returns public.amenities language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.amenities%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can create amenities';
  end if;
  if char_length(btrim(coalesce(requested_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Amenity name must be at least 2 characters';
  end if;
  if requested_open_time is null or requested_close_time is null or requested_open_time >= requested_close_time then
    raise exception using errcode = '22023', message = 'Amenity opening time must be before closing time';
  end if;
  if exists (
    select 1 from public.amenities
    where society_id = actor.society_id and lower(name) = lower(btrim(requested_name))
  ) then
    raise exception using errcode = '23505', message = 'An amenity with this name already exists';
  end if;

  insert into public.amenities (society_id, name, description, open_time, close_time)
  values (
    actor.society_id,
    btrim(requested_name),
    nullif(btrim(coalesce(requested_description, '')), ''),
    requested_open_time,
    requested_close_time
  )
  returning * into result;

  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Created amenity ' || result.name);
  return result;
end;
$$;

create or replace function public.update_admin_amenity(
  target_amenity_id uuid,
  requested_name text,
  requested_description text,
  requested_open_time time,
  requested_close_time time
)
returns public.amenities language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can update amenities';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Amenity is not available to this admin'; end if;
  if char_length(btrim(coalesce(requested_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Amenity name must be at least 2 characters';
  end if;
  if requested_open_time is null or requested_close_time is null or requested_open_time >= requested_close_time then
    raise exception using errcode = '22023', message = 'Amenity opening time must be before closing time';
  end if;
  if exists (
    select 1 from public.amenities
    where society_id = actor.society_id
      and id <> target.id
      and lower(name) = lower(btrim(requested_name))
  ) then
    raise exception using errcode = '23505', message = 'An amenity with this name already exists';
  end if;

  update public.amenities
  set
    name = btrim(requested_name),
    description = nullif(btrim(coalesce(requested_description, '')), ''),
    open_time = requested_open_time,
    close_time = requested_close_time,
    updated_at = statement_timestamp()
  where id = target.id
  returning * into target;

  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Updated amenity ' || target.name);
  return target;
end;
$$;

create or replace function public.set_admin_amenity_active(target_amenity_id uuid, requested_active boolean)
returns public.amenities language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can change amenity availability';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Amenity is not available to this admin'; end if;
  if target.is_active = requested_active then
    raise exception using errcode = '22023', message = 'Amenity availability is already unchanged';
  end if;
  if not requested_active and exists (
    select 1 from public.amenity_bookings
    where amenity_id = target.id
      and society_id = actor.society_id
      and status = 'PENDING'
      and slot_start > statement_timestamp()
  ) then
    raise exception using errcode = '23503', message = 'Decide pending bookings before archiving this amenity';
  end if;

  update public.amenities
  set is_active = requested_active, updated_at = statement_timestamp()
  where id = target.id
  returning * into target;

  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, (case when requested_active then 'Reactivated amenity ' else 'Archived amenity ' end) || target.name);
  return target;
end;
$$;

create or replace function public.get_amenity_unavailable_slots(
  target_amenity_id uuid,
  range_start timestamptz,
  range_end timestamptz
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role not in ('ADMIN', 'RESIDENT') then
    raise exception using errcode = '42501', message = 'Amenity availability is not available to this role';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id
    and society_id = actor.society_id
    and (is_active or actor.role = 'ADMIN');
  if target.id is null then raise exception using errcode = '42501', message = 'Amenity is not available'; end if;
  if range_start is null or range_end is null or range_start >= range_end or range_end - range_start > interval '8 days' then
    raise exception using errcode = '22023', message = 'Availability range is invalid';
  end if;

  return query
  select booking.slot_start, booking.slot_end
  from public.amenity_bookings booking
  where booking.amenity_id = target.id
    and booking.society_id = actor.society_id
    and booking.status in ('PENDING', 'CONFIRMED')
    and booking.slot_start < range_end
    and booking.slot_end > range_start
  order by booking.slot_start;
end;
$$;

create or replace function public.create_resident_amenity_booking(
  target_amenity_id uuid,
  requested_slot_start timestamptz,
  requested_slot_end timestamptz
)
returns public.amenity_bookings language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  result public.amenity_bookings%rowtype;
  local_start timestamp;
  local_end timestamp;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can book amenities';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id and society_id = actor.society_id and is_active;
  if target.id is null then raise exception using errcode = '42501', message = 'Amenity is not available to this resident'; end if;

  local_start := requested_slot_start at time zone 'Asia/Kolkata';
  local_end := requested_slot_end at time zone 'Asia/Kolkata';
  if requested_slot_start is null or requested_slot_end is null
    or requested_slot_start <= statement_timestamp()
    or requested_slot_end - requested_slot_start <> interval '2 hours'
    or requested_slot_start > statement_timestamp() + interval '8 days'
    or local_start::date <> local_end::date
    or local_start::time < target.open_time
    or local_end::time > target.close_time then
    raise exception using errcode = '22023', message = 'Booking slot is outside the allowed time';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target.id::text, 0));
  if exists (
    select 1 from public.amenity_bookings
    where amenity_id = target.id
      and society_id = actor.society_id
      and status in ('PENDING', 'CONFIRMED')
      and slot_start < requested_slot_end
      and slot_end > requested_slot_start
  ) then
    raise exception using errcode = '23P01', message = 'Booking slot is no longer available';
  end if;

  insert into public.amenity_bookings (
    amenity_id, society_id, flat_id, booked_by, slot_start, slot_end, status
  )
  values (
    target.id, actor.society_id, actor.flat_id, actor.id, requested_slot_start, requested_slot_end, 'PENDING'
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.cancel_resident_amenity_booking(target_booking_id uuid)
returns public.amenity_bookings language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenity_bookings%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' then
    raise exception using errcode = '42501', message = 'Only active residents can cancel their bookings';
  end if;
  select * into target from public.amenity_bookings
  where id = target_booking_id
    and society_id = actor.society_id
    and booked_by = actor.id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Booking is not available to this resident'; end if;
  if target.status = 'CANCELLED' then raise exception using errcode = '22023', message = 'Booking is already cancelled'; end if;
  if target.slot_start <= statement_timestamp() then raise exception using errcode = '22023', message = 'Started bookings cannot be cancelled'; end if;

  update public.amenity_bookings
  set status = 'CANCELLED', decided_by = actor.id, decided_at = statement_timestamp(), updated_at = statement_timestamp()
  where id = target.id
  returning * into target;
  return target;
end;
$$;

create or replace function public.decide_admin_amenity_booking(
  target_booking_id uuid,
  requested_decision public.booking_status
)
returns public.amenity_bookings language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenity_bookings%rowtype;
  amenity_name text;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can decide bookings';
  end if;
  if requested_decision not in ('CONFIRMED', 'CANCELLED') then
    raise exception using errcode = '22023', message = 'Booking decision must confirm or cancel';
  end if;
  select * into target from public.amenity_bookings
  where id = target_booking_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Booking is not available to this admin'; end if;
  if target.status <> 'PENDING' then raise exception using errcode = '22023', message = 'Only pending bookings can be decided'; end if;

  perform pg_advisory_xact_lock(hashtextextended(target.amenity_id::text, 0));
  if requested_decision = 'CONFIRMED' and exists (
    select 1 from public.amenity_bookings
    where amenity_id = target.amenity_id
      and society_id = actor.society_id
      and id <> target.id
      and status = 'CONFIRMED'
      and slot_start < target.slot_end
      and slot_end > target.slot_start
  ) then
    raise exception using errcode = '23P01', message = 'This slot conflicts with a confirmed booking';
  end if;

  update public.amenity_bookings
  set
    status = requested_decision,
    decided_by = actor.id,
    decided_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = target.id
  returning * into target;

  select name into amenity_name from public.amenities
  where id = target.amenity_id and society_id = actor.society_id;
  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    (case when requested_decision = 'CONFIRMED' then 'Confirmed booking for ' else 'Declined booking for ' end) || coalesce(amenity_name, 'amenity')
  );
  return target;
end;
$$;

revoke all on function public.create_admin_amenity(text, text, time, time) from public, anon;
revoke all on function public.update_admin_amenity(uuid, text, text, time, time) from public, anon;
revoke all on function public.set_admin_amenity_active(uuid, boolean) from public, anon;
revoke all on function public.get_amenity_unavailable_slots(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.create_resident_amenity_booking(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.cancel_resident_amenity_booking(uuid) from public, anon;
revoke all on function public.decide_admin_amenity_booking(uuid, public.booking_status) from public, anon;
grant execute on function public.create_admin_amenity(text, text, time, time) to authenticated;
grant execute on function public.update_admin_amenity(uuid, text, text, time, time) to authenticated;
grant execute on function public.set_admin_amenity_active(uuid, boolean) to authenticated;
grant execute on function public.get_amenity_unavailable_slots(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_resident_amenity_booking(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_resident_amenity_booking(uuid) to authenticated;
grant execute on function public.decide_admin_amenity_booking(uuid, public.booking_status) to authenticated;

revoke insert, update, delete on public.amenities, public.amenity_bookings from authenticated;
grant select on public.amenities, public.amenity_bookings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'amenities'
  ) then
    alter publication supabase_realtime add table public.amenities;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'amenity_bookings'
  ) then
    alter publication supabase_realtime add table public.amenity_bookings;
  end if;
end;
$$;

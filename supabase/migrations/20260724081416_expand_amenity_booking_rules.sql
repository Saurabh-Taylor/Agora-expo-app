-- Additive amenity scheduling, capacity, and maintenance rules.
alter table public.amenities
add column booking_type text not null default 'EXCLUSIVE',
add column slot_duration_minutes smallint not null default 120,
add column max_bookings_per_slot smallint not null default 1,
add column advance_booking_days smallint not null default 7,
add column max_bookings_per_resident_per_day smallint not null default 1,
add column requires_admin_approval boolean not null default true,
add column rules_and_regulations text,
add constraint amenities_booking_type_check check (booking_type in ('EXCLUSIVE', 'SHARED')),
add constraint amenities_slot_duration_check check (slot_duration_minutes between 15 and 720),
add constraint amenities_capacity_check check (
  max_bookings_per_slot between 1 and 100
  and (booking_type = 'SHARED' or max_bookings_per_slot = 1)
),
add constraint amenities_advance_booking_days_check check (advance_booking_days between 0 and 90),
add constraint amenities_resident_daily_limit_check check (max_bookings_per_resident_per_day between 1 and 20);

create table public.amenity_slots (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  amenity_id uuid not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amenity_slots_amenity_same_society_fkey
    foreign key (amenity_id, society_id) references public.amenities(id, society_id) on delete cascade,
  constraint amenity_slots_time_order_check check (start_time < end_time),
  constraint amenity_slots_identity_unique unique (id, amenity_id, society_id),
  constraint amenity_slots_interval_unique unique (society_id, amenity_id, start_time, end_time)
);

create table public.amenity_blocks (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  amenity_id uuid not null,
  block_date date not null,
  slot_id uuid,
  reason text not null,
  created_by uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amenity_blocks_amenity_same_society_fkey
    foreign key (amenity_id, society_id) references public.amenities(id, society_id) on delete cascade,
  constraint amenity_blocks_slot_same_amenity_fkey
    foreign key (slot_id, amenity_id, society_id)
    references public.amenity_slots(id, amenity_id, society_id) on delete restrict,
  constraint amenity_blocks_created_by_same_society_fkey
    foreign key (created_by, society_id) references public.profiles(id, society_id) on delete restrict,
  constraint amenity_blocks_reason_check check (char_length(btrim(reason)) between 3 and 255)
);

alter table public.amenity_bookings
add column slot_id uuid,
add column status_reason text,
add constraint amenity_bookings_slot_same_amenity_fkey
  foreign key (slot_id, amenity_id, society_id)
  references public.amenity_slots(id, amenity_id, society_id) on delete restrict;

create index amenity_slots_active_lookup_idx
on public.amenity_slots (society_id, amenity_id, start_time) where is_active;
create index amenity_blocks_active_lookup_idx
on public.amenity_blocks (society_id, amenity_id, block_date, slot_id) where is_active;
create unique index amenity_blocks_active_day_unique_idx
on public.amenity_blocks (society_id, amenity_id, block_date) where is_active and slot_id is null;
create unique index amenity_blocks_active_slot_unique_idx
on public.amenity_blocks (society_id, amenity_id, block_date, slot_id) where is_active and slot_id is not null;
create index amenity_bookings_active_slot_template_idx
on public.amenity_bookings (society_id, amenity_id, slot_id, slot_start)
where status in ('PENDING', 'CONFIRMED');
create index amenity_bookings_active_resident_day_idx
on public.amenity_bookings (society_id, booked_by, slot_start)
where status in ('PENDING', 'CONFIRMED');

create function public.validate_amenity_booking_configuration(
  requested_open_time time,
  requested_close_time time,
  requested_booking_type text,
  requested_slot_duration_minutes integer,
  requested_max_bookings_per_slot integer,
  requested_advance_booking_days integer,
  requested_max_bookings_per_resident_per_day integer
)
returns void language plpgsql set search_path = '' as $$
declare
  operating_minutes integer;
begin
  if requested_open_time is null or requested_close_time is null or requested_open_time >= requested_close_time then
    raise exception using errcode = '22023', message = 'Amenity opening time must be before closing time';
  end if;
  if requested_booking_type not in ('EXCLUSIVE', 'SHARED') then
    raise exception using errcode = '22023', message = 'Booking type must be exclusive or shared';
  end if;
  if requested_slot_duration_minutes is null or requested_slot_duration_minutes not between 15 and 720 then
    raise exception using errcode = '22023', message = 'Slot duration must be between 15 and 720 minutes';
  end if;
  operating_minutes := extract(epoch from (requested_close_time - requested_open_time))::integer / 60;
  if requested_slot_duration_minutes > operating_minutes or mod(operating_minutes, requested_slot_duration_minutes) <> 0 then
    raise exception using errcode = '22023', message = 'Operating hours must divide evenly into the selected slot duration';
  end if;
  if requested_max_bookings_per_slot is null
    or requested_max_bookings_per_slot not between 1 and 100
    or (requested_booking_type = 'EXCLUSIVE' and requested_max_bookings_per_slot <> 1) then
    raise exception using errcode = '22023', message = 'Amenity capacity is invalid for the selected booking type';
  end if;
  if requested_advance_booking_days is null or requested_advance_booking_days not between 0 and 90 then
    raise exception using errcode = '22023', message = 'Advance booking days must be between 0 and 90';
  end if;
  if requested_max_bookings_per_resident_per_day is null
    or requested_max_bookings_per_resident_per_day not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Resident daily booking limit must be between 1 and 20';
  end if;
end;
$$;

create function public.sync_amenity_slots(
  target_amenity_id uuid,
  target_society_id uuid,
  requested_open_time time,
  requested_close_time time,
  requested_slot_duration_minutes integer
)
returns void language plpgsql set search_path = '' as $$
begin
  update public.amenity_slots
  set is_active = false, updated_at = statement_timestamp()
  where amenity_id = target_amenity_id and society_id = target_society_id and is_active;

  insert into public.amenity_slots (society_id, amenity_id, start_time, end_time, is_active)
  select
    target_society_id,
    target_amenity_id,
    generated_slot::time,
    (generated_slot + make_interval(mins => requested_slot_duration_minutes))::time,
    true
  from generate_series(
    current_date::timestamp + requested_open_time,
    current_date::timestamp + requested_close_time - make_interval(mins => requested_slot_duration_minutes),
    make_interval(mins => requested_slot_duration_minutes)
  ) generated_slot
  on conflict (society_id, amenity_id, start_time, end_time)
  do update set is_active = true, updated_at = statement_timestamp();
end;
$$;

select public.sync_amenity_slots(
  amenity.id,
  amenity.society_id,
  amenity.open_time,
  amenity.close_time,
  amenity.slot_duration_minutes
)
from public.amenities amenity
where amenity.open_time is not null and amenity.close_time is not null and amenity.open_time < amenity.close_time;

update public.amenity_bookings booking
set slot_id = slot.id
from public.amenity_slots slot
where booking.slot_id is null
  and slot.amenity_id = booking.amenity_id
  and slot.society_id = booking.society_id
  and slot.start_time = (booking.slot_start at time zone 'Asia/Kolkata')::time
  and slot.end_time = (booking.slot_end at time zone 'Asia/Kolkata')::time;

alter table public.amenity_slots enable row level security;
alter table public.amenity_blocks enable row level security;

create policy amenity_slots_select on public.amenity_slots
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and is_active
      and exists (
        select 1 from public.amenities amenity
        where amenity.id = amenity_slots.amenity_id
          and amenity.society_id = amenity_slots.society_id
          and amenity.is_active
      )
    )
  )
);

create policy amenity_blocks_select on public.amenity_blocks
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and is_active
      and exists (
        select 1 from public.amenities amenity
        where amenity.id = amenity_blocks.amenity_id
          and amenity.society_id = amenity_blocks.society_id
          and amenity.is_active
      )
    )
  )
);


drop function public.create_admin_amenity(text, text, time, time);
create function public.create_admin_amenity(
  requested_name text,
  requested_description text,
  requested_open_time time,
  requested_close_time time,
  requested_booking_type text,
  requested_slot_duration_minutes integer,
  requested_max_bookings_per_slot integer,
  requested_advance_booking_days integer,
  requested_max_bookings_per_resident_per_day integer,
  requested_requires_admin_approval boolean,
  requested_rules_and_regulations text
)
returns public.amenities language plpgsql security definer set search_path = '' as $$
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
  perform public.validate_amenity_booking_configuration(
    requested_open_time,
    requested_close_time,
    requested_booking_type,
    requested_slot_duration_minutes,
    requested_max_bookings_per_slot,
    requested_advance_booking_days,
    requested_max_bookings_per_resident_per_day
  );
  if requested_requires_admin_approval is null then
    raise exception using errcode = '22023', message = 'Admin approval preference is required';
  end if;
  if exists (
    select 1 from public.amenities
    where society_id = actor.society_id and lower(name) = lower(btrim(requested_name))
  ) then
    raise exception using errcode = '23505', message = 'An amenity with this name already exists';
  end if;

  insert into public.amenities (
    society_id,
    name,
    description,
    open_time,
    close_time,
    booking_type,
    slot_duration_minutes,
    max_bookings_per_slot,
    advance_booking_days,
    max_bookings_per_resident_per_day,
    requires_admin_approval,
    rules_and_regulations
  ) values (
    actor.society_id,
    btrim(requested_name),
    nullif(btrim(coalesce(requested_description, '')), ''),
    requested_open_time,
    requested_close_time,
    requested_booking_type,
    requested_slot_duration_minutes,
    requested_max_bookings_per_slot,
    requested_advance_booking_days,
    requested_max_bookings_per_resident_per_day,
    requested_requires_admin_approval,
    nullif(btrim(coalesce(requested_rules_and_regulations, '')), '')
  ) returning * into result;

  perform public.sync_amenity_slots(
    result.id,
    actor.society_id,
    result.open_time,
    result.close_time,
    result.slot_duration_minutes
  );
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Created amenity ' || result.name);
  return result;
end;
$$;

drop function public.update_admin_amenity(uuid, text, text, time, time);
create function public.update_admin_amenity(
  target_amenity_id uuid,
  requested_name text,
  requested_description text,
  requested_open_time time,
  requested_close_time time,
  requested_booking_type text,
  requested_slot_duration_minutes integer,
  requested_max_bookings_per_slot integer,
  requested_advance_booking_days integer,
  requested_max_bookings_per_resident_per_day integer,
  requested_requires_admin_approval boolean,
  requested_rules_and_regulations text
)
returns public.amenities language plpgsql security definer set search_path = '' as $$
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
  where id = target_amenity_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity is not available to this admin';
  end if;
  if char_length(btrim(coalesce(requested_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Amenity name must be at least 2 characters';
  end if;
  perform public.validate_amenity_booking_configuration(
    requested_open_time,
    requested_close_time,
    requested_booking_type,
    requested_slot_duration_minutes,
    requested_max_bookings_per_slot,
    requested_advance_booking_days,
    requested_max_bookings_per_resident_per_day
  );
  if requested_requires_admin_approval is null then
    raise exception using errcode = '22023', message = 'Admin approval preference is required';
  end if;
  if exists (
    select 1 from public.amenities
    where society_id = actor.society_id
      and id <> target.id
      and lower(name) = lower(btrim(requested_name))
  ) then
    raise exception using errcode = '23505', message = 'An amenity with this name already exists';
  end if;

  update public.amenities set
    name = btrim(requested_name),
    description = nullif(btrim(coalesce(requested_description, '')), ''),
    open_time = requested_open_time,
    close_time = requested_close_time,
    booking_type = requested_booking_type,
    slot_duration_minutes = requested_slot_duration_minutes,
    max_bookings_per_slot = requested_max_bookings_per_slot,
    advance_booking_days = requested_advance_booking_days,
    max_bookings_per_resident_per_day = requested_max_bookings_per_resident_per_day,
    requires_admin_approval = requested_requires_admin_approval,
    rules_and_regulations = nullif(btrim(coalesce(requested_rules_and_regulations, '')), ''),
    updated_at = statement_timestamp()
  where id = target.id
  returning * into target;

  perform public.sync_amenity_slots(
    target.id,
    actor.society_id,
    target.open_time,
    target.close_time,
    target.slot_duration_minutes
  );
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Updated amenity ' || target.name);
  return target;
end;
$$;


drop function public.get_amenity_unavailable_slots(uuid, timestamptz, timestamptz);
create function public.get_amenity_slot_availability(target_amenity_id uuid, requested_date date)
returns table (
  slot_id uuid,
  slot_start timestamptz,
  slot_end timestamptz,
  status text,
  active_bookings integer,
  remaining_capacity integer
)
language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  today_in_society date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
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
  if requested_date is null
    or requested_date < today_in_society
    or requested_date > today_in_society + target.advance_booking_days then
    raise exception using errcode = '22023', message = 'Booking date is outside the allowed advance window';
  end if;

  return query
  with available_slots as (
    select
      slot.id,
      (requested_date::timestamp + slot.start_time) at time zone 'Asia/Kolkata' as calculated_start,
      (requested_date::timestamp + slot.end_time) at time zone 'Asia/Kolkata' as calculated_end
    from public.amenity_slots slot
    where slot.amenity_id = target.id
      and slot.society_id = actor.society_id
      and slot.is_active
  ),
  slot_counts as (
    select
      available_slot.id,
      available_slot.calculated_start,
      available_slot.calculated_end,
      (
        select count(*)::integer
        from public.amenity_bookings booking
        where booking.amenity_id = target.id
          and booking.society_id = actor.society_id
          and booking.status in ('PENDING', 'CONFIRMED')
          and booking.slot_start < available_slot.calculated_end
          and booking.slot_end > available_slot.calculated_start
      ) as booking_count,
      exists (
        select 1
        from public.amenity_blocks block
        left join public.amenity_slots blocked_slot
          on blocked_slot.id = block.slot_id
          and blocked_slot.amenity_id = block.amenity_id
          and blocked_slot.society_id = block.society_id
        where block.amenity_id = target.id
          and block.society_id = actor.society_id
          and block.block_date = requested_date
          and block.is_active
          and (
            block.slot_id is null
            or (
              (requested_date::timestamp + blocked_slot.start_time) at time zone 'Asia/Kolkata'
                < available_slot.calculated_end
              and (requested_date::timestamp + blocked_slot.end_time) at time zone 'Asia/Kolkata'
                > available_slot.calculated_start
            )
          )
      ) as is_blocked
    from available_slots available_slot
  )
  select
    slot_count.id,
    slot_count.calculated_start,
    slot_count.calculated_end,
    case
      when slot_count.is_blocked then 'BLOCKED'
      when slot_count.calculated_start <= statement_timestamp() then 'PAST'
      when slot_count.booking_count >= target.max_bookings_per_slot then 'FULL'
      else 'AVAILABLE'
    end,
    slot_count.booking_count,
    greatest(target.max_bookings_per_slot - slot_count.booking_count, 0)
  from slot_counts slot_count
  order by slot_count.calculated_start;
end;
$$;

drop function public.create_resident_amenity_booking(uuid, timestamptz, timestamptz);
create function public.create_resident_amenity_booking(
  target_amenity_id uuid,
  target_slot_id uuid,
  requested_date date
)
returns public.amenity_bookings language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  selected_slot public.amenity_slots%rowtype;
  result public.amenity_bookings%rowtype;
  today_in_society date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
  calculated_start timestamptz;
  calculated_end timestamptz;
  day_start timestamptz;
  day_end timestamptz;
  resident_booking_count integer;
  slot_booking_count integer;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can book amenities';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id and society_id = actor.society_id and is_active;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity is not available to this resident';
  end if;
  select * into selected_slot from public.amenity_slots
  where id = target_slot_id
    and amenity_id = target.id
    and society_id = actor.society_id
    and is_active;
  if selected_slot.id is null then
    raise exception using errcode = '42501', message = 'Amenity slot is not available to this resident';
  end if;
  if requested_date is null
    or requested_date < today_in_society
    or requested_date > today_in_society + target.advance_booking_days then
    raise exception using errcode = '22023', message = 'Booking date is outside the allowed advance window';
  end if;

  calculated_start := (requested_date::timestamp + selected_slot.start_time) at time zone 'Asia/Kolkata';
  calculated_end := (requested_date::timestamp + selected_slot.end_time) at time zone 'Asia/Kolkata';
  day_start := requested_date::timestamp at time zone 'Asia/Kolkata';
  day_end := (requested_date + 1)::timestamp at time zone 'Asia/Kolkata';
  if calculated_start <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Past amenity slots cannot be booked';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended(
    actor.society_id::text || ':' || target.id::text || ':' || requested_date::text,
    0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    actor.society_id::text || ':' || target.id::text || ':' || selected_slot.id::text || ':' || requested_date::text,
    0
  ));
  if exists (
    select 1
    from public.amenity_blocks block
    left join public.amenity_slots blocked_slot
      on blocked_slot.id = block.slot_id
      and blocked_slot.amenity_id = block.amenity_id
      and blocked_slot.society_id = block.society_id
    where block.amenity_id = target.id
      and block.society_id = actor.society_id
      and block.block_date = requested_date
      and block.is_active
      and (
        block.slot_id is null
        or (
          blocked_slot.start_time < selected_slot.end_time
          and blocked_slot.end_time > selected_slot.start_time
        )
      )
  ) then
    raise exception using errcode = '23P01', message = 'This amenity slot is blocked';
  end if;

  select count(*)::integer into resident_booking_count
  from public.amenity_bookings booking
  where booking.society_id = actor.society_id
    and booking.amenity_id = target.id
    and booking.booked_by = actor.id
    and booking.status in ('PENDING', 'CONFIRMED')
    and booking.slot_start >= day_start
    and booking.slot_start < day_end;
  if resident_booking_count >= target.max_bookings_per_resident_per_day then
    raise exception using errcode = '23514', message = 'You have reached the daily booking limit';
  end if;

  select count(*)::integer into slot_booking_count
  from public.amenity_bookings booking
  where booking.amenity_id = target.id
    and booking.society_id = actor.society_id
    and booking.status in ('PENDING', 'CONFIRMED')
    and booking.slot_start < calculated_end
    and booking.slot_end > calculated_start;
  if slot_booking_count >= target.max_bookings_per_slot then
    raise exception using errcode = '23P01', message = 'Booking slot is no longer available';
  end if;

  insert into public.amenity_bookings (
    amenity_id, society_id, flat_id, booked_by, slot_id, slot_start, slot_end, status
  ) values (
    target.id,
    actor.society_id,
    actor.flat_id,
    actor.id,
    selected_slot.id,
    calculated_start,
    calculated_end,
    case when target.requires_admin_approval then 'PENDING'::public.booking_status else 'CONFIRMED'::public.booking_status end
  ) returning * into result;
  return result;
end;
$$;


create function public.create_admin_amenity_block(
  target_amenity_id uuid,
  requested_block_date date,
  target_slot_id uuid,
  requested_reason text,
  cancel_existing_bookings boolean
)
returns table (block_id uuid, cancelled_booking_ids uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  selected_slot public.amenity_slots%rowtype;
  result public.amenity_blocks%rowtype;
  affected_booking_ids uuid[];
  day_start timestamptz;
  day_end timestamptz;
  blocked_start timestamptz;
  blocked_end timestamptz;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can block amenities';
  end if;
  select * into target from public.amenities
  where id = target_amenity_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity is not available to this admin';
  end if;
  if requested_block_date is null
    or requested_block_date < (statement_timestamp() at time zone 'Asia/Kolkata')::date then
    raise exception using errcode = '22023', message = 'Past dates cannot be blocked';
  end if;
  if char_length(btrim(coalesce(requested_reason, ''))) not between 3 and 255 then
    raise exception using errcode = '22023', message = 'Block reason must be between 3 and 255 characters';
  end if;
  if target_slot_id is not null then
    select * into selected_slot from public.amenity_slots
    where id = target_slot_id
      and amenity_id = target.id
      and society_id = actor.society_id
      and is_active;
    if selected_slot.id is null then
      raise exception using errcode = '42501', message = 'Amenity slot is not available to this admin';
    end if;
  end if;

  if target_slot_id is null then
    perform pg_advisory_xact_lock(hashtextextended(
      actor.society_id::text || ':' || target.id::text || ':' || requested_block_date::text,
      0
    ));
  else
    perform pg_advisory_xact_lock_shared(hashtextextended(
      actor.society_id::text || ':' || target.id::text || ':' || requested_block_date::text,
      0
    ));
    perform pg_advisory_xact_lock(hashtextextended(
      actor.society_id::text || ':' || target.id::text || ':' || target_slot_id::text || ':' || requested_block_date::text,
      0
    ));
  end if;
  if exists (
    select 1
    from public.amenity_blocks block
    left join public.amenity_slots blocked_slot
      on blocked_slot.id = block.slot_id
      and blocked_slot.amenity_id = block.amenity_id
      and blocked_slot.society_id = block.society_id
    where block.amenity_id = target.id
      and block.society_id = actor.society_id
      and block.block_date = requested_block_date
      and block.is_active
      and (
        block.slot_id is null
        or target_slot_id is null
        or (
          blocked_slot.start_time < selected_slot.end_time
          and blocked_slot.end_time > selected_slot.start_time
        )
      )
  ) then
    raise exception using errcode = '23505', message = 'This amenity period is already blocked';
  end if;

  day_start := requested_block_date::timestamp at time zone 'Asia/Kolkata';
  day_end := (requested_block_date + 1)::timestamp at time zone 'Asia/Kolkata';
  blocked_start := case
    when target_slot_id is null then day_start
    else (requested_block_date::timestamp + selected_slot.start_time) at time zone 'Asia/Kolkata'
  end;
  blocked_end := case
    when target_slot_id is null then day_end
    else (requested_block_date::timestamp + selected_slot.end_time) at time zone 'Asia/Kolkata'
  end;
  select coalesce(array_agg(booking.id), '{}'::uuid[]) into affected_booking_ids
  from public.amenity_bookings booking
  where booking.amenity_id = target.id
    and booking.society_id = actor.society_id
    and booking.status in ('PENDING', 'CONFIRMED')
    and booking.slot_start < blocked_end
    and booking.slot_end > blocked_start;
  if cardinality(affected_booking_ids) > 0 and not coalesce(cancel_existing_bookings, false) then
    raise exception using
      errcode = '23503',
      message = 'Active bookings must be explicitly cancelled before blocking this period';
  end if;

  insert into public.amenity_blocks (
    society_id, amenity_id, block_date, slot_id, reason, created_by
  ) values (
    actor.society_id, target.id, requested_block_date, target_slot_id, btrim(requested_reason), actor.id
  ) returning * into result;

  if cardinality(affected_booking_ids) > 0 then
    update public.amenity_bookings set
      status = 'CANCELLED',
      status_reason = 'Cancelled because the amenity was blocked: ' || btrim(requested_reason),
      decided_by = actor.id,
      decided_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = any(affected_booking_ids);
  end if;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Blocked ' || target.name || ' on ' || requested_block_date::text);
  return query select result.id, affected_booking_ids;
end;
$$;

create function public.remove_admin_amenity_block(target_block_id uuid)
returns public.amenity_blocks language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  target public.amenity_blocks%rowtype;
  amenity_name text;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can remove amenity blocks';
  end if;
  select * into target from public.amenity_blocks
  where id = target_block_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity block is not available to this admin';
  end if;
  if not target.is_active then
    raise exception using errcode = '22023', message = 'Amenity block is already removed';
  end if;
  update public.amenity_blocks
  set is_active = false, updated_at = statement_timestamp()
  where id = target.id returning * into target;
  select name into amenity_name from public.amenities
  where id = target.amenity_id and society_id = actor.society_id;
  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    'Removed block for ' || coalesce(amenity_name, 'amenity') || ' on ' || target.block_date::text
  );
  return target;
end;
$$;

create or replace function public.cancel_resident_amenity_booking(target_booking_id uuid)
returns public.amenity_bookings language plpgsql security definer set search_path = '' as $$
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
  where id = target_booking_id and society_id = actor.society_id and booked_by = actor.id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Booking is not available to this resident';
  end if;
  if target.status = 'CANCELLED' then raise exception using errcode = '22023', message = 'Booking is already cancelled'; end if;
  if target.slot_start <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Started bookings cannot be cancelled';
  end if;
  update public.amenity_bookings set
    status = 'CANCELLED',
    status_reason = 'Cancelled by resident',
    decided_by = actor.id,
    decided_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = target.id returning * into target;
  return target;
end;
$$;

create or replace function public.decide_admin_amenity_booking(
  target_booking_id uuid,
  requested_decision public.booking_status
)
returns public.amenity_bookings language plpgsql security definer set search_path = '' as $$
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
  where id = target_booking_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Booking is not available to this admin';
  end if;
  if target.status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'Only pending bookings can be decided';
  end if;
  if exists (
    select 1
    from public.amenity_blocks block
    left join public.amenity_slots blocked_slot
      on blocked_slot.id = block.slot_id
      and blocked_slot.amenity_id = block.amenity_id
      and blocked_slot.society_id = block.society_id
    where block.amenity_id = target.amenity_id
      and block.society_id = actor.society_id
      and block.block_date = (target.slot_start at time zone 'Asia/Kolkata')::date
      and block.is_active
      and (
        block.slot_id is null
        or (
          blocked_slot.start_time < (target.slot_end at time zone 'Asia/Kolkata')::time
          and blocked_slot.end_time > (target.slot_start at time zone 'Asia/Kolkata')::time
        )
      )
  ) then
    raise exception using errcode = '23P01', message = 'Blocked amenity bookings cannot be confirmed';
  end if;
  update public.amenity_bookings set
    status = requested_decision,
    status_reason = case when requested_decision = 'CANCELLED' then 'Declined by admin' else null end,
    decided_by = actor.id,
    decided_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = target.id returning * into target;
  select name into amenity_name from public.amenities
  where id = target.amenity_id and society_id = actor.society_id;
  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    (case when requested_decision = 'CONFIRMED' then 'Confirmed booking for ' else 'Declined booking for ' end)
      || coalesce(amenity_name, 'amenity')
  );
  return target;
end;
$$;


revoke all on function public.validate_amenity_booking_configuration(time, time, text, integer, integer, integer, integer)
from public, anon, authenticated;
revoke all on function public.sync_amenity_slots(uuid, uuid, time, time, integer)
from public, anon, authenticated;

revoke all on function public.create_admin_amenity(
  text, text, time, time, text, integer, integer, integer, integer, boolean, text
) from public, anon;
revoke all on function public.update_admin_amenity(
  uuid, text, text, time, time, text, integer, integer, integer, integer, boolean, text
) from public, anon;
revoke all on function public.get_amenity_slot_availability(uuid, date) from public, anon;
revoke all on function public.create_resident_amenity_booking(uuid, uuid, date) from public, anon;
revoke all on function public.create_admin_amenity_block(uuid, date, uuid, text, boolean) from public, anon;
revoke all on function public.remove_admin_amenity_block(uuid) from public, anon;
revoke all on function public.cancel_resident_amenity_booking(uuid) from public, anon;
revoke all on function public.decide_admin_amenity_booking(uuid, public.booking_status) from public, anon;

grant execute on function public.create_admin_amenity(
  text, text, time, time, text, integer, integer, integer, integer, boolean, text
) to authenticated;
grant execute on function public.update_admin_amenity(
  uuid, text, text, time, time, text, integer, integer, integer, integer, boolean, text
) to authenticated;
grant execute on function public.get_amenity_slot_availability(uuid, date) to authenticated;
grant execute on function public.create_resident_amenity_booking(uuid, uuid, date) to authenticated;
grant execute on function public.create_admin_amenity_block(uuid, date, uuid, text, boolean) to authenticated;
grant execute on function public.remove_admin_amenity_block(uuid) to authenticated;
grant execute on function public.cancel_resident_amenity_booking(uuid) to authenticated;
grant execute on function public.decide_admin_amenity_booking(uuid, public.booking_status) to authenticated;

grant select on public.amenity_slots, public.amenity_blocks to authenticated;
grant select, insert, update, delete on public.amenity_slots, public.amenity_blocks to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'amenity_slots'
  ) then
    alter publication supabase_realtime add table public.amenity_slots;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'amenity_blocks'
  ) then
    alter publication supabase_realtime add table public.amenity_blocks;
  end if;
end;
$$;

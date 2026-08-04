-- Forced-password accounts may read only the profile data required to finish
-- account setup. Domain access resumes after the trusted completion flow
-- clears must_change_password.

drop trigger if exists account_lifecycle_guard on public.profiles;
create trigger account_lifecycle_guard
before insert or update or delete on public.profiles
for each row
execute function public.enforce_active_completed_account_for_domain_writes();

create or replace function public.search_guard_residents(requested_search text default '')
returns table (
  id uuid,
  society_id uuid,
  full_name text,
  flat_id uuid,
  flat_number text,
  tower_id uuid,
  tower_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  normalized_search text := trim(coalesce(requested_search, ''));
begin
  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid())
    and profiles.is_active
    and not profiles.must_change_password;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only guards can search residents';
  end if;
  if char_length(normalized_search) > 80 then
    raise exception using errcode = '22023', message = 'Resident search is too long';
  end if;

  return query
  select
    resident.id,
    resident.society_id,
    resident.full_name,
    flat.id,
    flat.number,
    tower.id,
    tower.code
  from public.profiles as resident
  join public.flats as flat
    on flat.id = resident.flat_id
    and flat.society_id = resident.society_id
  join public.towers as tower
    on tower.id = flat.tower_id
    and tower.society_id = resident.society_id
  where resident.society_id = actor.society_id
    and resident.role = 'RESIDENT'
    and resident.is_active
    and (
      normalized_search = ''
      or resident.full_name ilike '%' || normalized_search || '%'
      or flat.number ilike '%' || normalized_search || '%'
      or (tower.code || '-' || flat.number) ilike '%' || normalized_search || '%'
    )
  order by resident.full_name, tower.code, flat.number
  limit 50;
end;
$$;

create or replace function public.lookup_guard_gate_pass(requested_code text)
returns table (
  id uuid,
  society_id uuid,
  status public.visitor_request_status,
  is_pre_approved boolean,
  created_at timestamptz,
  decision_at timestamptz,
  entry_at timestamptz,
  exit_at timestamptz,
  gate_pass_code text,
  valid_until timestamptz,
  flat_id uuid,
  raised_by uuid,
  visitor jsonb,
  flat jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  matched_request public.visitor_requests%rowtype;
  latest_request public.visitor_requests%rowtype;
  normalized_code text := trim(coalesce(requested_code, ''));
  pass_digits text;
  formatted_code text;
  lookup_time timestamptz := statement_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid())
    and profiles.is_active
    and not profiles.must_change_password;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only active guards can verify gate passes';
  end if;

  if normalized_code !~ '^[0-9]{3} ?[0-9]{3}$' then
    raise exception using errcode = '22023', message = 'Enter a valid six-digit gate-pass code';
  end if;

  pass_digits := replace(normalized_code, ' ', '');
  formatted_code := substr(pass_digits, 1, 3) || ' ' || substr(pass_digits, 4, 3);

  update public.visitor_requests
  set status = 'EXPIRED'
  where visitor_requests.society_id = actor.society_id
    and visitor_requests.gate_pass_code = formatted_code
    and visitor_requests.is_pre_approved
    and visitor_requests.status = 'APPROVED'
    and visitor_requests.entry_at is null
    and visitor_requests.valid_until <= lookup_time;

  select * into matched_request
  from public.visitor_requests
  where visitor_requests.society_id = actor.society_id
    and visitor_requests.gate_pass_code = formatted_code
    and visitor_requests.is_pre_approved
    and visitor_requests.status = 'APPROVED'
    and visitor_requests.entry_at is null
    and visitor_requests.valid_until > lookup_time
  limit 1;

  if matched_request.id is null then
    select * into latest_request
    from public.visitor_requests
    where visitor_requests.society_id = actor.society_id
      and visitor_requests.gate_pass_code = formatted_code
      and visitor_requests.is_pre_approved
    order by visitor_requests.created_at desc
    limit 1;

    if latest_request.id is null then
      raise exception using errcode = 'P0002', message = 'No gate pass was found for that code';
    end if;

    matched_request := latest_request;
  end if;

  return query
  select
    visitor_requests.id,
    visitor_requests.society_id,
    visitor_requests.status,
    visitor_requests.is_pre_approved,
    visitor_requests.created_at,
    visitor_requests.decision_at,
    visitor_requests.entry_at,
    visitor_requests.exit_at,
    visitor_requests.gate_pass_code,
    visitor_requests.valid_until,
    visitor_requests.flat_id,
    visitor_requests.raised_by,
    jsonb_build_object(
      'name', visitors.name,
      'category', visitors.category,
      'phone', visitors.phone
    ) as visitor,
    jsonb_build_object(
      'number', flats.number,
      'tower', case
        when towers.id is null then null
        else jsonb_build_object('code', towers.code, 'name', towers.name)
      end
    ) as flat
  from public.visitor_requests
  join public.visitors
    on visitors.id = visitor_requests.visitor_id
    and visitors.society_id = actor.society_id
  join public.flats
    on flats.id = visitor_requests.flat_id
    and flats.society_id = actor.society_id
  left join public.towers
    on towers.id = flats.tower_id
    and towers.society_id = actor.society_id
  where visitor_requests.id = matched_request.id;
end;
$$;

create or replace function public.get_amenity_slot_availability(
  target_amenity_id uuid,
  requested_date date
)
returns table (
  slot_id uuid,
  slot_start timestamptz,
  slot_end timestamptz,
  status text,
  active_bookings integer,
  remaining_capacity integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  today_in_society date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid())
    and is_active
    and not must_change_password;

  if actor.id is null or actor.role not in ('ADMIN', 'RESIDENT') then
    raise exception using errcode = '42501', message = 'Amenity availability is not available to this role';
  end if;

  select * into target
  from public.amenities
  where id = target_amenity_id
    and society_id = actor.society_id
    and (is_active or actor.role = 'ADMIN');

  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity is not available';
  end if;
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

revoke all on function public.search_guard_residents(text) from public, anon, authenticated, service_role;
revoke all on function public.lookup_guard_gate_pass(text) from public, anon, authenticated, service_role;
revoke all on function public.get_amenity_slot_availability(uuid, date) from public, anon, authenticated, service_role;

grant execute on function public.search_guard_residents(text) to authenticated;
grant execute on function public.lookup_guard_gate_pass(text) to authenticated;
grant execute on function public.get_amenity_slot_availability(uuid, date) to authenticated;

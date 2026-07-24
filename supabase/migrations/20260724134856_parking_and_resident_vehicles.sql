create table public.parking_slots (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  code text not null,
  zone text not null,
  level_label text not null,
  row_index integer not null check (row_index >= 0),
  column_index integer not null check (column_index >= 0),
  slot_type text not null check (slot_type in ('CAR', 'BIKE', 'EV', 'ACCESSIBLE', 'FLEX')),
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parking_slots_code_not_blank check (btrim(code) <> ''),
  constraint parking_slots_zone_not_blank check (btrim(zone) <> ''),
  constraint parking_slots_level_not_blank check (btrim(level_label) <> ''),
  constraint parking_slots_id_society_unique unique (id, society_id),
  constraint parking_slots_code_society_unique unique (society_id, code),
  constraint parking_slots_position_society_unique unique (society_id, zone, level_label, row_index, column_index),
  constraint parking_slots_created_by_same_society_fkey foreign key (created_by, society_id)
    references public.profiles(id, society_id)
);

create table public.resident_vehicles (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  created_by uuid not null,
  registration_number text not null,
  vehicle_type text not null check (vehicle_type in ('CAR', 'BIKE', 'EV', 'OTHER')),
  make_model text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resident_vehicles_registration_not_blank check (btrim(registration_number) <> ''),
  constraint resident_vehicles_id_society_unique unique (id, society_id),
  constraint resident_vehicles_registration_society_unique unique (society_id, registration_number),
  constraint resident_vehicles_flat_same_society_fkey foreign key (flat_id, society_id)
    references public.flats(id, society_id),
  constraint resident_vehicles_creator_same_society_fkey foreign key (created_by, society_id)
    references public.profiles(id, society_id)
);

create table public.parking_assignments (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  slot_id uuid not null,
  vehicle_id uuid not null,
  flat_id uuid not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid,
  constraint parking_assignments_end_pair check (
    (ended_at is null and ended_by is null) or (ended_at is not null and ended_by is not null)
  ),
  constraint parking_assignments_slot_same_society_fkey foreign key (slot_id, society_id)
    references public.parking_slots(id, society_id),
  constraint parking_assignments_vehicle_same_society_fkey foreign key (vehicle_id, society_id)
    references public.resident_vehicles(id, society_id),
  constraint parking_assignments_flat_same_society_fkey foreign key (flat_id, society_id)
    references public.flats(id, society_id),
  constraint parking_assignments_assigned_by_same_society_fkey foreign key (assigned_by, society_id)
    references public.profiles(id, society_id),
  constraint parking_assignments_ended_by_same_society_fkey foreign key (ended_by, society_id)
    references public.profiles(id, society_id)
);

create index parking_slots_society_layout_idx
  on public.parking_slots (society_id, zone, level_label, row_index, column_index);
create index resident_vehicles_society_flat_active_idx
  on public.resident_vehicles (society_id, flat_id, is_active);
create index parking_assignments_society_flat_history_idx
  on public.parking_assignments (society_id, flat_id, assigned_at desc);
create index parking_assignments_slot_history_idx on public.parking_assignments (slot_id, assigned_at desc);
create index parking_assignments_vehicle_history_idx on public.parking_assignments (vehicle_id, assigned_at desc);
create unique index parking_assignments_active_slot_unique
  on public.parking_assignments (slot_id) where ended_at is null;
create unique index parking_assignments_active_vehicle_unique
  on public.parking_assignments (vehicle_id) where ended_at is null;

alter table public.parking_slots enable row level security;
alter table public.resident_vehicles enable row level security;
alter table public.parking_assignments enable row level security;

create policy parking_slots_scoped_select on public.parking_slots
for select to authenticated
using (
  society_id = public.current_society_id()
  and (is_active or public.current_user_role() = 'ADMIN')
);

create policy resident_vehicles_scoped_select on public.resident_vehicles
for select to authenticated
using (
  society_id = public.current_society_id()
  and (
    public.current_user_role() in ('ADMIN', 'GUARD')
    or (public.current_user_role() = 'RESIDENT' and flat_id = public.current_flat_id())
  )
  and (is_active or public.current_user_role() = 'ADMIN')
);

create policy parking_assignments_scoped_select on public.parking_assignments
for select to authenticated
using (
  society_id = public.current_society_id()
  and (
    public.current_user_role() in ('ADMIN', 'GUARD')
    or (public.current_user_role() = 'RESIDENT' and flat_id = public.current_flat_id())
  )
);

create or replace function public.create_admin_parking_slot(
  requested_code text,
  requested_zone text,
  requested_level_label text,
  requested_row_index integer,
  requested_column_index integer,
  requested_slot_type text
)
returns public.parking_slots
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  created_slot public.parking_slots;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can create parking slots';
  end if;
  if btrim(coalesce(requested_code, '')) = ''
    or btrim(coalesce(requested_zone, '')) = ''
    or btrim(coalesce(requested_level_label, '')) = ''
    or requested_row_index is null or requested_column_index is null
    or requested_row_index < 0 or requested_column_index < 0
    or requested_slot_type not in ('CAR', 'BIKE', 'EV', 'ACCESSIBLE', 'FLEX')
  then
    raise exception using errcode = '22023', message = 'Enter a valid parking slot layout';
  end if;

  insert into public.parking_slots (
    society_id, code, zone, level_label, row_index, column_index, slot_type, created_by
  ) values (
    actor.society_id, upper(btrim(requested_code)), btrim(requested_zone),
    btrim(requested_level_label), requested_row_index, requested_column_index,
    requested_slot_type, actor.id
  )
  returning * into created_slot;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'PARKING_SLOT_CREATED',
    jsonb_build_object('slot_id', created_slot.id, 'code', created_slot.code)
  );
  return created_slot;
end;
$$;
create or replace function public.set_admin_parking_slot_active(
  target_slot_id uuid,
  requested_active boolean
)
returns public.parking_slots
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  updated_slot public.parking_slots;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can update parking slots';
  end if;
  if requested_active is null then
    raise exception using errcode = '22023', message = 'Parking slot state is required';
  end if;
  if requested_active = false and exists (
    select 1 from public.parking_assignments
    where society_id = actor.society_id and slot_id = target_slot_id and ended_at is null
  ) then
    raise exception using errcode = '23514', message = 'Release the active assignment before deactivating this slot';
  end if;

  update public.parking_slots
  set is_active = requested_active, updated_at = now()
  where id = target_slot_id and society_id = actor.society_id
  returning * into updated_slot;
  if updated_slot.id is null then
    raise exception using errcode = 'P0002', message = 'Parking slot not found in your society';
  end if;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id,
    case when requested_active then 'PARKING_SLOT_ACTIVATED' else 'PARKING_SLOT_DEACTIVATED' end,
    jsonb_build_object('slot_id', updated_slot.id, 'code', updated_slot.code)
  );
  return updated_slot;
end;
$$;

create or replace function public.create_resident_vehicle(
  requested_registration_number text,
  requested_vehicle_type text,
  requested_make_model text default null,
  requested_color text default null
)
returns public.resident_vehicles
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  created_vehicle public.resident_vehicles;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can add vehicles';
  end if;
  if btrim(coalesce(requested_registration_number, '')) = ''
    or requested_vehicle_type not in ('CAR', 'BIKE', 'EV', 'OTHER')
  then
    raise exception using errcode = '22023', message = 'Enter valid vehicle details';
  end if;

  insert into public.resident_vehicles (
    society_id, flat_id, created_by, registration_number, vehicle_type, make_model, color
  ) values (
    actor.society_id, actor.flat_id, actor.id,
    upper(regexp_replace(btrim(requested_registration_number), '\s+', '', 'g')),
    requested_vehicle_type, nullif(btrim(requested_make_model), ''), nullif(btrim(requested_color), '')
  )
  returning * into created_vehicle;
  return created_vehicle;
end;
$$;

create or replace function public.update_resident_vehicle(
  target_vehicle_id uuid,
  requested_vehicle_type text,
  requested_make_model text default null,
  requested_color text default null
)
returns public.resident_vehicles
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  updated_vehicle public.resident_vehicles;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can update vehicles';
  end if;
  if requested_vehicle_type not in ('CAR', 'BIKE', 'EV', 'OTHER') then
    raise exception using errcode = '22023', message = 'Select a valid vehicle type';
  end if;

  update public.resident_vehicles
  set vehicle_type = requested_vehicle_type,
      make_model = nullif(btrim(requested_make_model), ''),
      color = nullif(btrim(requested_color), ''),
      updated_at = now()
  where id = target_vehicle_id and society_id = actor.society_id
    and flat_id = actor.flat_id and is_active
  returning * into updated_vehicle;
  if updated_vehicle.id is null then
    raise exception using errcode = 'P0002', message = 'Active vehicle not found for your flat';
  end if;
  return updated_vehicle;
end;
$$;

create or replace function public.deactivate_resident_vehicle(target_vehicle_id uuid)
returns public.resident_vehicles
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  updated_vehicle public.resident_vehicles;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can remove vehicles';
  end if;
  if exists (
    select 1 from public.parking_assignments
    where society_id = actor.society_id and vehicle_id = target_vehicle_id and ended_at is null
  ) then
    raise exception using errcode = '23514', message = 'Ask the society admin to release this vehicle parking assignment first';
  end if;

  update public.resident_vehicles
  set is_active = false, updated_at = now()
  where id = target_vehicle_id and society_id = actor.society_id
    and flat_id = actor.flat_id and is_active
  returning * into updated_vehicle;
  if updated_vehicle.id is null then
    raise exception using errcode = 'P0002', message = 'Active vehicle not found for your flat';
  end if;
  return updated_vehicle;
end;
$$;

create or replace function public.assign_admin_parking_slot(
  target_slot_id uuid,
  target_vehicle_id uuid
)
returns public.parking_assignments
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  target_slot public.parking_slots;
  target_vehicle public.resident_vehicles;
  created_assignment public.parking_assignments;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can assign parking';
  end if;

  select * into target_slot from public.parking_slots
  where id = target_slot_id and society_id = actor.society_id for update;
  select * into target_vehicle from public.resident_vehicles
  where id = target_vehicle_id and society_id = actor.society_id for update;
  if target_slot.id is null or not target_slot.is_active then
    raise exception using errcode = 'P0002', message = 'Active parking slot not found in your society';
  end if;
  if target_vehicle.id is null or not target_vehicle.is_active then
    raise exception using errcode = 'P0002', message = 'Active resident vehicle not found in your society';
  end if;

  perform id from public.parking_assignments
  where society_id = actor.society_id and ended_at is null
    and (slot_id = target_slot_id or vehicle_id = target_vehicle_id)
  order by id for update;

  update public.parking_assignments
  set ended_at = now(), ended_by = actor.id
  where society_id = actor.society_id and ended_at is null
    and (slot_id = target_slot_id or vehicle_id = target_vehicle_id);

  insert into public.parking_assignments (
    society_id, slot_id, vehicle_id, flat_id, assigned_by
  ) values (
    actor.society_id, target_slot.id, target_vehicle.id, target_vehicle.flat_id, actor.id
  )
  returning * into created_assignment;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'PARKING_ASSIGNED',
    jsonb_build_object(
      'assignment_id', created_assignment.id, 'slot_id', target_slot.id,
      'vehicle_id', target_vehicle.id, 'flat_id', target_vehicle.flat_id
    )
  );
  return created_assignment;
end;
$$;

create or replace function public.release_admin_parking_slot(target_slot_id uuid)
returns public.parking_assignments
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  released_assignment public.parking_assignments;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can release parking';
  end if;

  select * into released_assignment from public.parking_assignments
  where society_id = actor.society_id and slot_id = target_slot_id and ended_at is null
  for update;
  if released_assignment.id is null then
    raise exception using errcode = 'P0002', message = 'Active parking assignment not found in your society';
  end if;

  update public.parking_assignments
  set ended_at = now(), ended_by = actor.id
  where id = released_assignment.id
  returning * into released_assignment;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'PARKING_RELEASED',
    jsonb_build_object(
      'assignment_id', released_assignment.id, 'slot_id', released_assignment.slot_id,
      'vehicle_id', released_assignment.vehicle_id
    )
  );
  return released_assignment;
end;
$$;

revoke all on public.parking_slots, public.resident_vehicles, public.parking_assignments from anon, authenticated;
grant select on public.parking_slots, public.resident_vehicles, public.parking_assignments to authenticated;

revoke all on function public.create_admin_parking_slot(text, text, text, integer, integer, text) from public, anon;
revoke all on function public.set_admin_parking_slot_active(uuid, boolean) from public, anon;
revoke all on function public.create_resident_vehicle(text, text, text, text) from public, anon;
revoke all on function public.update_resident_vehicle(uuid, text, text, text) from public, anon;
revoke all on function public.deactivate_resident_vehicle(uuid) from public, anon;
revoke all on function public.assign_admin_parking_slot(uuid, uuid) from public, anon;
revoke all on function public.release_admin_parking_slot(uuid) from public, anon;
grant execute on function public.create_admin_parking_slot(text, text, text, integer, integer, text) to authenticated;
grant execute on function public.set_admin_parking_slot_active(uuid, boolean) to authenticated;
grant execute on function public.create_resident_vehicle(text, text, text, text) to authenticated;
grant execute on function public.update_resident_vehicle(uuid, text, text, text) to authenticated;
grant execute on function public.deactivate_resident_vehicle(uuid) to authenticated;
grant execute on function public.assign_admin_parking_slot(uuid, uuid) to authenticated;
grant execute on function public.release_admin_parking_slot(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parking_slots'
    ) then alter publication supabase_realtime add table public.parking_slots; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_vehicles'
    ) then alter publication supabase_realtime add table public.resident_vehicles; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parking_assignments'
    ) then alter publication supabase_realtime add table public.parking_assignments; end if;
  end if;
end;
$$;

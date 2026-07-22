-- Optional vehicle metadata belongs to a visit, not to a reusable visitor
-- identity, because the same person may arrive in different vehicles.

create type public.visitor_vehicle_type as enum (
  'CAR',
  'TWO_WHEELER',
  'COMMERCIAL',
  'OTHER'
);

alter table public.visitor_requests
add column vehicle_number text,
add column vehicle_type public.visitor_vehicle_type,
add constraint visitor_requests_vehicle_pair_check check (
  (vehicle_number is null and vehicle_type is null)
  or (vehicle_number is not null and vehicle_type is not null)
),
add constraint visitor_requests_vehicle_number_check check (
  vehicle_number is null
  or (
    char_length(vehicle_number) between 3 and 20
    and vehicle_number ~ '^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$'
  )
);

create function public.normalize_visitor_vehicle(
  requested_vehicle_number text,
  requested_vehicle_type public.visitor_vehicle_type
)
returns table (
  normalized_vehicle_number text,
  normalized_vehicle_type public.visitor_vehicle_type
)
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  normalized_number text := nullif(
    regexp_replace(upper(btrim(coalesce(requested_vehicle_number, ''))), '[[:space:]]+', ' ', 'g'),
    ''
  );
begin
  if (normalized_number is null) <> (requested_vehicle_type is null) then
    raise exception using
      errcode = '22023',
      message = 'Choose a vehicle type and enter its registration number';
  end if;

  if normalized_number is not null and (
    char_length(normalized_number) not between 3 and 20
    or normalized_number !~ '^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Vehicle number must be 3 to 20 letters, numbers, spaces or hyphens';
  end if;

  return query select normalized_number, requested_vehicle_type;
end;
$$;

revoke all on function public.normalize_visitor_vehicle(text, public.visitor_vehicle_type)
from public, anon, authenticated;

drop function public.create_guard_visitor_request(
  uuid,
  text,
  text,
  public.visitor_category
);

create function public.create_guard_visitor_request(
  requested_flat_id uuid,
  requested_name text,
  requested_phone text,
  requested_category public.visitor_category,
  requested_vehicle_number text default null,
  requested_vehicle_type public.visitor_vehicle_type default null
)
returns public.visitor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target_flat public.flats%rowtype;
  created_visitor public.visitors%rowtype;
  created_request public.visitor_requests%rowtype;
  normalized_name text := trim(coalesce(requested_name, ''));
  normalized_phone text := nullif(trim(coalesce(requested_phone, '')), '');
  normalized_vehicle_number text;
  normalized_vehicle_type public.visitor_vehicle_type;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only guards can create visitor requests';
  end if;
  if char_length(normalized_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Visitor name must be between 2 and 120 characters';
  end if;
  if normalized_phone is not null and normalized_phone !~ '^[0-9+() -]{7,20}$' then
    raise exception using errcode = '22023', message = 'Visitor phone number is invalid';
  end if;
  if requested_category is null then
    raise exception using errcode = '22023', message = 'Visitor category is required';
  end if;

  select vehicle.normalized_vehicle_number, vehicle.normalized_vehicle_type
  into normalized_vehicle_number, normalized_vehicle_type
  from public.normalize_visitor_vehicle(
    requested_vehicle_number,
    requested_vehicle_type
  ) as vehicle;

  select * into target_flat
  from public.flats
  where flats.id = requested_flat_id
    and flats.society_id = actor.society_id;

  if target_flat.id is null or not exists (
    select 1
    from public.profiles as resident
    where resident.society_id = actor.society_id
      and resident.flat_id = target_flat.id
      and resident.role = 'RESIDENT'
      and resident.is_active
  ) then
    raise exception using errcode = '42501', message = 'Flat is not available for visitor routing';
  end if;

  insert into public.visitors (society_id, name, phone, category)
  values (actor.society_id, normalized_name, normalized_phone, requested_category)
  returning * into created_visitor;

  insert into public.visitor_requests (
    society_id,
    visitor_id,
    flat_id,
    raised_by,
    status,
    vehicle_number,
    vehicle_type
  )
  values (
    actor.society_id,
    created_visitor.id,
    target_flat.id,
    actor.id,
    'PENDING',
    normalized_vehicle_number,
    normalized_vehicle_type
  )
  returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.create_guard_visitor_request(
  uuid,
  text,
  text,
  public.visitor_category,
  text,
  public.visitor_vehicle_type
) from public, anon;

grant execute on function public.create_guard_visitor_request(
  uuid,
  text,
  text,
  public.visitor_category,
  text,
  public.visitor_vehicle_type
) to authenticated;

drop function public.create_resident_visitor_preapproval(
  text,
  text,
  public.visitor_category
);

create function public.create_resident_visitor_preapproval(
  requested_name text,
  requested_phone text,
  requested_category public.visitor_category,
  requested_vehicle_number text default null,
  requested_vehicle_type public.visitor_vehicle_type default null
)
returns public.visitor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  created_visitor public.visitors%rowtype;
  created_request public.visitor_requests%rowtype;
  normalized_name text := trim(coalesce(requested_name, ''));
  normalized_phone text := nullif(trim(coalesce(requested_phone, '')), '');
  normalized_vehicle_number text;
  normalized_vehicle_type public.visitor_vehicle_type;
  random_bytes bytea;
  pass_number integer;
  pass_digits text;
  candidate_code text;
  pass_created_at timestamptz := statement_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can pre-approve visitors';
  end if;
  if not exists (
    select 1
    from public.flats
    where flats.id = actor.flat_id
      and flats.society_id = actor.society_id
  ) then
    raise exception using errcode = '42501', message = 'Resident flat is not available';
  end if;
  if char_length(normalized_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Visitor name must be between 2 and 120 characters';
  end if;
  if normalized_phone is not null and normalized_phone !~ '^[0-9+() -]{7,20}$' then
    raise exception using errcode = '22023', message = 'Visitor phone number is invalid';
  end if;
  if requested_category is null then
    raise exception using errcode = '22023', message = 'Visitor category is required';
  end if;

  select vehicle.normalized_vehicle_number, vehicle.normalized_vehicle_type
  into normalized_vehicle_number, normalized_vehicle_type
  from public.normalize_visitor_vehicle(
    requested_vehicle_number,
    requested_vehicle_type
  ) as vehicle;

  update public.visitor_requests
  set status = 'EXPIRED'
  where visitor_requests.society_id = actor.society_id
    and visitor_requests.is_pre_approved
    and visitor_requests.status = 'APPROVED'
    and visitor_requests.entry_at is null
    and visitor_requests.valid_until <= pass_created_at;

  insert into public.visitors (society_id, name, phone, category)
  values (actor.society_id, normalized_name, normalized_phone, requested_category)
  returning * into created_visitor;

  for code_attempt in 1..12 loop
    random_bytes := extensions.gen_random_bytes(3);
    pass_number := (
      get_byte(random_bytes, 0) * 65536
      + get_byte(random_bytes, 1) * 256
      + get_byte(random_bytes, 2)
    ) % 1000000;
    pass_digits := lpad(pass_number::text, 6, '0');
    candidate_code := substr(pass_digits, 1, 3) || ' ' || substr(pass_digits, 4, 3);

    insert into public.visitor_requests (
      society_id,
      visitor_id,
      flat_id,
      raised_by,
      decision_by,
      status,
      is_pre_approved,
      gate_pass_code,
      decision_at,
      valid_until,
      vehicle_number,
      vehicle_type
    )
    values (
      actor.society_id,
      created_visitor.id,
      actor.flat_id,
      null,
      actor.id,
      'APPROVED',
      true,
      candidate_code,
      pass_created_at,
      pass_created_at + interval '24 hours',
      normalized_vehicle_number,
      normalized_vehicle_type
    )
    on conflict do nothing
    returning * into created_request;

    if created_request.id is not null then
      return created_request;
    end if;
  end loop;

  raise exception using
    errcode = 'P0001',
    message = 'Could not allocate a unique gate-pass code. Please try again.';
end;
$$;

revoke all on function public.create_resident_visitor_preapproval(
  text,
  text,
  public.visitor_category,
  text,
  public.visitor_vehicle_type
) from public, anon;

grant execute on function public.create_resident_visitor_preapproval(
  text,
  text,
  public.visitor_category,
  text,
  public.visitor_vehicle_type
) to authenticated;

create or replace function public.list_society_visitor_logbook(
  requested_limit integer default 26,
  cursor_activity_at timestamptz default null,
  cursor_id uuid default null,
  requested_since timestamptz default null,
  requested_until timestamptz default null,
  requested_status public.visitor_request_status default null,
  requested_category public.visitor_category default null,
  requested_tower_id uuid default null,
  requested_flat_id uuid default null,
  requested_flat_number text default null,
  requested_entry_only boolean default true,
  requested_include_total boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_society_id uuid;
  actor_role public.user_role;
  selected_flat_tower_id uuid;
  normalized_flat_number text;
  result_payload jsonb;
  register_since timestamptz;
  register_until timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  actor_society_id := (select public.current_society_id());
  actor_role := (select public.current_user_role());

  if actor_society_id is null or actor_role is null then
    raise exception using errcode = '42501', message = 'Active society membership is required';
  end if;

  if actor_role not in ('GUARD', 'ADMIN') then
    raise exception using errcode = '42501', message = 'Only guards and admins can view the society visitor logbook';
  end if;

  if requested_limit is null or requested_limit < 1 or requested_limit > 51 then
    raise exception using errcode = '22023', message = 'Logbook page size must be between 1 and 51';
  end if;

  if (cursor_activity_at is null) <> (cursor_id is null) then
    raise exception using errcode = '22023', message = 'Logbook cursor is incomplete';
  end if;

  if requested_since is not null and requested_until is not null and requested_until <= requested_since then
    raise exception using errcode = '22023', message = 'Logbook date range is invalid';
  end if;

  if requested_tower_id is not null and not exists (
    select 1
    from public.towers as tower
    where tower.id = requested_tower_id
      and tower.society_id = actor_society_id
  ) then
    raise exception using errcode = '22023', message = 'Tower filter is not available in this society';
  end if;

  if requested_flat_id is not null then
    select flat.tower_id
    into selected_flat_tower_id
    from public.flats as flat
    where flat.id = requested_flat_id
      and flat.society_id = actor_society_id;

    if selected_flat_tower_id is null then
      raise exception using errcode = '22023', message = 'Flat filter is not available in this society';
    end if;

    if requested_tower_id is not null and selected_flat_tower_id <> requested_tower_id then
      raise exception using errcode = '22023', message = 'Flat filter does not belong to the selected tower';
    end if;
  end if;

  normalized_flat_number := nullif(upper(btrim(requested_flat_number)), '');

  if requested_flat_id is not null and normalized_flat_number is not null then
    raise exception using errcode = '22023', message = 'Choose either a flat id or a flat number filter';
  end if;

  if requested_entry_only then
    if requested_since is not null then
      register_since := date_trunc('month', requested_since at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
    end if;
    if requested_until is not null then
      register_until := (
        date_trunc('month', (requested_until - interval '1 microsecond') at time zone 'Asia/Kolkata')
        + interval '1 month'
      ) at time zone 'Asia/Kolkata';
    end if;
  end if;

  with society_rows as not materialized (
    select
      request.id as request_id,
      request.society_id,
      request.status,
      request.is_pre_approved,
      request.created_at,
      request.decision_at,
      request.entry_at,
      request.exit_at,
      request.vehicle_number,
      request.vehicle_type,
      case when requested_entry_only then request.entry_at else request.created_at end as activity_at,
      case
        when request.entry_at is null then null
        else row_number() over (
          partition by date_trunc('month', request.entry_at at time zone 'Asia/Kolkata')
          order by request.entry_at, request.id
        )
      end as register_number,
      visitor.name as visitor_name,
      visitor.phone as visitor_phone,
      visitor.category as visitor_category,
      flat.id as flat_id,
      flat.number as flat_number,
      tower.id as tower_id,
      tower.code as tower_code,
      tower.name as tower_name
    from public.visitor_requests as request
    join public.visitors as visitor
      on visitor.id = request.visitor_id
      and visitor.society_id = request.society_id
    join public.flats as flat
      on flat.id = request.flat_id
      and flat.society_id = request.society_id
    join public.towers as tower
      on tower.id = flat.tower_id
      and tower.society_id = request.society_id
    where request.society_id = actor_society_id
      and (
        not requested_entry_only
        or (
          request.entry_at is not null
          and (register_since is null or request.entry_at >= register_since)
          and (register_until is null or request.entry_at < register_until)
        )
      )
  ), filtered as not materialized (
    select *
    from society_rows
    where (not requested_entry_only or entry_at is not null)
      and (requested_since is null or activity_at >= requested_since)
      and (requested_until is null or activity_at < requested_until)
      and (requested_status is null or status = requested_status)
      and (requested_category is null or visitor_category = requested_category)
      and (requested_tower_id is null or tower_id = requested_tower_id)
      and (requested_flat_id is null or flat_id = requested_flat_id)
      and (normalized_flat_number is null or flat_number = normalized_flat_number)
      and (
        cursor_activity_at is null
        or (requested_entry_only and (activity_at, request_id) > (cursor_activity_at, cursor_id))
        or (not requested_entry_only and (activity_at, request_id) < (cursor_activity_at, cursor_id))
      )
  ), page_items as (
    select *
    from filtered
    order by
      case when requested_entry_only then activity_at end asc,
      case when requested_entry_only then request_id end asc,
      case when not requested_entry_only then activity_at end desc,
      case when not requested_entry_only then request_id end desc
    limit requested_limit
  )
  select jsonb_build_object(
    'total_count',
      case when requested_include_total then (select count(*) from filtered) else null end,
    'items',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(page_items)
            order by
              case when requested_entry_only then page_items.activity_at end asc,
              case when requested_entry_only then page_items.request_id end asc,
              case when not requested_entry_only then page_items.activity_at end desc,
              case when not requested_entry_only then page_items.request_id end desc
          )
          from page_items
        ),
        '[]'::jsonb
      )
  )
  into result_payload;

  return result_payload;
end;
$$;

revoke all on function public.list_society_visitor_logbook(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  uuid,
  uuid,
  text,
  boolean,
  boolean
) from public, anon;

grant execute on function public.list_society_visitor_logbook(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  uuid,
  uuid,
  text,
  boolean,
  boolean
) to authenticated;

drop function public.list_admin_visitor_history(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  uuid,
  text
);

create function public.list_admin_visitor_history(
  requested_limit integer default 25,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null,
  requested_since timestamptz default null,
  requested_status public.visitor_request_status default null,
  requested_category public.visitor_category default null,
  requested_tower_id uuid default null,
  requested_flat_number text default null
)
returns table (
  request_id uuid,
  society_id uuid,
  status public.visitor_request_status,
  is_pre_approved boolean,
  created_at timestamptz,
  decision_at timestamptz,
  entry_at timestamptz,
  exit_at timestamptz,
  vehicle_number text,
  vehicle_type public.visitor_vehicle_type,
  visitor_name text,
  visitor_category public.visitor_category,
  flat_id uuid,
  flat_number text,
  tower_id uuid,
  tower_code text,
  tower_name text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if (select public.current_user_role()) is distinct from 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only admins can view admin visitor history';
  end if;

  if requested_limit is null or requested_limit < 1 or requested_limit > 50 then
    raise exception using errcode = '22023', message = 'History page size must be between 1 and 50';
  end if;

  if (cursor_created_at is null) <> (cursor_id is null) then
    raise exception using errcode = '22023', message = 'History cursor is incomplete';
  end if;

  payload := public.list_society_visitor_logbook(
    requested_limit,
    cursor_created_at,
    cursor_id,
    requested_since,
    null,
    requested_status,
    requested_category,
    requested_tower_id,
    null,
    requested_flat_number,
    false,
    false
  );

  return query
  select
    item.request_id,
    item.society_id,
    item.status,
    item.is_pre_approved,
    item.created_at,
    item.decision_at,
    item.entry_at,
    item.exit_at,
    item.vehicle_number,
    item.vehicle_type,
    item.visitor_name,
    item.visitor_category,
    item.flat_id,
    item.flat_number,
    item.tower_id,
    item.tower_code,
    item.tower_name
  from jsonb_to_recordset(payload -> 'items') as item (
    request_id uuid,
    society_id uuid,
    status public.visitor_request_status,
    is_pre_approved boolean,
    created_at timestamptz,
    decision_at timestamptz,
    entry_at timestamptz,
    exit_at timestamptz,
    vehicle_number text,
    vehicle_type public.visitor_vehicle_type,
    activity_at timestamptz,
    register_number bigint,
    visitor_name text,
    visitor_phone text,
    visitor_category public.visitor_category,
    flat_id uuid,
    flat_number text,
    tower_id uuid,
    tower_code text,
    tower_name text
  );
end;
$$;

revoke all on function public.list_admin_visitor_history(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  uuid,
  text
) from public, anon;

grant execute on function public.list_admin_visitor_history(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  uuid,
  text
) to authenticated;

-- Visitor creation is a single backend-authorized transaction. The client
-- supplies business input only; role, society, resident flat, and actor IDs
-- are always derived or validated against the authenticated profile.

drop policy if exists visitors_write on public.visitors;
drop policy if exists visitor_requests_guard_insert on public.visitor_requests;

revoke insert, update, delete on public.visitors from authenticated;
revoke insert, update, delete on public.visitor_requests from authenticated;

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
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only guards can search residents';
  end if;
  if char_length(normalized_search) > 80 then
    raise exception using errcode = '22023', message = 'Resident search is too long';
  end if;

  return query
  select resident.id, resident.society_id, resident.full_name, flat.id, flat.number, tower.id, tower.code
  from public.profiles as resident
  join public.flats as flat on flat.id = resident.flat_id and flat.society_id = resident.society_id
  join public.towers as tower on tower.id = flat.tower_id and tower.society_id = resident.society_id
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

create or replace function public.create_guard_visitor_request(
  requested_flat_id uuid,
  requested_name text,
  requested_phone text,
  requested_category public.visitor_category
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
begin
  select * into actor from public.profiles
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

  select * into target_flat from public.flats
  where flats.id = requested_flat_id and flats.society_id = actor.society_id;

  if target_flat.id is null or not exists (
    select 1 from public.profiles as resident
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

  insert into public.visitor_requests (society_id, visitor_id, flat_id, raised_by, status)
  values (actor.society_id, created_visitor.id, target_flat.id, actor.id, 'PENDING')
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.create_resident_visitor_preapproval(
  requested_name text,
  requested_phone text,
  requested_category public.visitor_category
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
  random_bytes bytea;
  pass_number integer;
  pass_digits text;
begin
  select * into actor from public.profiles
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can pre-approve visitors';
  end if;
  if not exists (
    select 1 from public.flats
    where flats.id = actor.flat_id and flats.society_id = actor.society_id
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

  insert into public.visitors (society_id, name, phone, category)
  values (actor.society_id, normalized_name, normalized_phone, requested_category)
  returning * into created_visitor;

  random_bytes := extensions.gen_random_bytes(3);
  pass_number := (
    get_byte(random_bytes, 0) * 65536
    + get_byte(random_bytes, 1) * 256
    + get_byte(random_bytes, 2)
  ) % 1000000;
  pass_digits := lpad(pass_number::text, 6, '0');

  insert into public.visitor_requests (
    society_id, visitor_id, flat_id, raised_by, decision_by, status,
    is_pre_approved, gate_pass_code, decision_at
  ) values (
    actor.society_id, created_visitor.id, actor.flat_id, null, actor.id, 'APPROVED',
    true, substr(pass_digits, 1, 3) || ' ' || substr(pass_digits, 4, 3), statement_timestamp()
  ) returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.search_guard_residents(text) from public, anon;
revoke all on function public.create_guard_visitor_request(uuid, text, text, public.visitor_category) from public, anon;
revoke all on function public.create_resident_visitor_preapproval(text, text, public.visitor_category) from public, anon;

grant execute on function public.search_guard_residents(text) to authenticated;
grant execute on function public.create_guard_visitor_request(uuid, text, text, public.visitor_category) to authenticated;
grant execute on function public.create_resident_visitor_preapproval(text, text, public.visitor_category) to authenticated;

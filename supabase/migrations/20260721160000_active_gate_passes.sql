-- Recoverable, time-limited and collision-safe resident gate passes.

alter table public.visitor_requests
  add column if not exists valid_until timestamptz;

update public.visitor_requests
set valid_until = created_at + interval '24 hours'
where is_pre_approved and valid_until is null;

update public.visitor_requests
set status = 'EXPIRED'
where is_pre_approved
  and status = 'APPROVED'
  and entry_at is null
  and valid_until <= statement_timestamp();

alter table public.visitor_requests
  drop constraint if exists visitor_requests_preapproval_valid_until_check;
alter table public.visitor_requests
  add constraint visitor_requests_preapproval_valid_until_check
  check (not is_pre_approved or valid_until is not null);

-- Repair the extremely unlikely case where legacy active passes already share
-- a code before enforcing active-code uniqueness.
do $$
declare
  duplicate_request record;
  random_bytes bytea;
  pass_number integer;
  pass_digits text;
  candidate_code text;
  reassigned boolean;
begin
  for duplicate_request in
    select ranked.id, ranked.society_id
    from (
      select
        visitor_requests.id,
        visitor_requests.society_id,
        row_number() over (
          partition by visitor_requests.society_id, visitor_requests.gate_pass_code
          order by visitor_requests.created_at, visitor_requests.id
        ) as duplicate_position
      from public.visitor_requests
      where visitor_requests.is_pre_approved
        and visitor_requests.status = 'APPROVED'
        and visitor_requests.entry_at is null
        and visitor_requests.valid_until > statement_timestamp()
        and visitor_requests.gate_pass_code is not null
    ) ranked
    where ranked.duplicate_position > 1
  loop
    reassigned := false;

    for code_attempt in 1..20 loop
      random_bytes := extensions.gen_random_bytes(3);
      pass_number := (
        get_byte(random_bytes, 0) * 65536
        + get_byte(random_bytes, 1) * 256
        + get_byte(random_bytes, 2)
      ) % 1000000;
      pass_digits := lpad(pass_number::text, 6, '0');
      candidate_code := substr(pass_digits, 1, 3) || ' ' || substr(pass_digits, 4, 3);

      if not exists (
        select 1
        from public.visitor_requests
        where visitor_requests.society_id = duplicate_request.society_id
          and visitor_requests.gate_pass_code = candidate_code
          and visitor_requests.is_pre_approved
          and visitor_requests.status = 'APPROVED'
          and visitor_requests.entry_at is null
      ) then
        update public.visitor_requests
        set gate_pass_code = candidate_code
        where id = duplicate_request.id;

        reassigned := true;
        exit;
      end if;
    end loop;

    if not reassigned then
      raise exception using
        errcode = 'P0001',
        message = 'Could not repair duplicate active gate-pass codes';
    end if;
  end loop;
end;
$$;

create unique index if not exists visitor_requests_active_gate_pass_code_uidx
on public.visitor_requests (society_id, gate_pass_code)
where is_pre_approved
  and gate_pass_code is not null
  and status = 'APPROVED'
  and entry_at is null;

drop index if exists public.visitor_requests_active_gate_pass_idx;
create index visitor_requests_active_gate_pass_idx
on public.visitor_requests (flat_id, valid_until)
where is_pre_approved and status = 'APPROVED' and entry_at is null;

create index if not exists visitor_requests_expiry_cleanup_idx
on public.visitor_requests (society_id, valid_until)
where is_pre_approved and status = 'APPROVED' and entry_at is null;

create index if not exists visitor_requests_gate_pass_history_idx
on public.visitor_requests (society_id, gate_pass_code, created_at desc)
where is_pre_approved and gate_pass_code is not null;

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

  -- Indexed, society-local cleanup keeps expired codes reusable without a
  -- background job or an extra client request.
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
      society_id, visitor_id, flat_id, raised_by, decision_by, status,
      is_pre_approved, gate_pass_code, decision_at, valid_until
    ) values (
      actor.society_id, created_visitor.id, actor.flat_id, null, actor.id, 'APPROVED',
      true, candidate_code, pass_created_at, pass_created_at + interval '24 hours'
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

create or replace function public.revoke_resident_visitor_preapproval(request_id uuid)
returns public.visitor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  request public.visitor_requests%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only assigned residents can revoke gate passes';
  end if;

  select * into request
  from public.visitor_requests
  where id = request_id
  for update;

  if request.id is null
    or request.society_id <> actor.society_id
    or request.flat_id <> actor.flat_id
    or not request.is_pre_approved
  then
    raise exception using errcode = '42501', message = 'Gate pass is not available to this resident';
  end if;

  if request.valid_until <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Gate pass has expired';
  end if;
  if request.status <> 'APPROVED' or request.entry_at is not null then
    raise exception using errcode = '22023', message = 'Only an active gate pass can be revoked';
  end if;

  update public.visitor_requests
  set status = 'CANCELLED'
  where id = request.id
  returning * into request;

  return request;
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
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only active guards can verify gate passes';
  end if;

  if normalized_code !~ '^[0-9]{3} ?[0-9]{3}$' then
    raise exception using errcode = '22023', message = 'Enter a valid six-digit gate-pass code';
  end if;

  pass_digits := replace(normalized_code, ' ', '');
  formatted_code := substr(pass_digits, 1, 3) || ' ' || substr(pass_digits, 4, 3);

  -- Keep the matched historical row truthful while using the same indexed,
  -- single-RPC verification request.
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

    -- Return inactive state instead of raising so an EXPIRED update made by
    -- this statement can commit. The client maps the authoritative status to
    -- a truthful message and never opens the entry action.
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
  join public.visitors on visitors.id = visitor_requests.visitor_id
    and visitors.society_id = actor.society_id
  join public.flats on flats.id = visitor_requests.flat_id
    and flats.society_id = actor.society_id
  left join public.towers on towers.id = flats.tower_id
    and towers.society_id = actor.society_id
  where visitor_requests.id = matched_request.id;
end;
$$;

create or replace function public.mark_visitor_entry(request_id uuid)
returns public.visitor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  request public.visitor_requests%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where profiles.id = (select auth.uid()) and profiles.is_active;

  if actor.id is null or actor.role <> 'GUARD' then
    raise exception using errcode = '42501', message = 'Only guards can mark visitor entry';
  end if;

  select * into request
  from public.visitor_requests
  where id = request_id
  for update;

  if request.id is null or request.society_id <> actor.society_id then
    raise exception using errcode = '42501', message = 'Visitor request is not available to this guard';
  end if;
  if request.status <> 'APPROVED' or request.entry_at is not null then
    raise exception using errcode = '22023', message = 'Only an approved visitor can enter';
  end if;
  if request.is_pre_approved and request.valid_until <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Gate pass has expired';
  end if;

  update public.visitor_requests
  set status = 'ENTERED', entry_at = statement_timestamp()
  where id = request.id
  returning * into request;

  return request;
end;
$$;

revoke all on function public.create_resident_visitor_preapproval(text, text, public.visitor_category) from public, anon;
revoke all on function public.revoke_resident_visitor_preapproval(uuid) from public, anon;
revoke all on function public.lookup_guard_gate_pass(text) from public, anon;
revoke all on function public.mark_visitor_entry(uuid) from public, anon;

grant execute on function public.create_resident_visitor_preapproval(text, text, public.visitor_category) to authenticated;
grant execute on function public.revoke_resident_visitor_preapproval(uuid) to authenticated;
grant execute on function public.lookup_guard_gate_pass(text) to authenticated;
grant execute on function public.mark_visitor_entry(uuid) to authenticated;

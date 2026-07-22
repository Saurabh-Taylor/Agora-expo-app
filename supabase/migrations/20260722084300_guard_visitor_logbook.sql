-- A visitor request is the canonical digital-register row. This RPC adds a
-- read-only, server-filtered logbook without duplicating visitor data.

create index if not exists visitor_requests_society_entry_cursor_idx
on public.visitor_requests (society_id, entry_at desc, id desc)
where entry_at is not null;

create index if not exists visitor_requests_society_flat_entry_cursor_idx
on public.visitor_requests (society_id, flat_id, entry_at desc, id desc)
where entry_at is not null;

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

  with filtered as not materialized (
    select
      request.id as request_id,
      request.society_id,
      request.status,
      request.is_pre_approved,
      request.created_at,
      request.decision_at,
      request.entry_at,
      request.exit_at,
      case when requested_entry_only then request.entry_at else request.created_at end as activity_at,
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
      and (not requested_entry_only or request.entry_at is not null)
      and (requested_since is null or (case when requested_entry_only then request.entry_at else request.created_at end) >= requested_since)
      and (requested_until is null or (case when requested_entry_only then request.entry_at else request.created_at end) < requested_until)
      and (requested_status is null or request.status = requested_status)
      and (requested_category is null or visitor.category = requested_category)
      and (requested_tower_id is null or tower.id = requested_tower_id)
      and (requested_flat_id is null or flat.id = requested_flat_id)
      and (normalized_flat_number is null or flat.number = normalized_flat_number)
      and (
        cursor_activity_at is null
        or (
          case when requested_entry_only then request.entry_at else request.created_at end,
          request.id
        ) < (cursor_activity_at, cursor_id)
      )
  ), page_items as (
    select *
    from filtered
    order by activity_at desc, request_id desc
    limit requested_limit
  )
  select jsonb_build_object(
    'total_count',
      case when requested_include_total then (select count(*) from filtered) else null end,
    'items',
      coalesce(
        (
          select jsonb_agg(to_jsonb(page_items) order by page_items.activity_at desc, page_items.request_id desc)
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

-- Keep the existing admin RPC signature working for older app builds, but
-- delegate its query to the shared logbook implementation.
create or replace function public.list_admin_visitor_history(
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
    activity_at timestamptz,
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

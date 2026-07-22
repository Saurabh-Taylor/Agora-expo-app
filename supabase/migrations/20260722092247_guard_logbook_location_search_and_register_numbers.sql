-- Guard Logbook improvements: bounded location lookup plus stable monthly
-- register numbers. Visitor requests remain the canonical records.

create or replace function public.search_guard_logbook_locations(
  requested_search text,
  requested_limit integer default 20
)
returns table (
  result_type text,
  society_id uuid,
  tower_id uuid,
  tower_code text,
  tower_name text,
  flat_id uuid,
  flat_number text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_society_id uuid;
  actor_role public.user_role;
  normalized_search text := upper(btrim(coalesce(requested_search, '')));
  compact_search text;
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
    raise exception using errcode = '42501', message = 'Only guards and admins can search logbook locations';
  end if;

  if requested_limit is null or requested_limit < 1 or requested_limit > 20 then
    raise exception using errcode = '22023', message = 'Location result limit must be between 1 and 20';
  end if;

  if normalized_search = '' or length(normalized_search) > 40 then
    raise exception using errcode = '22023', message = 'Location search must contain between 1 and 40 characters';
  end if;

  normalized_search := regexp_replace(normalized_search, '^(TOWER|FLAT)[[:space:]-]+', '');
  compact_search := regexp_replace(normalized_search, '[^A-Z0-9]', '', 'g');

  return query
  with matches as (
    select
      'TOWER'::text as result_type,
      tower.society_id,
      tower.id as tower_id,
      tower.code as tower_code,
      tower.name as tower_name,
      null::uuid as flat_id,
      null::text as flat_number,
      case
        when upper(tower.code) = normalized_search then 0
        when upper(tower.code) like normalized_search || '%' then 1
        else 3
      end as match_rank,
      upper(tower.code) as sort_code,
      ''::text as sort_flat
    from public.towers as tower
    where tower.society_id = actor_society_id
      and (
        upper(tower.code) like normalized_search || '%'
        or upper(tower.name) like normalized_search || '%'
      )

    union all

    select
      'FLAT'::text,
      flat.society_id,
      tower.id,
      tower.code,
      tower.name,
      flat.id,
      flat.number,
      case
        when upper(tower.code || flat.number) = compact_search then 0
        when upper(flat.number) = normalized_search then 1
        when upper(tower.code || flat.number) like compact_search || '%' then 2
        else 3
      end,
      upper(tower.code),
      upper(flat.number)
    from public.flats as flat
    join public.towers as tower
      on tower.id = flat.tower_id
      and tower.society_id = flat.society_id
    where flat.society_id = actor_society_id
      and (
        upper(flat.number) like normalized_search || '%'
        or upper(tower.code || flat.number) like compact_search || '%'
        or upper(tower.name || flat.number) like compact_search || '%'
      )
  )
  select
    matches.result_type,
    matches.society_id,
    matches.tower_id,
    matches.tower_code,
    matches.tower_name,
    matches.flat_id,
    matches.flat_number
  from matches
  order by matches.match_rank, matches.sort_code, matches.sort_flat, matches.result_type
  limit requested_limit;
end;
$$;

revoke all on function public.search_guard_logbook_locations(text, integer) from public, anon;
grant execute on function public.search_guard_logbook_locations(text, integer) to authenticated;

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

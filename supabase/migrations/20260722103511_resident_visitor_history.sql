-- Resident visitor history is a flat-scoped read model. Ownership is derived
-- from the authenticated active profile; callers cannot supply society or flat ids.

create or replace function public.list_resident_visitor_history(
  requested_limit integer default 26,
  cursor_entry_at timestamptz default null,
  cursor_id uuid default null,
  requested_since timestamptz default null,
  requested_until timestamptz default null,
  requested_status public.visitor_request_status default null,
  requested_category public.visitor_category default null,
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
  actor_flat_id uuid;
  actor_role public.user_role;
  result_payload jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  actor_society_id := (select public.current_society_id());
  actor_flat_id := (select public.current_flat_id());
  actor_role := (select public.current_user_role());

  if actor_society_id is null or actor_flat_id is null or actor_role is null then
    raise exception using errcode = '42501', message = 'Active resident flat assignment is required';
  end if;

  if actor_role <> 'RESIDENT' then
    raise exception using errcode = '42501', message = 'Only residents can view resident visitor history';
  end if;

  if requested_limit is null or requested_limit < 1 or requested_limit > 51 then
    raise exception using errcode = '22023', message = 'Resident history page size must be between 1 and 51';
  end if;

  if (cursor_entry_at is null) <> (cursor_id is null) then
    raise exception using errcode = '22023', message = 'Resident history cursor is incomplete';
  end if;

  if requested_since is not null and requested_until is not null and requested_until <= requested_since then
    raise exception using errcode = '22023', message = 'Resident history date range is invalid';
  end if;

  if requested_status is not null and requested_status not in ('ENTERED', 'EXITED') then
    raise exception using errcode = '22023', message = 'Resident history status must be Inside or Exited';
  end if;

  with filtered as not materialized (
    select
      request.id as request_id,
      request.society_id,
      request.flat_id,
      request.status,
      request.is_pre_approved,
      request.created_at,
      request.decision_at,
      request.entry_at,
      request.exit_at,
      request.entry_at as activity_at,
      request.vehicle_number,
      request.vehicle_type,
      visitor.name as visitor_name,
      visitor.phone as visitor_phone,
      visitor.category as visitor_category
    from public.visitor_requests as request
    join public.visitors as visitor
      on visitor.id = request.visitor_id
      and visitor.society_id = request.society_id
    where request.society_id = actor_society_id
      and request.flat_id = actor_flat_id
      and request.entry_at is not null
      and (requested_since is null or request.entry_at >= requested_since)
      and (requested_until is null or request.entry_at < requested_until)
      and (requested_status is null or request.status = requested_status)
      and (requested_category is null or visitor.category = requested_category)
  ), page_items as (
    select *
    from filtered
    where cursor_entry_at is null
      or (entry_at, request_id) < (cursor_entry_at, cursor_id)
    order by entry_at desc, request_id desc
    limit requested_limit
  )
  select jsonb_build_object(
    'total_count',
      case when requested_include_total then (select count(*) from filtered) else null end,
    'items',
      coalesce(
        (
          select jsonb_agg(to_jsonb(page_items) order by page_items.entry_at desc, page_items.request_id desc)
          from page_items
        ),
        '[]'::jsonb
      )
  )
  into result_payload;

  return result_payload;
end;
$$;

revoke all on function public.list_resident_visitor_history(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  boolean
) from public, anon, authenticated;

grant execute on function public.list_resident_visitor_history(
  integer,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  public.visitor_request_status,
  public.visitor_category,
  boolean
) to authenticated;

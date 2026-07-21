-- Society admins may inspect visitor history for audit purposes, but visitor
-- decisions and gate movement remain resident/guard-only operations.

alter policy visitor_requests_select on public.visitor_requests
to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) in ('GUARD', 'ADMIN')
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and flat_id = (select public.current_flat_id())
    )
  )
);

create index if not exists visitor_requests_society_created_cursor_idx
on public.visitor_requests (society_id, created_at desc, id desc);

drop index if exists public.visitor_requests_society_idx;

create index if not exists visitor_requests_society_status_created_cursor_idx
on public.visitor_requests (society_id, status, created_at desc, id desc);

create index if not exists visitor_requests_society_flat_created_cursor_idx
on public.visitor_requests (society_id, flat_id, created_at desc, id desc);

create index if not exists visitors_society_category_id_idx
on public.visitors (society_id, category, id);

create index if not exists flats_society_tower_id_idx
on public.flats (society_id, tower_id, id);

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
  actor_society_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if (select public.current_user_role()) is distinct from 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only admins can view admin visitor history';
  end if;

  actor_society_id := (select public.current_society_id());
  if actor_society_id is null then
    raise exception using errcode = '42501', message = 'Active society membership is required';
  end if;

  if requested_limit is null or requested_limit < 1 or requested_limit > 50 then
    raise exception using errcode = '22023', message = 'History page size must be between 1 and 50';
  end if;

  if (cursor_created_at is null) <> (cursor_id is null) then
    raise exception using errcode = '22023', message = 'History cursor is incomplete';
  end if;

  return query
  select
    request.id,
    request.society_id,
    request.status,
    request.is_pre_approved,
    request.created_at,
    request.decision_at,
    request.entry_at,
    request.exit_at,
    visitor.name,
    visitor.category,
    flat.id,
    flat.number,
    tower.id,
    tower.code,
    tower.name
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
    and (requested_since is null or request.created_at >= requested_since)
    and (requested_status is null or request.status = requested_status)
    and (requested_category is null or visitor.category = requested_category)
    and (requested_tower_id is null or tower.id = requested_tower_id)
    and (nullif(btrim(requested_flat_number), '') is null or flat.number = upper(btrim(requested_flat_number)))
    and (
      cursor_created_at is null
      or (request.created_at, request.id) < (cursor_created_at, cursor_id)
    )
  order by request.created_at desc, request.id desc
  limit requested_limit;
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

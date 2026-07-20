alter table public.complaints
add column updated_at timestamptz not null default now(),
add column resolved_at timestamptz;

update public.complaints
set resolved_at = created_at
where status = 'RESOLVED' and resolved_at is null;

create index complaints_open_society_created_idx
on public.complaints (society_id, created_at desc)
where status <> 'RESOLVED';

insert into public.complaint_events (complaint_id, society_id, status, note, created_by, created_at)
select complaint_row.id, complaint_row.society_id, 'OPEN', 'Complaint raised', complaint_row.raised_by, complaint_row.created_at
from public.complaints complaint_row
where not exists (
  select 1 from public.complaint_events event_row
  where event_row.complaint_id = complaint_row.id
    and event_row.society_id = complaint_row.society_id
);

drop policy if exists complaints_select on public.complaints;
drop policy if exists complaints_resident_insert on public.complaints;
drop policy if exists complaints_admin_update on public.complaints;
create policy complaints_select on public.complaints
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and raised_by = (select auth.uid())
    )
  )
);

drop policy if exists complaint_events_select on public.complaint_events;
drop policy if exists complaint_events_admin_insert on public.complaint_events;
create policy complaint_events_select on public.complaint_events
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and exists (
        select 1
        from public.complaints complaint_row
        where complaint_row.id = complaint_id
          and complaint_row.society_id = complaint_events.society_id
          and complaint_row.raised_by = (select auth.uid())
      )
    )
  )
);

create or replace function public.create_resident_complaint(
  requested_title text,
  requested_description text,
  requested_category text
)
returns public.complaints language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.complaints%rowtype;
  clean_category text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can raise complaints';
  end if;
  if char_length(btrim(coalesce(requested_title, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Complaint title must be at least 2 characters';
  end if;
  if char_length(btrim(coalesce(requested_description, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Complaint description must be at least 2 characters';
  end if;
  clean_category := initcap(btrim(coalesce(requested_category, '')));
  if clean_category not in ('Plumbing', 'Electrical', 'Cleanliness', 'Security', 'Noise', 'Other') then
    raise exception using errcode = '22023', message = 'Complaint category is invalid';
  end if;

  insert into public.complaints (
    society_id, flat_id, raised_by, title, description, category, priority, status
  )
  values (
    actor.society_id,
    actor.flat_id,
    actor.id,
    btrim(requested_title),
    btrim(requested_description),
    clean_category,
    'MEDIUM',
    'OPEN'
  )
  returning * into result;

  insert into public.complaint_events (complaint_id, society_id, status, note, created_by, created_at)
  values (result.id, actor.society_id, 'OPEN', 'Complaint raised', actor.id, statement_timestamp());

  return result;
end;
$$;

create or replace function public.update_admin_complaint(
  target_complaint_id uuid,
  requested_priority public.complaint_priority,
  requested_status public.complaint_status,
  requested_note text
)
returns public.complaints language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.complaints%rowtype;
  clean_note text;
  timeline_note text;
  status_changed boolean;
  priority_changed boolean;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can update complaints';
  end if;

  select * into target from public.complaints
  where id = target_complaint_id and society_id = actor.society_id
  for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Complaint is not available to this admin';
  end if;

  status_changed := requested_status <> target.status;
  priority_changed := requested_priority <> target.priority;
  clean_note := nullif(btrim(coalesce(requested_note, '')), '');

  if status_changed and not (
    (target.status = 'OPEN' and requested_status in ('IN_PROGRESS', 'RESOLVED'))
    or (target.status = 'IN_PROGRESS' and requested_status = 'RESOLVED')
  ) then
    raise exception using errcode = '22023', message = 'Complaint status cannot move backwards';
  end if;
  if not status_changed and not priority_changed and clean_note is null then
    raise exception using errcode = '22023', message = 'No complaint changes were provided';
  end if;

  timeline_note := clean_note;
  if timeline_note is null and priority_changed then
    timeline_note := 'Priority changed to ' || initcap(requested_priority::text);
  end if;

  update public.complaints
  set
    priority = requested_priority,
    status = requested_status,
    updated_at = statement_timestamp(),
    resolved_at = case when requested_status = 'RESOLVED' then coalesce(resolved_at, statement_timestamp()) else resolved_at end
  where id = target.id
  returning * into target;

  insert into public.complaint_events (complaint_id, society_id, status, note, created_by, created_at)
  values (target.id, actor.society_id, target.status, timeline_note, actor.id, statement_timestamp());

  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    case
      when status_changed then 'Updated complaint status to ' || target.status::text || ': ' || target.title
      else 'Updated complaint priority: ' || target.title
    end
  );

  return target;
end;
$$;

revoke all on function public.create_resident_complaint(text, text, text) from public, anon;
revoke all on function public.update_admin_complaint(uuid, public.complaint_priority, public.complaint_status, text) from public, anon;
grant execute on function public.create_resident_complaint(text, text, text) to authenticated;
grant execute on function public.update_admin_complaint(uuid, public.complaint_priority, public.complaint_status, text) to authenticated;

revoke insert, update, delete on public.complaints, public.complaint_events from authenticated;
grant select on public.complaints, public.complaint_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'complaints'
  ) then
    alter publication supabase_realtime add table public.complaints;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'complaint_events'
  ) then
    alter publication supabase_realtime add table public.complaint_events;
  end if;
end;
$$;

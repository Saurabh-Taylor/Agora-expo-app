alter table public.staff add constraint staff_id_society_unique unique (id, society_id);

create table public.operational_tasks (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  title text not null,
  description text,
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  due_at timestamptz not null,
  assigned_staff_id uuid,
  assigned_guard_id uuid,
  created_by uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_tasks_title_not_blank check (char_length(btrim(title)) >= 2),
  constraint operational_tasks_id_society_unique unique (id, society_id),
  constraint operational_tasks_exactly_one_assignee check (
    (assigned_staff_id is not null and assigned_guard_id is null)
    or (assigned_staff_id is null and assigned_guard_id is not null)
  ),
  constraint operational_tasks_completion_matches_status check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  ),
  constraint operational_tasks_staff_same_society_fkey foreign key (assigned_staff_id, society_id)
    references public.staff(id, society_id),
  constraint operational_tasks_guard_same_society_fkey foreign key (assigned_guard_id, society_id)
    references public.profiles(id, society_id),
  constraint operational_tasks_creator_same_society_fkey foreign key (created_by, society_id)
    references public.profiles(id, society_id)
);

create table public.operational_task_comments (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  task_id uuid not null,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint operational_task_comments_body_not_blank check (char_length(btrim(body)) >= 1),
  constraint operational_task_comments_task_same_society_fkey foreign key (task_id, society_id)
    references public.operational_tasks(id, society_id) on delete cascade,
  constraint operational_task_comments_author_same_society_fkey foreign key (author_id, society_id)
    references public.profiles(id, society_id)
);

create index operational_tasks_society_status_due_idx
  on public.operational_tasks (society_id, status, due_at);
create index operational_tasks_guard_active_idx
  on public.operational_tasks (assigned_guard_id, due_at)
  where status in ('PENDING', 'IN_PROGRESS');
create index operational_tasks_staff_active_idx
  on public.operational_tasks (assigned_staff_id, due_at)
  where status in ('PENDING', 'IN_PROGRESS');
create index operational_task_comments_task_created_idx
  on public.operational_task_comments (task_id, created_at);

alter table public.operational_tasks enable row level security;
alter table public.operational_task_comments enable row level security;

create policy operational_tasks_authorized_select on public.operational_tasks
for select to authenticated
using (
  society_id = public.current_society_id()
  and (
    public.current_user_role() = 'ADMIN'
    or (
      public.current_user_role() = 'GUARD'
      and assigned_guard_id = auth.uid()
    )
  )
);

create policy operational_task_comments_authorized_select on public.operational_task_comments
for select to authenticated
using (
  society_id = public.current_society_id()
  and exists (
    select 1 from public.operational_tasks task
    where task.id = task_id
      and task.society_id = public.current_society_id()
      and (
        public.current_user_role() = 'ADMIN'
        or (
          public.current_user_role() = 'GUARD'
          and task.assigned_guard_id = auth.uid()
        )
      )
  )
);

create or replace function public.create_admin_operational_task(
  requested_title text,
  requested_description text,
  requested_priority text,
  requested_due_at timestamptz,
  requested_staff_id uuid,
  requested_guard_id uuid
)
returns public.operational_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  assignee_guard public.profiles;
  assignee_staff public.staff;
  created_task public.operational_tasks;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can create tasks';
  end if;
  if char_length(btrim(coalesce(requested_title, ''))) < 2
    or requested_priority not in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    or requested_due_at is null
    or ((requested_staff_id is null) = (requested_guard_id is null))
  then
    raise exception using errcode = '22023', message = 'Enter a valid task and exactly one assignee';
  end if;
  if requested_staff_id is not null then
    select * into assignee_staff from public.staff
    where id = requested_staff_id and society_id = actor.society_id and status = 'ON_DUTY';
    if assignee_staff.id is null then
      raise exception using errcode = '42501', message = 'Active staff assignee is not available in your society';
    end if;
  else
    select * into assignee_guard from public.profiles
    where id = requested_guard_id and society_id = actor.society_id
      and role = 'GUARD' and is_active;
    if assignee_guard.id is null then
      raise exception using errcode = '42501', message = 'Active guard assignee is not available in your society';
    end if;
  end if;

  insert into public.operational_tasks (
    society_id, title, description, priority, due_at,
    assigned_staff_id, assigned_guard_id, created_by
  ) values (
    actor.society_id, btrim(requested_title), nullif(btrim(requested_description), ''),
    requested_priority, requested_due_at, requested_staff_id, requested_guard_id, actor.id
  ) returning * into created_task;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'OPERATIONAL_TASK_CREATED',
    jsonb_build_object('task_id', created_task.id, 'title', created_task.title)
  );
  return created_task;
end;
$$;

create or replace function public.update_admin_operational_task(
  target_task_id uuid,
  requested_title text,
  requested_description text,
  requested_priority text,
  requested_due_at timestamptz,
  requested_staff_id uuid,
  requested_guard_id uuid
)
returns public.operational_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  assignee_guard public.profiles;
  assignee_staff public.staff;
  updated_task public.operational_tasks;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can update tasks';
  end if;
  if char_length(btrim(coalesce(requested_title, ''))) < 2
    or requested_priority not in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    or requested_due_at is null
    or ((requested_staff_id is null) = (requested_guard_id is null))
  then
    raise exception using errcode = '22023', message = 'Enter a valid task and exactly one assignee';
  end if;
  if requested_staff_id is not null then
    select * into assignee_staff from public.staff
    where id = requested_staff_id and society_id = actor.society_id and status = 'ON_DUTY';
    if assignee_staff.id is null then raise exception using errcode = '42501', message = 'Active staff assignee is not available in your society'; end if;
  else
    select * into assignee_guard from public.profiles
    where id = requested_guard_id and society_id = actor.society_id and role = 'GUARD' and is_active;
    if assignee_guard.id is null then raise exception using errcode = '42501', message = 'Active guard assignee is not available in your society'; end if;
  end if;

  update public.operational_tasks
  set title = btrim(requested_title), description = nullif(btrim(requested_description), ''),
      priority = requested_priority, due_at = requested_due_at,
      assigned_staff_id = requested_staff_id, assigned_guard_id = requested_guard_id,
      updated_at = now()
  where id = target_task_id and society_id = actor.society_id
    and status not in ('COMPLETED', 'CANCELLED')
  returning * into updated_task;
  if updated_task.id is null then
    raise exception using errcode = 'P0002', message = 'Editable operational task not found';
  end if;
  return updated_task;
end;
$$;

create or replace function public.set_operational_task_status(
  target_task_id uuid,
  requested_status text,
  requested_note text default null
)
returns public.operational_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  target public.operational_tasks;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  select * into target from public.operational_tasks
  where id = target_task_id and society_id = actor.society_id for update;
  if actor.id is null or target.id is null
    or not (
      actor.role = 'ADMIN'
      or (actor.role = 'GUARD' and target.assigned_guard_id = actor.id)
    )
  then raise exception using errcode = '42501', message = 'This task is not available to you'; end if;
  if requested_status not in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    or requested_status = target.status
  then raise exception using errcode = '22023', message = 'Choose a different valid task status'; end if;
  if actor.role = 'GUARD' and (
    requested_status not in ('IN_PROGRESS', 'COMPLETED')
    or target.status not in ('PENDING', 'IN_PROGRESS')
  ) then raise exception using errcode = '42501', message = 'Guards can only start or complete assigned active tasks'; end if;

  update public.operational_tasks
  set status = requested_status,
      completed_at = case when requested_status = 'COMPLETED' then now() else null end,
      updated_at = now()
  where id = target.id returning * into target;

  if nullif(btrim(coalesce(requested_note, '')), '') is not null then
    insert into public.operational_task_comments (society_id, task_id, author_id, body)
    values (actor.society_id, target.id, actor.id, btrim(requested_note));
  end if;
  return target;
end;
$$;

create or replace function public.add_operational_task_comment(
  target_task_id uuid,
  requested_body text
)
returns public.operational_task_comments
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  target public.operational_tasks;
  created_comment public.operational_task_comments;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  select * into target from public.operational_tasks
  where id = target_task_id and society_id = actor.society_id;
  if actor.id is null or target.id is null
    or not (actor.role = 'ADMIN' or (actor.role = 'GUARD' and target.assigned_guard_id = actor.id))
  then raise exception using errcode = '42501', message = 'This task is not available to you'; end if;
  if btrim(coalesce(requested_body, '')) = '' then
    raise exception using errcode = '22023', message = 'Comment cannot be empty';
  end if;
  insert into public.operational_task_comments (society_id, task_id, author_id, body)
  values (actor.society_id, target.id, actor.id, btrim(requested_body))
  returning * into created_comment;
  return created_comment;
end;
$$;

revoke all on public.operational_tasks, public.operational_task_comments from anon, authenticated;
grant select on public.operational_tasks, public.operational_task_comments to authenticated;
revoke all on function public.create_admin_operational_task(text, text, text, timestamptz, uuid, uuid) from public, anon;
revoke all on function public.update_admin_operational_task(uuid, text, text, text, timestamptz, uuid, uuid) from public, anon;
revoke all on function public.set_operational_task_status(uuid, text, text) from public, anon;
revoke all on function public.add_operational_task_comment(uuid, text) from public, anon;
grant execute on function public.create_admin_operational_task(text, text, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.update_admin_operational_task(uuid, text, text, text, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.set_operational_task_status(uuid, text, text) to authenticated;
grant execute on function public.add_operational_task_comment(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operational_tasks')
    then alter publication supabase_realtime add table public.operational_tasks; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operational_task_comments')
    then alter publication supabase_realtime add table public.operational_task_comments; end if;
  end if;
end;
$$;

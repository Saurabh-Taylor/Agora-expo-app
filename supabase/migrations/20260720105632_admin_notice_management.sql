alter table public.notices
add column archived_at timestamptz;

create index notices_active_society_created_idx
on public.notices (society_id, created_at desc)
where archived_at is null;

drop policy if exists notices_select on public.notices;
create policy notices_select on public.notices
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and state = 'PUBLISHED'
      and archived_at is null
    )
  )
);

create or replace function public.create_admin_notice(
  requested_title text,
  requested_body text,
  requested_category public.notice_category,
  publish_now boolean
)
returns public.notices language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.notices%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can create notices';
  end if;
  if nullif(btrim(requested_title), '') is null or nullif(btrim(requested_body), '') is null then
    raise exception using errcode = '22023', message = 'Notice title and message are required';
  end if;

  insert into public.notices (society_id, title, body, category, state, published_at, created_by)
  values (
    actor.society_id,
    btrim(requested_title),
    btrim(requested_body),
    requested_category,
    case when publish_now then 'PUBLISHED'::public.notice_state else 'SCHEDULED'::public.notice_state end,
    case when publish_now then statement_timestamp() else null end,
    actor.id
  )
  returning * into result;

  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, (case when publish_now then 'Published notice ' else 'Saved notice draft ' end) || result.title);
  return result;
end;
$$;

create or replace function public.update_admin_notice(
  target_notice_id uuid,
  requested_title text,
  requested_body text,
  requested_category public.notice_category
)
returns public.notices language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.notices%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can edit notices';
  end if;
  select * into target from public.notices
  where id = target_notice_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Notice is not available to this admin'; end if;
  if target.archived_at is not null then raise exception using errcode = '22023', message = 'Archived notices cannot be edited'; end if;
  if nullif(btrim(requested_title), '') is null or nullif(btrim(requested_body), '') is null then
    raise exception using errcode = '22023', message = 'Notice title and message are required';
  end if;

  update public.notices
  set title = btrim(requested_title), body = btrim(requested_body), category = requested_category
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Updated notice ' || target.title);
  return target;
end;
$$;

create or replace function public.publish_admin_notice(target_notice_id uuid)
returns public.notices language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.notices%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can publish notices';
  end if;
  select * into target from public.notices
  where id = target_notice_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Notice is not available to this admin'; end if;
  if target.archived_at is not null then raise exception using errcode = '22023', message = 'Archived notices cannot be published'; end if;
  if target.state = 'PUBLISHED' then raise exception using errcode = '22023', message = 'Notice is already published'; end if;

  update public.notices set state = 'PUBLISHED', scheduled_at = null, published_at = statement_timestamp()
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Published notice ' || target.title);
  return target;
end;
$$;

create or replace function public.archive_admin_notice(target_notice_id uuid)
returns public.notices language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.notices%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can archive notices';
  end if;
  select * into target from public.notices
  where id = target_notice_id and society_id = actor.society_id
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Notice is not available to this admin'; end if;
  if target.archived_at is not null then raise exception using errcode = '22023', message = 'Notice is already archived'; end if;

  update public.notices set archived_at = statement_timestamp()
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Archived notice ' || target.title);
  return target;
end;
$$;

revoke all on function public.create_admin_notice(text, text, public.notice_category, boolean) from public, anon;
revoke all on function public.update_admin_notice(uuid, text, text, public.notice_category) from public, anon;
revoke all on function public.publish_admin_notice(uuid) from public, anon;
revoke all on function public.archive_admin_notice(uuid) from public, anon;
grant execute on function public.create_admin_notice(text, text, public.notice_category, boolean) to authenticated;
grant execute on function public.update_admin_notice(uuid, text, text, public.notice_category) to authenticated;
grant execute on function public.publish_admin_notice(uuid) to authenticated;
grant execute on function public.archive_admin_notice(uuid) to authenticated;

revoke insert, update, delete on public.notices from authenticated;
grant select on public.notices to authenticated;

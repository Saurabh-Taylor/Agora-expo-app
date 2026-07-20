alter table public.polls add column archived_at timestamptz;

alter table public.poll_options
add column vote_count integer not null default 0 check (vote_count >= 0);

update public.poll_options option_row
set vote_count = (
  select count(*)::integer
  from public.poll_votes vote_row
  where vote_row.option_id = option_row.id
    and vote_row.society_id = option_row.society_id
);

create index polls_active_society_created_idx
on public.polls (society_id, created_at desc)
where archived_at is null;

drop policy if exists polls_select on public.polls;
drop policy if exists polls_admin_write on public.polls;
create policy polls_select on public.polls
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or ((select public.current_user_role()) = 'RESIDENT' and archived_at is null)
  )
);

drop policy if exists poll_options_select on public.poll_options;
drop policy if exists poll_options_admin_write on public.poll_options;
create policy poll_options_select on public.poll_options
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (select public.current_user_role()) in ('ADMIN', 'RESIDENT')
  and exists (
    select 1 from public.polls poll_row
    where poll_row.id = poll_id
      and poll_row.society_id = poll_options.society_id
      and ((select public.current_user_role()) = 'ADMIN' or poll_row.archived_at is null)
  )
);

drop policy if exists poll_votes_select on public.poll_votes;
drop policy if exists poll_votes_resident_insert on public.poll_votes;
create policy poll_votes_select on public.poll_votes
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or ((select public.current_user_role()) = 'RESIDENT' and profile_id = (select auth.uid()))
  )
);

create or replace function public.create_admin_poll(
  requested_question text,
  requested_options text[],
  requested_closes_at timestamptz
)
returns public.polls language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.polls%rowtype;
  cleaned_options text[];
  unique_option_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can create polls';
  end if;
  if char_length(btrim(coalesce(requested_question, ''))) < 4 then
    raise exception using errcode = '22023', message = 'Poll question must be at least 4 characters';
  end if;
  if requested_closes_at is not null and requested_closes_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'Poll closing time must be in the future';
  end if;

  select array_agg(btrim(option_label) order by option_position)
  into cleaned_options
  from unnest(coalesce(requested_options, array[]::text[])) with ordinality as options(option_label, option_position)
  where nullif(btrim(option_label), '') is not null;

  if coalesce(array_length(cleaned_options, 1), 0) < 2
    or coalesce(array_length(cleaned_options, 1), 0) > 5 then
    raise exception using errcode = '22023', message = 'A poll requires between 2 and 5 options';
  end if;
  select count(distinct lower(option_label)) into unique_option_count from unnest(cleaned_options) option_label;
  if unique_option_count <> array_length(cleaned_options, 1) then
    raise exception using errcode = '22023', message = 'Poll options must be unique';
  end if;

  insert into public.polls (society_id, question, state, created_by, closes_at)
  values (actor.society_id, btrim(requested_question), 'ACTIVE', actor.id, requested_closes_at)
  returning * into result;

  insert into public.poll_options (poll_id, society_id, label, sort_order)
  select result.id, actor.society_id, option_label, option_position - 1
  from unnest(cleaned_options) with ordinality as options(option_label, option_position);

  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Created poll ' || result.question);
  return result;
end;
$$;

create or replace function public.cast_poll_vote(target_poll_id uuid, target_option_id uuid)
returns public.poll_votes language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target_poll public.polls%rowtype;
  result public.poll_votes%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can vote';
  end if;
  select * into target_poll from public.polls
  where id = target_poll_id and society_id = actor.society_id
  for update;
  if target_poll.id is null then
    raise exception using errcode = '42501', message = 'Poll is not available to this resident';
  end if;
  if target_poll.archived_at is not null or target_poll.state <> 'ACTIVE'
    or (target_poll.closes_at is not null and target_poll.closes_at <= statement_timestamp()) then
    raise exception using errcode = '22023', message = 'This poll is closed';
  end if;
  if not exists (
    select 1 from public.poll_options
    where id = target_option_id and poll_id = target_poll.id and society_id = actor.society_id
  ) then
    raise exception using errcode = '22023', message = 'The selected option does not belong to this poll';
  end if;
  if exists (
    select 1 from public.poll_votes where poll_id = target_poll.id and profile_id = actor.id
  ) then
    raise exception using errcode = '23505', message = 'You have already voted in this poll';
  end if;

  insert into public.poll_votes (poll_id, option_id, society_id, profile_id)
  values (target_poll.id, target_option_id, actor.society_id, actor.id)
  returning * into result;
  update public.poll_options set vote_count = vote_count + 1
  where id = target_option_id and society_id = actor.society_id;
  return result;
end;
$$;

create or replace function public.close_admin_poll(target_poll_id uuid)
returns public.polls language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.polls%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can close polls';
  end if;
  select * into target from public.polls
  where id = target_poll_id and society_id = actor.society_id for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Poll is not available to this admin'; end if;
  if target.archived_at is not null then raise exception using errcode = '22023', message = 'Archived polls cannot be closed'; end if;
  if target.state = 'CLOSED' then raise exception using errcode = '22023', message = 'Poll is already closed'; end if;

  update public.polls set state = 'CLOSED', closes_at = coalesce(closes_at, statement_timestamp())
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Closed poll ' || target.question);
  return target;
end;
$$;

create or replace function public.archive_admin_poll(target_poll_id uuid)
returns public.polls language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.polls%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can archive polls';
  end if;
  select * into target from public.polls
  where id = target_poll_id and society_id = actor.society_id for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Poll is not available to this admin'; end if;
  if target.archived_at is not null then raise exception using errcode = '22023', message = 'Poll is already archived'; end if;
  if target.state <> 'CLOSED' then raise exception using errcode = '22023', message = 'Close the poll before archiving it'; end if;

  update public.polls set archived_at = statement_timestamp()
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, 'Archived poll ' || target.question);
  return target;
end;
$$;

revoke all on function public.create_admin_poll(text, text[], timestamptz) from public, anon;
revoke all on function public.cast_poll_vote(uuid, uuid) from public, anon;
revoke all on function public.close_admin_poll(uuid) from public, anon;
revoke all on function public.archive_admin_poll(uuid) from public, anon;
grant execute on function public.create_admin_poll(text, text[], timestamptz) to authenticated;
grant execute on function public.cast_poll_vote(uuid, uuid) to authenticated;
grant execute on function public.close_admin_poll(uuid) to authenticated;
grant execute on function public.archive_admin_poll(uuid) to authenticated;

revoke insert, update, delete on public.polls, public.poll_options, public.poll_votes from authenticated;
grant select on public.polls, public.poll_options, public.poll_votes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'poll_options'
  ) then
    alter publication supabase_realtime add table public.poll_options;
  end if;
end;
$$;

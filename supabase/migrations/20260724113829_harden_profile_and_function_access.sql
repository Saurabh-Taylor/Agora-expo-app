-- Guards must use search_guard_residents(), which exposes only the fields
-- required to route a visitor. Direct profile reads are limited to the caller
-- and same-society admins so guards cannot enumerate resident PII.
alter policy profiles_select_self on public.profiles
  to authenticated
  using (
    id = (select auth.uid())
    or (
      society_id = (select public.current_society_id())
      and (select public.current_user_role()) = 'ADMIN'
    )
  );

-- Trigger functions are invoked by Postgres through their trigger, not through
-- the Data API. Do not leave the maintenance trigger callable as an RPC.
revoke all on function public.mark_due_paid_on_payment()
  from public, anon, authenticated, service_role;

-- New functions are private by default. Each intentional RPC must grant its
-- precise caller explicitly in the migration that creates it.
alter default privileges in schema public
  revoke execute on functions from public;


-- An Expo push token identifies an app installation, not an account. Enforce a
-- single current owner so a shared phone cannot remain subscribed to multiple
-- resident or guard accounts.
delete from public.push_tokens as older
using public.push_tokens as newer
where older.token = newer.token
  and (older.created_at, older.id) < (newer.created_at, newer.id);

alter table public.push_tokens
  drop constraint if exists push_tokens_profile_id_token_key;
alter table public.push_tokens
  add constraint push_tokens_token_key unique (token);
alter table public.push_tokens
  add column last_seen_at timestamptz not null default statement_timestamp();

revoke insert, update, delete on public.push_tokens from authenticated;

create or replace function public.register_current_push_token(
  requested_token text,
  requested_platform text
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  normalized_token text := trim(coalesce(requested_token, ''));
  normalized_platform text := lower(trim(coalesce(requested_platform, '')));
  registered public.push_tokens%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid())
    and is_active;

  if actor.id is null then
    raise exception using errcode = '42501', message = 'Only active society members can register notifications';
  end if;
  if normalized_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception using errcode = '22023', message = 'Push token is invalid';
  end if;
  if normalized_platform not in ('android', 'ios') then
    raise exception using errcode = '22023', message = 'Push platform is invalid';
  end if;

  insert into public.push_tokens (
    profile_id,
    society_id,
    token,
    platform,
    last_seen_at
  )
  values (
    actor.id,
    actor.society_id,
    normalized_token,
    normalized_platform,
    statement_timestamp()
  )
  on conflict (token) do update
  set profile_id = excluded.profile_id,
      society_id = excluded.society_id,
      platform = excluded.platform,
      last_seen_at = excluded.last_seen_at
  returning * into registered;

  return registered;
end;
$$;

create or replace function public.unregister_current_push_token(
  requested_token text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_token text := nullif(trim(coalesce(requested_token, '')), '');
  removed_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  delete from public.push_tokens
  where profile_id = actor_id
    and (normalized_token is null or token = normalized_token);

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.register_current_push_token(text, text)
  from public, anon, service_role;
revoke all on function public.unregister_current_push_token(text)
  from public, anon, service_role;
grant execute on function public.register_current_push_token(text, text)
  to authenticated;
grant execute on function public.unregister_current_push_token(text)
  to authenticated;


-- Hackathon payment mode is intentionally a simulation. The production RPC is
-- disabled until a Razorpay order and signed webhook become authoritative.
revoke all on function public.pay_resident_maintenance_due(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.record_demo_razorpay_payment(
  target_due_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.maintenance_dues%rowtype;
  result public.payments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid())
    and is_active;

  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can record a demo payment';
  end if;

  select * into target
  from public.maintenance_dues
  where id = target_due_id
    and society_id = actor.society_id
    and flat_id = actor.flat_id
  for update;

  if target.id is null then
    raise exception using errcode = '42501', message = 'Maintenance due is not available to this resident';
  end if;
  if target.status <> 'UNPAID' then
    raise exception using errcode = '23505', message = 'This maintenance due is already paid';
  end if;

  insert into public.payments (
    due_id,
    society_id,
    flat_id,
    paid_by,
    amount,
    method,
    receipt_no
  )
  values (
    target.id,
    actor.society_id,
    actor.flat_id,
    actor.id,
    target.amount,
    'RAZORPAY_DEMO',
    'DEMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.record_demo_razorpay_payment(uuid)
  from public, anon, service_role;
grant execute on function public.record_demo_razorpay_payment(uuid)
  to authenticated;


-- Profile lifecycle changes are privileged operations. Authenticated clients
-- may read their authorized rows but all writes go through narrow RPCs or the
-- account-provisioning Edge Function.
revoke insert, update, delete on public.profiles from authenticated;

create or replace function public.set_admin_guard_active(
  target_guard_id uuid,
  requested_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid())
    and is_active;

  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage guard access';
  end if;

  select * into target
  from public.profiles
  where id = target_guard_id
    and society_id = actor.society_id
    and role = 'GUARD'
  for update;

  if target.id is null then
    raise exception using errcode = '42501', message = 'Guard account is not available';
  end if;

  update public.profiles
  set is_active = requested_active
  where id = target.id
  returning * into target;

  if not requested_active then
    delete from public.push_tokens
    where profile_id = target.id
      and society_id = actor.society_id;
  end if;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id,
    actor.id,
    case when requested_active then 'Activated guard account' else 'Deactivated guard account' end,
    target.full_name
  );

  return target;
end;
$$;

revoke all on function public.set_admin_guard_active(uuid, boolean)
  from public, anon, service_role;
grant execute on function public.set_admin_guard_active(uuid, boolean)
  to authenticated;


create or replace function public.create_admin_maintenance_dues(
  requested_flat_ids uuid[],
  requested_period_label text,
  requested_amount numeric,
  requested_due_date date
)
returns setof public.maintenance_dues
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  normalized_label text := trim(coalesce(requested_period_label, ''));
  target_ids uuid[];
  target_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid())
    and is_active;

  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can create maintenance invoices';
  end if;
  if char_length(normalized_label) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'Billing period must be between 2 and 60 characters';
  end if;
  if requested_amount is null or requested_amount <= 0 or requested_amount > 10000000 then
    raise exception using errcode = '22023', message = 'Invoice amount must be greater than zero';
  end if;
  if requested_due_date is null then
    raise exception using errcode = '22023', message = 'Due date is required';
  end if;

  select array_agg(distinct flat_id)
  into target_ids
  from unnest(coalesce(requested_flat_ids, array[]::uuid[])) as flat_id;

  target_count := coalesce(cardinality(target_ids), 0);
  if target_count = 0 or target_count > 500 then
    raise exception using errcode = '22023', message = 'Choose between 1 and 500 flats';
  end if;

  if (
    select count(*)
    from public.flats
    where society_id = actor.society_id
      and id = any(target_ids)
  ) <> target_count then
    raise exception using errcode = '42501', message = 'One or more flats are not available in this society';
  end if;

  if exists (
    select 1
    from public.maintenance_dues
    where society_id = actor.society_id
      and flat_id = any(target_ids)
      and quarter_label = normalized_label
  ) then
    raise exception using errcode = '23505', message = 'An invoice already exists for this billing period';
  end if;

  insert into public.maintenance_dues (
    society_id,
    flat_id,
    quarter_label,
    amount,
    due_date
  )
  select
    actor.society_id,
    flat_id,
    normalized_label,
    requested_amount,
    requested_due_date
  from unnest(target_ids) as flat_id;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id,
    actor.id,
    'Created maintenance invoices',
    normalized_label || '  -  ' || target_count || ' flat(s)'
  );

  return query
  select *
  from public.maintenance_dues
  where society_id = actor.society_id
    and flat_id = any(target_ids)
    and quarter_label = normalized_label
  order by flat_id;
end;
$$;

revoke all on function public.create_admin_maintenance_dues(uuid[], text, numeric, date)
  from public, anon, service_role;
grant execute on function public.create_admin_maintenance_dues(uuid[], text, numeric, date)
  to authenticated;


-- Residents receive a read-only directory of currently active contacts. Guards
-- have no directory access; their resident lookup remains the minimal RPC.
alter policy staff_admin_select on public.staff
  to authenticated
  using (
    society_id = (select public.current_society_id())
    and (
      (select public.current_user_role()) = 'ADMIN'
      or (
        (select public.current_user_role()) = 'RESIDENT'
        and status = 'ON_DUTY'
      )
    )
  );

alter policy service_providers_admin_select on public.service_providers
  to authenticated
  using (
    society_id = (select public.current_society_id())
    and (
      (select public.current_user_role()) = 'ADMIN'
      or (
        (select public.current_user_role()) = 'RESIDENT'
        and status = 'ON_DUTY'
      )
    )
  );

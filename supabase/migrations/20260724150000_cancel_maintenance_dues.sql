alter table public.maintenance_dues
add column cancelled_at timestamptz,
add column cancelled_by uuid,
add column cancel_reason text,
add constraint maintenance_dues_cancelled_by_same_society_fkey
  foreign key (cancelled_by, society_id)
  references public.profiles (id, society_id)
  on delete restrict,
add constraint maintenance_dues_cancellation_shape_check
  check (
    (cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or
    (cancelled_at is not null and cancelled_by is not null and nullif(btrim(cancel_reason), '') is not null)
  );

create index maintenance_dues_active_status_idx
on public.maintenance_dues (society_id, status, due_date)
where cancelled_at is null;

create or replace function public.cancel_admin_maintenance_due(
  target_due_id uuid,
  requested_reason text
)
returns public.maintenance_dues
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.maintenance_dues%rowtype;
  normalized_reason text := nullif(btrim(requested_reason), '');
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid()) and is_active;

  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can cancel maintenance invoices';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'Cancellation reason is required';
  end if;

  select * into target
  from public.maintenance_dues
  where id = target_due_id and society_id = actor.society_id
  for update;

  if target.id is null then
    raise exception using errcode = '42501', message = 'Maintenance invoice is not available to this admin';
  end if;

  if target.status <> 'UNPAID' or target.cancelled_at is not null then
    raise exception using errcode = '22023', message = 'Only an active unpaid invoice can be cancelled';
  end if;

  if exists (
    select 1 from public.payments
    where due_id = target.id and society_id = actor.society_id
  ) then
    raise exception using errcode = '22023', message = 'An invoice with a payment cannot be cancelled';
  end if;

  update public.maintenance_dues
  set cancelled_at = statement_timestamp(),
      cancelled_by = actor.id,
      cancel_reason = normalized_reason
  where id = target.id
  returning * into target;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id,
    actor.id,
    'Cancelled maintenance invoice ' || target.quarter_label,
    normalized_reason
  );

  return target;
end;
$$;

create or replace function public.prevent_cancelled_maintenance_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.maintenance_dues due
    where due.id = new.due_id
      and due.society_id = new.society_id
      and due.cancelled_at is not null
  ) then
    raise exception using errcode = '22023', message = 'Cancelled maintenance invoices cannot be paid';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_cancelled_maintenance_payment_trigger on public.payments;
create trigger prevent_cancelled_maintenance_payment_trigger
before insert on public.payments
for each row execute function public.prevent_cancelled_maintenance_payment();

revoke all on function public.cancel_admin_maintenance_due(uuid, text) from public, anon;
grant execute on function public.cancel_admin_maintenance_due(uuid, text) to authenticated;

revoke all on function public.prevent_cancelled_maintenance_payment() from public, anon, authenticated, service_role;

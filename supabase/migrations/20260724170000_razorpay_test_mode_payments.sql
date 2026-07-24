create table public.razorpay_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  due_id uuid not null,
  created_by uuid not null,
  razorpay_order_id text not null unique,
  checkout_token uuid not null default gen_random_uuid() unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'CREATED'
    check (status in ('CREATED', 'CAPTURED', 'FAILED', 'EXPIRED')),
  razorpay_payment_id text,
  failure_reason text,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint razorpay_attempt_due_same_society_fkey
    foreign key (due_id, society_id)
    references public.maintenance_dues(id, society_id) on delete cascade,
  constraint razorpay_attempt_flat_same_society_fkey
    foreign key (flat_id, society_id)
    references public.flats(id, society_id) on delete cascade,
  constraint razorpay_attempt_creator_same_society_fkey
    foreign key (created_by, society_id)
    references public.profiles(id, society_id) on delete restrict
);

create index razorpay_attempts_resident_idx
  on public.razorpay_payment_attempts (society_id, created_by, created_at desc);
create index razorpay_attempts_due_idx
  on public.razorpay_payment_attempts (society_id, due_id, created_at desc);

alter table public.payments
  add column gateway text,
  add column gateway_order_id text,
  add column gateway_payment_id text,
  add column is_test boolean not null default false;

create unique index payments_gateway_order_unique
  on public.payments (gateway, gateway_order_id)
  where gateway_order_id is not null;
create unique index payments_gateway_payment_unique
  on public.payments (gateway, gateway_payment_id)
  where gateway_payment_id is not null;

alter table public.razorpay_payment_attempts enable row level security;

create policy razorpay_attempts_select on public.razorpay_payment_attempts
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and flat_id = (select public.current_flat_id())
      and created_by = (select auth.uid())
    )
  )
);

revoke all on public.razorpay_payment_attempts from public, anon, authenticated;
grant select on public.razorpay_payment_attempts to authenticated;
grant all on public.razorpay_payment_attempts to service_role;

create or replace function public.record_verified_razorpay_payment(
  target_attempt_id uuid,
  verified_order_id text,
  verified_payment_id text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.razorpay_payment_attempts%rowtype;
  target_due public.maintenance_dues%rowtype;
  result public.payments%rowtype;
begin
  select * into attempt
  from public.razorpay_payment_attempts
  where id = target_attempt_id
  for update;

  if attempt.id is null then
    raise exception using errcode = 'P0002', message = 'Payment attempt was not found';
  end if;

  if attempt.razorpay_order_id <> verified_order_id then
    raise exception using errcode = '22023', message = 'Verified order does not match this payment attempt';
  end if;

  if attempt.status = 'CAPTURED' then
    select * into result
    from public.payments
    where gateway = 'RAZORPAY'
      and gateway_order_id = attempt.razorpay_order_id;
    if result.id is null then
      raise exception using errcode = 'P0002', message = 'Captured payment record is missing';
    end if;
    return result;
  end if;

  if attempt.status <> 'CREATED' or attempt.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Payment attempt is no longer payable';
  end if;

  select * into target_due
  from public.maintenance_dues
  where id = attempt.due_id
    and society_id = attempt.society_id
    and flat_id = attempt.flat_id
  for update;

  if target_due.id is null
    or target_due.cancelled_at is not null
    or target_due.status <> 'UNPAID'
    or round(target_due.amount * 100)::integer <> attempt.amount_paise then
    raise exception using errcode = '22023', message = 'Maintenance due is no longer payable';
  end if;

  insert into public.payments (
    due_id,
    society_id,
    flat_id,
    paid_by,
    amount,
    method,
    receipt_no,
    gateway,
    gateway_order_id,
    gateway_payment_id,
    is_test
  )
  values (
    attempt.due_id,
    attempt.society_id,
    attempt.flat_id,
    attempt.created_by,
    target_due.amount,
    'RAZORPAY_TEST',
    'RZP-' || upper(substr(replace(verified_payment_id, '_', ''), 1, 16)),
    'RAZORPAY',
    attempt.razorpay_order_id,
    verified_payment_id,
    true
  )
  returning * into result;

  update public.razorpay_payment_attempts
  set status = 'CAPTURED',
      razorpay_payment_id = verified_payment_id,
      verified_at = now(),
      updated_at = now()
  where id = attempt.id;

  return result;
end;
$$;

revoke all on function public.record_verified_razorpay_payment(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_verified_razorpay_payment(uuid, text, text)
  to service_role;

revoke all on function public.record_demo_razorpay_payment(uuid)
  from public, anon, authenticated, service_role;
drop function public.record_demo_razorpay_payment(uuid);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'razorpay_payment_attempts'
  ) then
    alter publication supabase_realtime add table public.razorpay_payment_attempts;
  end if;
end;
$$;

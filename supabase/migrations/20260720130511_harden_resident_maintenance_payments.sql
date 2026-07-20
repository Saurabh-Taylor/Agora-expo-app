drop policy if exists dues_select on public.maintenance_dues;
create policy dues_select on public.maintenance_dues
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and flat_id = (select public.current_flat_id())
    )
  )
);

drop policy if exists payments_select on public.payments;
drop policy if exists payments_resident_insert on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (
  society_id = (select public.current_society_id())
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and flat_id = (select public.current_flat_id())
      and paid_by = (select auth.uid())
    )
  )
);

create or replace function public.mark_due_paid_on_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.maintenance_dues
  set status = 'PAID'
  where id = new.due_id
    and society_id = new.society_id
    and flat_id = new.flat_id
    and status = 'UNPAID';
  if not found then
    raise exception using errcode = '23505', message = 'This maintenance due is already paid';
  end if;
  return new;
end;
$$;

create or replace function public.pay_resident_maintenance_due(
  target_due_id uuid,
  requested_method text
)
returns public.payments language plpgsql security definer set search_path = ''
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
  where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can pay maintenance dues';
  end if;
  if requested_method not in ('UPI', 'Card', 'Netbanking', 'Wallet') then
    raise exception using errcode = '22023', message = 'Payment method is invalid';
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
    due_id, society_id, flat_id, paid_by, amount, method, receipt_no
  )
  values (
    target.id,
    actor.society_id,
    actor.flat_id,
    actor.id,
    target.amount,
    requested_method,
    'AGORA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  )
  returning * into result;
  return result;
end;
$$;

revoke all on function public.pay_resident_maintenance_due(uuid, text) from public, anon;
grant execute on function public.pay_resident_maintenance_due(uuid, text) to authenticated;
revoke insert, update, delete on public.maintenance_dues, public.payments from authenticated;
grant select on public.maintenance_dues, public.payments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'maintenance_dues'
  ) then
    alter publication supabase_realtime add table public.maintenance_dues;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end;
$$;

-- Enforce account lifecycle centrally for every authenticated domain write.
create or replace function public.enforce_active_completed_account_for_domain_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blocked boolean;
begin
  if actor_id is not null then
    select exists (
      select 1 from public.profiles
      where id = actor_id and (not is_active or must_change_password)
    ) into blocked;
    if blocked then
      raise exception using errcode = '42501', message = 'Complete your password change before using Agora';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_record record;
begin
  for table_record in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'profiles'
  loop
    execute format('drop trigger if exists account_lifecycle_guard on public.%I', table_record.tablename);
    execute format(
      'create trigger account_lifecycle_guard before insert or update or delete on public.%I for each row execute function public.enforce_active_completed_account_for_domain_writes()',
      table_record.tablename
    );
  end loop;
end;
$$;

-- This legacy RPC could clear the flag without changing the password. The Edge
-- Function is the only supported completion path now.
revoke all on function public.complete_password_change() from public, anon, authenticated, service_role;

-- Audit records are written by trusted server functions, never by client JWTs.
drop policy if exists audit_events_admin_insert on public.audit_events;
revoke insert, update, delete on public.audit_events from authenticated;

-- Existing account-context helpers must treat forced-password-change accounts as unavailable.
create or replace function public.current_society_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select society_id from public.profiles where id = (select auth.uid()) and is_active and not must_change_password $$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) and is_active and not must_change_password $$;

create or replace function public.current_flat_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select flat_id from public.profiles where id = (select auth.uid()) and is_active and not must_change_password $$;

revoke all on function public.enforce_active_completed_account_for_domain_writes() from public, anon, authenticated;

alter table public.staff add column updated_at timestamptz not null default now();
alter table public.service_providers add column updated_at timestamptz not null default now();

drop policy if exists staff_select on public.staff;
drop policy if exists staff_admin_write on public.staff;
create policy staff_admin_select on public.staff for select to authenticated
using (society_id = (select public.current_society_id()) and (select public.current_user_role()) = 'ADMIN');

drop policy if exists service_providers_select on public.service_providers;
drop policy if exists service_providers_admin_write on public.service_providers;
create policy service_providers_admin_select on public.service_providers for select to authenticated
using (society_id = (select public.current_society_id()) and (select public.current_user_role()) = 'ADMIN');

create or replace function public.save_admin_staff(
  target_staff_id uuid,
  requested_name text,
  requested_role text,
  requested_shift text,
  requested_phone text
)
returns public.staff language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.staff%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can save staff';
  end if;
  if char_length(btrim(coalesce(requested_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Staff name must be at least 2 characters';
  end if;
  if char_length(btrim(coalesce(requested_role, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Staff role must be at least 2 characters';
  end if;
  if nullif(btrim(coalesce(requested_phone, '')), '') is not null
    and btrim(requested_phone) !~ '^[0-9+() -]{7,20}$' then
    raise exception using errcode = '22023', message = 'Staff phone number is invalid';
  end if;

  if target_staff_id is null then
    insert into public.staff (society_id, name, role, shift, phone)
    values (
      actor.society_id,
      btrim(requested_name),
      btrim(requested_role),
      nullif(btrim(coalesce(requested_shift, '')), ''),
      nullif(btrim(coalesce(requested_phone, '')), '')
    )
    returning * into target;
    insert into public.audit_events (society_id, actor_id, action)
    values (actor.society_id, actor.id, 'Added staff member ' || target.name);
  else
    select * into target from public.staff
    where id = target_staff_id and society_id = actor.society_id for update;
    if target.id is null then
      raise exception using errcode = '42501', message = 'Staff member is not available to this admin';
    end if;
    update public.staff set
      name = btrim(requested_name),
      role = btrim(requested_role),
      shift = nullif(btrim(coalesce(requested_shift, '')), ''),
      phone = nullif(btrim(coalesce(requested_phone, '')), ''),
      updated_at = statement_timestamp()
    where id = target.id returning * into target;
    insert into public.audit_events (society_id, actor_id, action)
    values (actor.society_id, actor.id, 'Updated staff member ' || target.name);
  end if;
  return target;
end;
$$;

create or replace function public.set_admin_staff_status(
  target_staff_id uuid,
  requested_status public.staff_status
)
returns public.staff language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.staff%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can change staff status';
  end if;
  select * into target from public.staff
  where id = target_staff_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Staff member is not available to this admin';
  end if;
  if target.status = requested_status then
    raise exception using errcode = '22023', message = 'Staff status is already unchanged';
  end if;
  update public.staff set status = requested_status, updated_at = statement_timestamp()
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    'Marked ' || target.name || case when requested_status = 'ON_DUTY' then ' as on duty' else ' as off duty' end
  );
  return target;
end;
$$;

create or replace function public.save_admin_service_provider(
  target_provider_id uuid,
  requested_name text,
  requested_category text,
  requested_phone text
)
returns public.service_providers language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.service_providers%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can save service providers';
  end if;
  if char_length(btrim(coalesce(requested_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Provider name must be at least 2 characters';
  end if;
  if char_length(btrim(coalesce(requested_category, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Provider category must be at least 2 characters';
  end if;
  if nullif(btrim(coalesce(requested_phone, '')), '') is not null
    and btrim(requested_phone) !~ '^[0-9+() -]{7,20}$' then
    raise exception using errcode = '22023', message = 'Provider phone number is invalid';
  end if;

  if target_provider_id is null then
    insert into public.service_providers (society_id, name, category, phone)
    values (
      actor.society_id,
      btrim(requested_name),
      btrim(requested_category),
      nullif(btrim(coalesce(requested_phone, '')), '')
    )
    returning * into target;
    insert into public.audit_events (society_id, actor_id, action)
    values (actor.society_id, actor.id, 'Added service provider ' || target.name);
  else
    select * into target from public.service_providers
    where id = target_provider_id and society_id = actor.society_id for update;
    if target.id is null then
      raise exception using errcode = '42501', message = 'Service provider is not available to this admin';
    end if;
    update public.service_providers set
      name = btrim(requested_name),
      category = btrim(requested_category),
      phone = nullif(btrim(coalesce(requested_phone, '')), ''),
      updated_at = statement_timestamp()
    where id = target.id returning * into target;
    insert into public.audit_events (society_id, actor_id, action)
    values (actor.society_id, actor.id, 'Updated service provider ' || target.name);
  end if;
  return target;
end;
$$;

create or replace function public.set_admin_service_provider_status(
  target_provider_id uuid,
  requested_status public.staff_status
)
returns public.service_providers language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.service_providers%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can change service provider status';
  end if;
  select * into target from public.service_providers
  where id = target_provider_id and society_id = actor.society_id for update;
  if target.id is null then
    raise exception using errcode = '42501', message = 'Service provider is not available to this admin';
  end if;
  if target.status = requested_status then
    raise exception using errcode = '22023', message = 'Service provider status is already unchanged';
  end if;
  update public.service_providers set status = requested_status, updated_at = statement_timestamp()
  where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (
    actor.society_id,
    actor.id,
    'Marked ' || target.name || case when requested_status = 'ON_DUTY' then ' as active' else ' as inactive' end
  );
  return target;
end;
$$;

revoke all on function public.save_admin_staff(uuid, text, text, text, text) from public, anon;
revoke all on function public.set_admin_staff_status(uuid, public.staff_status) from public, anon;
revoke all on function public.save_admin_service_provider(uuid, text, text, text) from public, anon;
revoke all on function public.set_admin_service_provider_status(uuid, public.staff_status) from public, anon;
grant execute on function public.save_admin_staff(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_admin_staff_status(uuid, public.staff_status) to authenticated;
grant execute on function public.save_admin_service_provider(uuid, text, text, text) to authenticated;
grant execute on function public.set_admin_service_provider_status(uuid, public.staff_status) to authenticated;

revoke insert, update, delete on public.staff, public.service_providers from authenticated;
grant select on public.staff, public.service_providers to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff'
  ) then alter publication supabase_realtime add table public.staff; end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_providers'
  ) then alter publication supabase_realtime add table public.service_providers; end if;
end;
$$;

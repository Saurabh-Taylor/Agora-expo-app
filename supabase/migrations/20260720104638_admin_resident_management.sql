alter table public.profiles
add column is_active boolean not null default true;

create or replace function public.current_society_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select society_id from public.profiles where id = (select auth.uid()) and is_active $$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) and is_active $$;

create or replace function public.current_flat_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select flat_id from public.profiles where id = (select auth.uid()) and is_active $$;

create or replace function public.prevent_self_privilege_escalation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_user_role() <> 'ADMIN' and (
    new.role <> old.role
    or new.society_id <> old.society_id
    or new.flat_id is distinct from old.flat_id
    or new.occupancy_type is distinct from old.occupancy_type
    or new.is_verified <> old.is_verified
    or new.is_active <> old.is_active
    or (
      new.must_change_password <> old.must_change_password
      and not (old.must_change_password and not new.must_change_password)
    )
  ) then
    raise exception using errcode = '42501', message = 'Profile authorization fields cannot be changed by this account';
  end if;
  return new;
end;
$$;

create or replace function public.update_admin_resident(
  target_resident_id uuid,
  requested_full_name text,
  requested_phone text,
  requested_flat_id uuid,
  requested_occupancy public.occupancy_type,
  requested_verified boolean
)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  target_flat public.flats%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage residents';
  end if;

  select * into target from public.profiles
  where id = target_resident_id and society_id = actor.society_id and role = 'RESIDENT'
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Resident is not available to this admin'; end if;

  select * into target_flat from public.flats
  where id = requested_flat_id and society_id = actor.society_id;
  if target_flat.id is null then raise exception using errcode = '42501', message = 'Flat is not available to this admin'; end if;
  if exists (
    select 1 from public.profiles
    where flat_id = target_flat.id and role = 'RESIDENT' and id <> target.id
  ) then
    raise exception using errcode = '23505', message = 'This flat is already assigned to another resident';
  end if;
  if nullif(btrim(requested_full_name), '') is null then
    raise exception using errcode = '22023', message = 'Resident name is required';
  end if;
  if requested_occupancy is null then
    raise exception using errcode = '22023', message = 'Occupancy type is required';
  end if;

  update public.profiles
  set full_name = btrim(requested_full_name),
      phone = nullif(btrim(requested_phone), ''),
      flat_id = target_flat.id,
      occupancy_type = requested_occupancy,
      is_verified = requested_verified
  where id = target.id
  returning * into target;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Updated resident ' || target.full_name, 'Resident profile or flat assignment changed');
  return target;
end;
$$;

create or replace function public.set_admin_resident_verified(target_resident_id uuid, requested_verified boolean)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage residents';
  end if;
  select * into target from public.profiles
  where id = target_resident_id and society_id = actor.society_id and role = 'RESIDENT'
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Resident is not available to this admin'; end if;

  update public.profiles set is_verified = requested_verified where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, (case when requested_verified then 'Verified ' else 'Unverified ' end) || target.full_name);
  return target;
end;
$$;

create or replace function public.set_admin_resident_active(target_resident_id uuid, requested_active boolean)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage residents';
  end if;
  select * into target from public.profiles
  where id = target_resident_id and society_id = actor.society_id and role = 'RESIDENT'
  for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Resident is not available to this admin'; end if;

  update public.profiles set is_active = requested_active where id = target.id returning * into target;
  insert into public.audit_events (society_id, actor_id, action)
  values (actor.society_id, actor.id, (case when requested_active then 'Activated ' else 'Deactivated ' end) || target.full_name);
  return target;
end;
$$;

create or replace function public.complete_password_change()
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and is_active) then
    raise exception using errcode = '42501', message = 'Account is inactive';
  end if;
  update public.profiles set must_change_password = false where id = (select auth.uid());
  return true;
end;
$$;

revoke all on function public.update_admin_resident(uuid, text, text, uuid, public.occupancy_type, boolean) from public, anon;
revoke all on function public.set_admin_resident_verified(uuid, boolean) from public, anon;
revoke all on function public.set_admin_resident_active(uuid, boolean) from public, anon;
revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.update_admin_resident(uuid, text, text, uuid, public.occupancy_type, boolean) to authenticated;
grant execute on function public.set_admin_resident_verified(uuid, boolean) to authenticated;
grant execute on function public.set_admin_resident_active(uuid, boolean) to authenticated;
grant execute on function public.complete_password_change() to authenticated;

revoke update on public.profiles from authenticated;

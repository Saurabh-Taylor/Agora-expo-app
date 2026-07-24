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
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid()) and is_active;

  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage residents';
  end if;

  select * into target
  from public.profiles
  where id = target_resident_id
    and society_id = actor.society_id
    and role = 'RESIDENT'
  for update;

  if target.id is null then
    raise exception using errcode = '42501', message = 'Resident is not available to this admin';
  end if;

  select * into target_flat
  from public.flats
  where id = requested_flat_id
    and society_id = actor.society_id;

  if target_flat.id is null then
    raise exception using errcode = '42501', message = 'Flat is not available to this admin';
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
  values (
    actor.society_id,
    actor.id,
    'Updated resident ' || target.full_name,
    'Resident profile or flat assignment changed'
  );

  return target;
end;
$$;

revoke all on function public.update_admin_resident(uuid, text, text, uuid, public.occupancy_type, boolean)
from public, anon;
grant execute on function public.update_admin_resident(uuid, text, text, uuid, public.occupancy_type, boolean)
to authenticated;

create or replace function public.create_admin_flat(target_tower_id uuid, requested_number text, requested_floor integer)
returns public.flats language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  tower public.towers%rowtype;
  result public.flats%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can create flats'; end if;
  select * into tower from public.towers where id = target_tower_id and society_id = actor.society_id;
  if tower.id is null then raise exception using errcode = '42501', message = 'Tower is not available to this admin'; end if;
  if nullif(btrim(requested_number), '') is null then raise exception using errcode = '22023', message = 'Flat number is required'; end if;
  if requested_floor not between 0 and tower.floors then raise exception using errcode = '22023', message = 'Flat floor must be within the tower'; end if;

  insert into public.flats (society_id, tower_id, number, floor)
  values (actor.society_id, tower.id, upper(btrim(requested_number)), requested_floor)
  returning * into result;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Added flat ' || result.number, tower.name);
  return result;
end;
$$;

create or replace function public.update_admin_flat(target_flat_id uuid, requested_number text, requested_floor integer)
returns public.flats language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.flats%rowtype;
  tower public.towers%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can edit flats'; end if;
  select * into target from public.flats where id = target_flat_id and society_id = actor.society_id for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Flat is not available to this admin'; end if;
  select * into tower from public.towers where id = target.tower_id and society_id = actor.society_id;
  if nullif(btrim(requested_number), '') is null then raise exception using errcode = '22023', message = 'Flat number is required'; end if;
  if requested_floor not between 0 and tower.floors then raise exception using errcode = '22023', message = 'Flat floor must be within the tower'; end if;

  update public.flats set number = upper(btrim(requested_number)), floor = requested_floor
  where id = target.id returning * into target;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Updated flat ' || target.number, tower.name);
  return target;
end;
$$;

create or replace function public.delete_empty_admin_flat(target_flat_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.flats%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can delete flats'; end if;
  select * into target from public.flats where id = target_flat_id and society_id = actor.society_id for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Flat is not available to this admin'; end if;

  if exists (select 1 from public.profiles where flat_id = target.id and society_id = actor.society_id)
  or exists (select 1 from public.visitor_requests where flat_id = target.id and society_id = actor.society_id)
  or exists (select 1 from public.complaints where flat_id = target.id and society_id = actor.society_id)
  or exists (select 1 from public.amenity_bookings where flat_id = target.id and society_id = actor.society_id)
  or exists (select 1 from public.maintenance_dues where flat_id = target.id and society_id = actor.society_id)
  or exists (select 1 from public.payments where flat_id = target.id and society_id = actor.society_id)
  then
    raise exception using errcode = '23503', message = 'This flat has residents or activity history and cannot be deleted';
  end if;

  delete from public.flats where id = target.id;
  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Deleted flat ' || target.number, 'Unused flat removed');
  return true;
end;
$$;

revoke all on function public.create_admin_flat(uuid, text, integer) from public, anon;
revoke all on function public.update_admin_flat(uuid, text, integer) from public, anon;
revoke all on function public.delete_empty_admin_flat(uuid) from public, anon;
grant execute on function public.create_admin_flat(uuid, text, integer) to authenticated;
grant execute on function public.update_admin_flat(uuid, text, integer) to authenticated;
grant execute on function public.delete_empty_admin_flat(uuid) to authenticated;
revoke insert, update, delete on public.flats from authenticated;

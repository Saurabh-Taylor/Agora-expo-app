create or replace function public.create_admin_tower(requested_name text, requested_floors integer, requested_units_per_floor integer)
returns public.towers language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.towers%rowtype;
  base_code text;
  candidate_code text;
  suffix integer := 1;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can create towers'; end if;
  if nullif(btrim(requested_name), '') is null then raise exception using errcode = '22023', message = 'Tower name is required'; end if;
  if requested_floors not between 1 and 100 or requested_units_per_floor not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Floors and flats per floor must be between 1 and 100';
  end if;

  base_code := upper(left(regexp_replace(requested_name, '[^a-zA-Z0-9]', '', 'g'), 2));
  if base_code = '' then base_code := 'TW'; end if;
  candidate_code := base_code;
  while exists (select 1 from public.towers where society_id = actor.society_id and code = candidate_code) loop
    suffix := suffix + 1;
    candidate_code := base_code || suffix::text;
  end loop;

  insert into public.towers (society_id, name, code, floors, units_per_floor)
  values (actor.society_id, btrim(requested_name), candidate_code, requested_floors, requested_units_per_floor)
  returning * into result;

  insert into public.flats (society_id, tower_id, number, floor)
  select actor.society_id, result.id, floor_number::text || lpad(unit_number::text, 2, '0'), floor_number
  from generate_series(1, requested_floors) as floors(floor_number)
  cross join generate_series(1, requested_units_per_floor) as units(unit_number);

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Added ' || result.name, (requested_floors * requested_units_per_floor)::text || ' flats created');
  return result;
end;
$$;

create or replace function public.update_admin_tower(target_tower_id uuid, requested_name text, requested_code text)
returns public.towers language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.towers%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can edit towers'; end if;
  select * into result from public.towers where id = target_tower_id and society_id = actor.society_id for update;
  if result.id is null then raise exception using errcode = '42501', message = 'Tower is not available to this admin'; end if;
  if nullif(btrim(requested_name), '') is null or nullif(btrim(requested_code), '') is null then
    raise exception using errcode = '22023', message = 'Tower name and code are required';
  end if;
  update public.towers set name = btrim(requested_name), code = upper(btrim(requested_code))
  where id = result.id returning * into result;
  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Updated ' || result.name, 'Tower details changed');
  return result;
end;
$$;

create or replace function public.delete_empty_admin_tower(target_tower_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.towers%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'ADMIN' then raise exception using errcode = '42501', message = 'Only society admins can delete towers'; end if;
  select * into target from public.towers where id = target_tower_id and society_id = actor.society_id for update;
  if target.id is null then raise exception using errcode = '42501', message = 'Tower is not available to this admin'; end if;

  if exists (
    select 1 from public.flats f join public.profiles p on p.flat_id = f.id and p.society_id = f.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) or exists (
    select 1 from public.visitor_requests x join public.flats f on f.id = x.flat_id and f.society_id = x.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) or exists (
    select 1 from public.complaints x join public.flats f on f.id = x.flat_id and f.society_id = x.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) or exists (
    select 1 from public.amenity_bookings x join public.flats f on f.id = x.flat_id and f.society_id = x.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) or exists (
    select 1 from public.maintenance_dues x join public.flats f on f.id = x.flat_id and f.society_id = x.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) or exists (
    select 1 from public.payments x join public.flats f on f.id = x.flat_id and f.society_id = x.society_id
    where f.tower_id = target.id and f.society_id = actor.society_id
  ) then
    raise exception using errcode = '23503', message = 'This tower has residents or activity history and cannot be deleted';
  end if;

  delete from public.towers where id = target.id;
  insert into public.audit_events (society_id, actor_id, action, detail)
  values (actor.society_id, actor.id, 'Deleted ' || target.name, 'Empty tower and generated flats removed');
  return true;
end;
$$;

revoke all on function public.create_admin_tower(text, integer, integer) from public, anon;
revoke all on function public.update_admin_tower(uuid, text, text) from public, anon;
revoke all on function public.delete_empty_admin_tower(uuid) from public, anon;
grant execute on function public.create_admin_tower(text, integer, integer) to authenticated;
grant execute on function public.update_admin_tower(uuid, text, text) to authenticated;
grant execute on function public.delete_empty_admin_tower(uuid) to authenticated;
revoke insert, update, delete on public.towers from authenticated;

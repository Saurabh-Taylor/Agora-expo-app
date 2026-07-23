do $$
begin
  if exists (
    select 1 from public.amenities
    where image_url is not null and btrim(image_url) <> ''
  ) then
    raise exception 'Legacy amenities.image_url data must be migrated before enabling amenity galleries';
  end if;
end
$$;

alter table public.amenities
add column image_paths text[] not null default '{}'::text[],
add constraint amenities_image_paths_limit_check
check (cardinality(image_paths) between 0 and 4);

alter table public.amenities drop column image_url;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('amenity-images', 'amenity-images', false, 4194304, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy amenity_images_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'amenity-images'
  and (select public.current_user_role()) = 'ADMIN'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
  and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and storage.extension(name) = 'jpg'
);

create policy amenity_images_authorized_select
on storage.objects for select to authenticated
using (
  bucket_id = 'amenity-images'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
  and (
    (select public.current_user_role()) = 'ADMIN'
    or (
      (select public.current_user_role()) = 'RESIDENT'
      and exists (
        select 1 from public.amenities amenity_row
        where amenity_row.society_id = (select public.current_society_id())
          and amenity_row.is_active
          and storage.objects.name = any(amenity_row.image_paths)
      )
    )
  )
);

create policy amenity_images_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'amenity-images'
  and (select public.current_user_role()) = 'ADMIN'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
);

create function public.set_admin_amenity_images(
  target_amenity_id uuid,
  requested_image_paths text[]
)
returns public.amenities
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.amenities%rowtype;
  clean_paths text[] := coalesce(requested_image_paths, '{}'::text[]);
  expected_pattern text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into actor
  from public.profiles
  where id = (select auth.uid()) and is_active;

  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only active society admins can manage amenity photos';
  end if;

  select * into target
  from public.amenities
  where id = target_amenity_id and society_id = actor.society_id
  for update;

  if target.id is null then
    raise exception using errcode = '42501', message = 'Amenity is not available to this admin';
  end if;

  if cardinality(clean_paths) > 4 then
    raise exception using errcode = '22023', message = 'An amenity can have at most 4 photos';
  end if;

  expected_pattern := '^' || actor.society_id::text || '/' || target.id::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$';

  if exists (
    select 1 from unnest(clean_paths) image_path
    where image_path is null
      or image_path <> btrim(image_path)
      or image_path !~ expected_pattern
  ) then
    raise exception using errcode = '22023', message = 'Amenity photo path is invalid';
  end if;

  if (select count(*) <> count(distinct image_path) from unnest(clean_paths) image_path) then
    raise exception using errcode = '22023', message = 'Amenity photos must be unique';
  end if;

  if exists (
    select 1 from unnest(clean_paths) image_path
    where not exists (
      select 1 from storage.objects object_row
      where object_row.bucket_id = 'amenity-images'
        and object_row.name = image_path
        and (object_row.owner_id = actor.id::text or object_row.owner = actor.id)
    )
  ) then
    raise exception using errcode = '22023', message = 'Amenity photo was not uploaded by this admin';
  end if;

  update public.amenities
  set image_paths = clean_paths, updated_at = statement_timestamp()
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.set_admin_amenity_images(uuid, text[]) from public, anon;
grant execute on function public.set_admin_amenity_images(uuid, text[]) to authenticated;

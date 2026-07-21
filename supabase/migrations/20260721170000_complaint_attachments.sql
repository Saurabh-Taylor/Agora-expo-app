alter table public.complaints
add column attachment_path text;

alter table public.complaints
add constraint complaints_attachment_path_format_check
check (
  attachment_path is null
  or attachment_path ~ ('^' || society_id::text || '/' || raised_by::text || '/[0-9a-f-]+\.(jpg|jpeg|png|webp|heic|heif)$')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-attachments',
  'complaint-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists complaint_attachments_resident_insert on storage.objects;
create policy complaint_attachments_resident_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'complaint-attachments'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select public.current_user_role()) = 'RESIDENT'
);

drop policy if exists complaint_attachments_authorized_select on storage.objects;
create policy complaint_attachments_authorized_select
on storage.objects for select to authenticated
using (
  bucket_id = 'complaint-attachments'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
  and (
    (
      (select public.current_user_role()) = 'RESIDENT'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (select public.current_user_role()) = 'ADMIN'
  )
);

drop policy if exists complaint_attachments_resident_delete on storage.objects;
create policy complaint_attachments_resident_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'complaint-attachments'
  and (storage.foldername(name))[1] = (select public.current_society_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select public.current_user_role()) = 'RESIDENT'
  and not exists (
    select 1
    from public.complaints complaint_row
    where complaint_row.attachment_path = storage.objects.name
      and complaint_row.society_id = (select public.current_society_id())
      and complaint_row.raised_by = (select auth.uid())
  )
);

create function public.create_resident_complaint_with_attachment(
  requested_title text,
  requested_description text,
  requested_category text,
  requested_attachment_path text
)
returns public.complaints language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  result public.complaints%rowtype;
  clean_category text;
  clean_attachment_path text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into actor from public.profiles where id = (select auth.uid()) and is_active;
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only active residents assigned to a flat can raise complaints';
  end if;
  if char_length(btrim(coalesce(requested_title, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Complaint title must be at least 2 characters';
  end if;
  if char_length(btrim(coalesce(requested_description, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Complaint description must be at least 2 characters';
  end if;
  clean_category := initcap(btrim(coalesce(requested_category, '')));
  if clean_category not in ('Plumbing', 'Electrical', 'Cleanliness', 'Security', 'Noise', 'Other') then
    raise exception using errcode = '22023', message = 'Complaint category is invalid';
  end if;

  clean_attachment_path := nullif(btrim(coalesce(requested_attachment_path, '')), '');
  if clean_attachment_path is not null then
    if clean_attachment_path !~ ('^' || actor.society_id::text || '/' || actor.id::text || '/[0-9a-f-]+\.(jpg|jpeg|png|webp|heic|heif)$') then
      raise exception using errcode = '22023', message = 'Complaint attachment path is invalid';
    end if;
    if not exists (
      select 1
      from storage.objects object_row
      where object_row.bucket_id = 'complaint-attachments'
        and object_row.name = clean_attachment_path
        and (object_row.owner_id = actor.id::text or object_row.owner = actor.id)
    ) then
      raise exception using errcode = '22023', message = 'Complaint attachment was not uploaded by this resident';
    end if;
  end if;

  insert into public.complaints (
    society_id, flat_id, raised_by, title, description, category, priority, status, attachment_path
  )
  values (
    actor.society_id,
    actor.flat_id,
    actor.id,
    btrim(requested_title),
    btrim(requested_description),
    clean_category,
    'MEDIUM',
    'OPEN',
    clean_attachment_path
  )
  returning * into result;

  insert into public.complaint_events (complaint_id, society_id, status, note, created_by, created_at)
  values (result.id, actor.society_id, 'OPEN', 'Complaint raised', actor.id, statement_timestamp());

  return result;
end;
$$;

revoke all on function public.create_resident_complaint_with_attachment(text, text, text, text) from public, anon;
grant execute on function public.create_resident_complaint_with_attachment(text, text, text, text) to authenticated;

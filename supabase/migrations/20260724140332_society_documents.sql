insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'society-documents',
  'society-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.society_documents (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('BYLAWS', 'MINUTES', 'POLICY', 'NOC', 'FORM', 'NOTICE', 'OTHER')),
  audience text not null check (audience in ('RESIDENT', 'GUARD', 'ALL')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  is_published boolean not null default false,
  uploaded_by uuid not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint society_documents_title_not_blank check (btrim(title) <> ''),
  constraint society_documents_file_name_not_blank check (btrim(file_name) <> ''),
  constraint society_documents_storage_path_scoped check (storage_path like society_id::text || '/%'),
  constraint society_documents_uploader_same_society_fkey foreign key (uploaded_by, society_id)
    references public.profiles(id, society_id)
);

create index society_documents_society_category_published_idx
  on public.society_documents (society_id, category, is_published, created_at desc)
  where archived_at is null;

alter table public.society_documents enable row level security;

create policy society_documents_scoped_select on public.society_documents
for select to authenticated
using (
  society_id = public.current_society_id()
  and (
    public.current_user_role() = 'ADMIN'
    or (
      archived_at is null
      and is_published
      and (
        audience = 'ALL'
        or audience = public.current_user_role()::text
      )
    )
  )
);

create policy society_documents_admin_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'society-documents'
  and public.current_user_role() = 'ADMIN'
  and split_part(name, '/', 1) = public.current_society_id()::text
);

create policy society_documents_authorized_download on storage.objects
for select to authenticated
using (
  bucket_id = 'society-documents'
  and split_part(name, '/', 1) = public.current_society_id()::text
  and exists (
    select 1 from public.society_documents document
    where document.society_id = public.current_society_id()
      and document.storage_path = name
      and (
        public.current_user_role() = 'ADMIN'
        or (
          document.archived_at is null
          and document.is_published
          and (
            document.audience = 'ALL'
            or document.audience = public.current_user_role()::text
          )
        )
      )
  )
);

create policy society_documents_admin_cleanup on storage.objects
for delete to authenticated
using (
  bucket_id = 'society-documents'
  and public.current_user_role() = 'ADMIN'
  and split_part(name, '/', 1) = public.current_society_id()::text
);

create or replace function public.create_admin_society_document(
  requested_title text,
  requested_description text,
  requested_category text,
  requested_audience text,
  requested_file_name text,
  requested_storage_path text,
  requested_mime_type text,
  requested_file_size integer,
  requested_published boolean
)
returns public.society_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  created_document public.society_documents;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can upload documents';
  end if;
  if btrim(coalesce(requested_title, '')) = ''
    or btrim(coalesce(requested_file_name, '')) = ''
    or requested_category not in ('BYLAWS', 'MINUTES', 'POLICY', 'NOC', 'FORM', 'NOTICE', 'OTHER')
    or requested_audience not in ('RESIDENT', 'GUARD', 'ALL')
    or requested_file_size is null or requested_file_size <= 0 or requested_file_size > 10485760
    or requested_published is null
    or requested_storage_path not like actor.society_id::text || '/%'
  then
    raise exception using errcode = '22023', message = 'Enter valid society document details';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'society-documents' and name = requested_storage_path
  ) then
    raise exception using errcode = 'P0002', message = 'Uploaded society document file was not found';
  end if;

  insert into public.society_documents (
    society_id, title, description, category, audience, file_name,
    storage_path, mime_type, file_size, is_published, uploaded_by
  ) values (
    actor.society_id, btrim(requested_title), nullif(btrim(requested_description), ''),
    requested_category, requested_audience, btrim(requested_file_name),
    requested_storage_path, requested_mime_type, requested_file_size,
    requested_published, actor.id
  ) returning * into created_document;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'SOCIETY_DOCUMENT_CREATED',
    jsonb_build_object('document_id', created_document.id, 'title', created_document.title)
  );
  return created_document;
end;
$$;

create or replace function public.update_admin_society_document(
  target_document_id uuid,
  requested_title text,
  requested_description text,
  requested_category text,
  requested_audience text,
  requested_published boolean
)
returns public.society_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  updated_document public.society_documents;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can update documents';
  end if;
  if btrim(coalesce(requested_title, '')) = ''
    or requested_category not in ('BYLAWS', 'MINUTES', 'POLICY', 'NOC', 'FORM', 'NOTICE', 'OTHER')
    or requested_audience not in ('RESIDENT', 'GUARD', 'ALL')
    or requested_published is null
  then
    raise exception using errcode = '22023', message = 'Enter valid society document details';
  end if;

  update public.society_documents
  set title = btrim(requested_title),
      description = nullif(btrim(requested_description), ''),
      category = requested_category,
      audience = requested_audience,
      is_published = requested_published,
      updated_at = now()
  where id = target_document_id and society_id = actor.society_id and archived_at is null
  returning * into updated_document;
  if updated_document.id is null then
    raise exception using errcode = 'P0002', message = 'Active society document not found';
  end if;
  return updated_document;
end;
$$;

create or replace function public.archive_admin_society_document(target_document_id uuid)
returns public.society_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  archived_document public.society_documents;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Only society admins can archive documents';
  end if;

  update public.society_documents
  set archived_at = now(), is_published = false, updated_at = now()
  where id = target_document_id and society_id = actor.society_id and archived_at is null
  returning * into archived_document;
  if archived_document.id is null then
    raise exception using errcode = 'P0002', message = 'Active society document not found';
  end if;

  insert into public.audit_events (society_id, actor_id, action, detail)
  values (
    actor.society_id, actor.id, 'SOCIETY_DOCUMENT_ARCHIVED',
    jsonb_build_object('document_id', archived_document.id, 'title', archived_document.title)
  );
  return archived_document;
end;
$$;

revoke all on public.society_documents from anon, authenticated;
grant select on public.society_documents to authenticated;
revoke all on function public.create_admin_society_document(text, text, text, text, text, text, text, integer, boolean) from public, anon;
revoke all on function public.update_admin_society_document(uuid, text, text, text, text, boolean) from public, anon;
revoke all on function public.archive_admin_society_document(uuid) from public, anon;
grant execute on function public.create_admin_society_document(text, text, text, text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.update_admin_society_document(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.archive_admin_society_document(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'society_documents'
    )
  then alter publication supabase_realtime add table public.society_documents;
  end if;
end;
$$;

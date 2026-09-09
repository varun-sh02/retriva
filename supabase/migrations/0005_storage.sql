-- Retriva: private "documents" Storage bucket + path-prefix RLS policies.
-- Layout (docs/data-model.md §6): documents/ws/{workspace_id}/kb/{knowledge_base_id}/{document_id}/...
-- storage.foldername(name) splits the object path into folder segments, so
-- for that layout, segment [2] is the workspace_id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB, matches documents.size_bytes CHECK in 0004_documents.sql
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_bucket_select_own" on storage.objects;
create policy "documents_bucket_select_own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

drop policy if exists "documents_bucket_insert_own" on storage.objects;
create policy "documents_bucket_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

drop policy if exists "documents_bucket_update_own" on storage.objects;
create policy "documents_bucket_update_own"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

drop policy if exists "documents_bucket_delete_own" on storage.objects;
create policy "documents_bucket_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

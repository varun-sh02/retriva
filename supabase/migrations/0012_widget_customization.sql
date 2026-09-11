-- Retriva: widget customization — avatar, description, and suggested-prompt
-- chips shown on the public widget's intro card
-- (src/components/chat/PublicChat.tsx) before the visitor reaches chat.

alter table public.knowledge_bases
  add column if not exists public_avatar_path text,
  add column if not exists public_description text
    check (public_description is null or char_length(public_description) <= 500),
  add column if not exists public_suggested_prompts jsonb not null default '[]'
    check (
      jsonb_typeof(public_suggested_prompts) = 'array'
      and jsonb_array_length(public_suggested_prompts) <= 4
    );

-- Unlike the "documents" bucket (0005_storage.sql), avatars must be readable
-- by anonymous widget visitors on third-party sites with no auth at all, so
-- the bucket itself is public — Supabase serves public-bucket objects with
-- no RLS check on read. Writes stay owner-only, same path-prefix pattern
-- keyed on workspace_id as "documents" uses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_bucket_insert_own" on storage.objects;
create policy "avatars_bucket_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

drop policy if exists "avatars_bucket_update_own" on storage.objects;
create policy "avatars_bucket_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

drop policy if exists "avatars_bucket_delete_own" on storage.objects;
create policy "avatars_bucket_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2]::uuid in (select public.current_workspace_ids())
  );

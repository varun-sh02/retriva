-- Retriva: documents (docs/data-model.md §2), plus the knowledge_base_stats
-- view deferred from 0003 (it needed this table to exist first).

-- Required so the composite FK below can reference (id, workspace_id) as a
-- pair — id alone is already the primary key, but Postgres still requires an
-- explicit unique constraint on the exact column set a composite FK targets.
alter table public.knowledge_bases
  add constraint knowledge_bases_id_workspace_key unique (id, workspace_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null,
  workspace_id uuid not null,
  name text not null check (char_length(name) between 1 and 255),
  mime_type text not null,
  content_type text not null check (
    content_type in ('pdf', 'docx', 'text', 'markdown', 'image', 'video')
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_path text not null,
  checksum text,
  status text not null default 'UPLOADING' check (
    status in ('UPLOADING', 'PROCESSING', 'READY', 'FAILED')
  ),
  stage text check (
    stage is null
    or stage in ('PENDING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'DONE')
  ),
  stage_cursor jsonb not null default '{}'::jsonb,
  error_message text,
  gemini_file_uri text,
  gemini_file_expires_at timestamptz,
  chunk_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ties knowledge_base_id and workspace_id together: a row can never claim
  -- a knowledge_base_id/workspace_id pair that doesn't actually exist
  -- together on knowledge_bases (docs/data-model.md §5).
  constraint documents_kb_workspace_fkey
    foreign key (knowledge_base_id, workspace_id)
    references public.knowledge_bases (id, workspace_id)
    on delete cascade
);

create index if not exists documents_kb_created_idx
  on public.documents (knowledge_base_id, created_at desc);

create index if not exists documents_workspace_idx
  on public.documents (workspace_id);

create index if not exists documents_in_flight_idx
  on public.documents (status)
  where status in ('UPLOADING', 'PROCESSING');

create unique index if not exists documents_kb_checksum_key
  on public.documents (knowledge_base_id, checksum)
  where checksum is not null;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents for select
  using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents for update
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents for delete
  using (workspace_id in (select public.current_workspace_ids()));

-- Deferred from 0003_knowledge_bases.sql: real per-KB document counts, now
-- that documents exists. api/knowledge-bases routes and list-knowledge-bases.ts
-- switch from hardcoded 0s to this view in this same task (TASK-014).
-- security_invoker: without it, a view runs with its owner's privileges
-- rather than the querying user's, silently bypassing RLS on the underlying
-- tables — the opposite of what a view exposed to the anon/publishable-key
-- client must do.
create or replace view public.knowledge_base_stats
  with (security_invoker = true) as
select
  kb.id as knowledge_base_id,
  count(d.id) as document_count,
  count(d.id) filter (where d.status = 'READY') as ready_count,
  count(d.id) filter (where d.status = 'PROCESSING' or d.status = 'UPLOADING') as processing_count,
  count(d.id) filter (where d.status = 'FAILED') as failed_count
from public.knowledge_bases kb
left join public.documents d on d.knowledge_base_id = kb.id
group by kb.id;

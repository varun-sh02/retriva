-- Retriva: chunks (docs/data-model.md §2). Authoritative chunk text lives
-- here in Postgres — Qdrant holds vectors + filter payload only (ADR-006).

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  knowledge_base_id uuid not null,
  workspace_id uuid not null,
  chunk_index int not null,
  content text not null,
  content_type text not null check (
    content_type in ('pdf', 'docx', 'text', 'markdown', 'image', 'video')
  ),
  page_number int,
  start_timestamp numeric(10, 2),
  end_timestamp numeric(10, 2),
  section_path text,
  embedding_model text,
  embedding_dim int,
  vector_kind text not null default 'text' check (vector_kind in ('text', 'image')),
  qdrant_point_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chunks_document_fkey
    foreign key (document_id) references public.documents (id) on delete cascade,
  constraint chunks_kb_workspace_fkey
    foreign key (knowledge_base_id, workspace_id)
    references public.knowledge_bases (id, workspace_id) on delete cascade,

  constraint chunks_page_number_pdf_only
    check (page_number is null or content_type = 'pdf'),
  constraint chunks_timestamps_paired
    check ((start_timestamp is null) = (end_timestamp is null))
);

create unique index if not exists chunks_document_index_kind_key
  on public.chunks (document_id, chunk_index, vector_kind);

create index if not exists chunks_knowledge_base_idx on public.chunks (knowledge_base_id);
create index if not exists chunks_document_idx on public.chunks (document_id);
create index if not exists chunks_workspace_idx on public.chunks (workspace_id);

alter table public.chunks enable row level security;

drop policy if exists "chunks_select_own" on public.chunks;
create policy "chunks_select_own"
  on public.chunks for select
  using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "chunks_insert_own" on public.chunks;
create policy "chunks_insert_own"
  on public.chunks for insert
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "chunks_update_own" on public.chunks;
create policy "chunks_update_own"
  on public.chunks for update
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "chunks_delete_own" on public.chunks;
create policy "chunks_delete_own"
  on public.chunks for delete
  using (workspace_id in (select public.current_workspace_ids()));

-- Append-only ingestion audit (docs/data-model.md §2) — powers the failure
-- UI and post-hoc debugging. Never exposed in the normal product UI.
create table if not exists public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  workspace_id uuid not null,
  stage text not null,
  outcome text not null check (outcome in ('success', 'failure')),
  error text,
  attempt int not null default 1,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists processing_runs_document_idx
  on public.processing_runs (document_id, created_at desc);

alter table public.processing_runs enable row level security;

drop policy if exists "processing_runs_select_own" on public.processing_runs;
create policy "processing_runs_select_own"
  on public.processing_runs for select
  using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "processing_runs_insert_own" on public.processing_runs;
create policy "processing_runs_insert_own"
  on public.processing_runs for insert
  with check (workspace_id in (select public.current_workspace_ids()));

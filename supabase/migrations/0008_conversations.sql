-- Retriva: conversations, messages, citations, retrieval_logs (docs/data-model.md §2).

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null,
  workspace_id uuid not null,
  title text,
  summary text,
  summarized_through int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversations_kb_workspace_fkey
    foreign key (knowledge_base_id, workspace_id)
    references public.knowledge_bases (id, workspace_id) on delete cascade
);

create index if not exists conversations_kb_updated_idx
  on public.conversations (knowledge_base_id, updated_at desc);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

alter table public.conversations enable row level security;

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own" on public.conversations for select
  using (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations for insert
  with check (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own" on public.conversations for update
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations for delete
  using (workspace_id in (select public.current_workspace_ids()));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  usage jsonb,
  interrupted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages for select
  using (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert
  with check (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages for update
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  chunk_id uuid references public.chunks (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  source_label text not null,
  excerpt text not null,
  score numeric
);

create index if not exists citations_message_idx on public.citations (message_id);

alter table public.citations enable row level security;

-- Scoped through the parent message's workspace rather than duplicating a
-- workspace_id column here — a citation has no independent existence.
drop policy if exists "citations_select_own" on public.citations;
create policy "citations_select_own" on public.citations for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = citations.message_id
        and m.workspace_id in (select public.current_workspace_ids())
    )
  );
drop policy if exists "citations_insert_own" on public.citations;
create policy "citations_insert_own" on public.citations for insert
  with check (
    exists (
      select 1 from public.messages m
      where m.id = citations.message_id
        and m.workspace_id in (select public.current_workspace_ids())
    )
  );

-- Append-only, never returned to the browser (docs/rag-pipeline.md §9).
create table if not exists public.retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  knowledge_base_id uuid not null,
  workspace_id uuid not null,
  raw_query text not null,
  rewritten_query text,
  retrieved jsonb not null default '[]'::jsonb,
  context_source_map jsonb not null default '{}'::jsonb,
  model text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists retrieval_logs_kb_created_idx
  on public.retrieval_logs (knowledge_base_id, created_at desc);

alter table public.retrieval_logs enable row level security;

drop policy if exists "retrieval_logs_select_own" on public.retrieval_logs;
create policy "retrieval_logs_select_own" on public.retrieval_logs for select
  using (workspace_id in (select public.current_workspace_ids()));
drop policy if exists "retrieval_logs_insert_own" on public.retrieval_logs;
create policy "retrieval_logs_insert_own" on public.retrieval_logs for insert
  with check (workspace_id in (select public.current_workspace_ids()));

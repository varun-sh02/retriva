-- Retriva: knowledge_bases (docs/data-model.md §2).
-- knowledge_base_stats (document/ready/processing/failed counts) is added in
-- 0004_documents.sql once the documents table it depends on exists.

create table if not exists public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness catches both exact duplicates ("Foo" twice)
-- and case-variant duplicates ("Product Research" vs "product research").
create unique index if not exists knowledge_bases_workspace_lower_name_key
  on public.knowledge_bases (workspace_id, lower(name));

create index if not exists knowledge_bases_workspace_updated_idx
  on public.knowledge_bases (workspace_id, updated_at desc);

drop trigger if exists knowledge_bases_set_updated_at on public.knowledge_bases;
create trigger knowledge_bases_set_updated_at
  before update on public.knowledge_bases
  for each row
  execute function public.set_updated_at();

alter table public.knowledge_bases enable row level security;

drop policy if exists "knowledge_bases_select_own" on public.knowledge_bases;
create policy "knowledge_bases_select_own"
  on public.knowledge_bases for select
  using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "knowledge_bases_insert_own" on public.knowledge_bases;
create policy "knowledge_bases_insert_own"
  on public.knowledge_bases for insert
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "knowledge_bases_update_own" on public.knowledge_bases;
create policy "knowledge_bases_update_own"
  on public.knowledge_bases for update
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

drop policy if exists "knowledge_bases_delete_own" on public.knowledge_bases;
create policy "knowledge_bases_delete_own"
  on public.knowledge_bases for delete
  using (workspace_id in (select public.current_workspace_ids()));

-- Retriva: RLS enablement + shared helper (docs/data-model.md §7, docs/security.md).
-- Every application table gets RLS enabled here or in its own migration.
-- current_workspace_ids() is SECURITY DEFINER so per-table policies stay a
-- single readable subquery rather than a repeated join, and so its plan is
-- cached rather than re-planned per policy.

create or replace function public.current_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.workspaces where owner_id = auth.uid();
$$;

alter table public.workspaces enable row level security;

drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
  on public.workspaces for select
  using (owner_id = auth.uid());

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
  on public.workspaces for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Insert is intentionally NOT open to authenticated users at large: a
-- workspace is created only by ensureWorkspace() via the session-bound
-- client, and owner_id = auth.uid() is enforced by this check so a request
-- can never create a workspace it does not own.
drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

-- No delete policy: workspace deletion is out of MVP scope (spec has no
-- "delete my account" flow) and cascades from auth.users deletion instead,
-- which runs as the owning role, not through RLS.

-- Retriva: workspaces
-- One workspace per user for the MVP (docs/data-model.md §2, ADR-012).
-- Dropping the UNIQUE(owner_id) constraint later is the entire schema change
-- needed to support multiple workspaces per user.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_owner_id_key unique (owner_id)
);

create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row
  execute function public.set_updated_at();

-- Retriva: fixed-window rate limiting (docs/security.md T7) — no Redis,
-- a counter row per (workspace, window) bucket is enough at demo scale.

create table if not exists public.rate_limit_counters (
  workspace_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (workspace_id, bucket, window_start)
);

alter table public.rate_limit_counters enable row level security;

-- No client ever reads or writes this table directly; only server-side
-- code via the session-bound client on behalf of the current user's own
-- workspace, mirroring every other table's ownership pattern.
drop policy if exists "rate_limit_counters_own" on public.rate_limit_counters;
create policy "rate_limit_counters_own"
  on public.rate_limit_counters for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

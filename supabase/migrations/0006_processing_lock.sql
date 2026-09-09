-- Retriva: processing_lock for the ingestion state machine (TASK-023).
-- Not in the original documents column list (docs/data-model.md §2) — added
-- here once the state machine actually needed concurrency control. A stale
-- lock (>6 minutes old) is treated as abandoned and reclaimable.

alter table public.documents
  add column if not exists processing_lock timestamptz;

create index if not exists documents_processing_lock_idx
  on public.documents (processing_lock)
  where processing_lock is not null;

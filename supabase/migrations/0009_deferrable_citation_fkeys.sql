-- Fixes a real bug found by testing: deleting a user (cascading through
-- workspaces -> knowledge_bases -> {documents -> chunks, conversations ->
-- messages -> citations}) intermittently failed with
-- "citations_message_id_fkey ... is not present in table messages" — a
-- classic Postgres cascade-ordering hazard. citations depends on BOTH
-- messages (ON DELETE CASCADE) and chunks (ON DELETE SET NULL), and both
-- parents are deleted in the same statement via sibling branches of the
-- same cascade. Making the FKs DEFERRABLE INITIALLY DEFERRED resolves all
-- cascade actions before constraints are checked, which is the standard
-- fix for this class of problem.

alter table public.citations
  drop constraint citations_message_id_fkey,
  add constraint citations_message_id_fkey
    foreign key (message_id) references public.messages (id)
    on delete cascade
    deferrable initially deferred;

alter table public.citations
  drop constraint citations_chunk_id_fkey,
  add constraint citations_chunk_id_fkey
    foreign key (chunk_id) references public.chunks (id)
    on delete set null
    deferrable initially deferred;

alter table public.citations
  drop constraint citations_document_id_fkey,
  add constraint citations_document_id_fkey
    foreign key (document_id) references public.documents (id)
    on delete set null
    deferrable initially deferred;

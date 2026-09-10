-- Retriva: public share links for the embeddable widget.
--
-- A knowledge base is private until its owner explicitly opts in. Opting in
-- mints an unguessable token; the token is the ONLY thing a visitor ever
-- sends, and the server resolves it to (workspace_id, knowledge_base_id)
-- itself. No public request carries a workspace or knowledge base id, so the
-- tenant-isolation contract in docs/security.md T1 is preserved unchanged:
-- ids still come from the server, they are just derived from a share token
-- instead of a session.

alter table public.knowledge_bases
  add column if not exists public_enabled boolean not null default false,
  add column if not exists public_share_token text,
  add column if not exists public_greeting text
    check (public_greeting is null or char_length(public_greeting) <= 300);

-- Unique so a token resolves to exactly one knowledge base; partial so the
-- many rows with no token do not collide on null.
create unique index if not exists knowledge_bases_public_share_token_key
  on public.knowledge_bases (public_share_token)
  where public_share_token is not null;

-- Belt and braces: a row can never be publicly enabled without a token to
-- reach it by, so "enabled" can never mean "reachable without one".
alter table public.knowledge_bases
  drop constraint if exists knowledge_bases_public_requires_token;
alter table public.knowledge_bases
  add constraint knowledge_bases_public_requires_token
  check (public_enabled = false or public_share_token is not null);

-- Identifies the anonymous visitor that owns a widget conversation. Null for
-- conversations created by the signed-in owner in the app.
--
-- This is what stops one visitor reading another's thread: a public request
-- may only continue a conversation whose visitor_id matches the one it sent.
-- Without it, knowing a conversation id would be enough, since every widget
-- visitor to a given knowledge base is otherwise indistinguishable.
alter table public.conversations
  add column if not exists visitor_id text;

create index if not exists conversations_visitor_idx
  on public.conversations (knowledge_base_id, visitor_id)
  where visitor_id is not null;

-- The owner's own chat view lists conversations by knowledge base and would
-- otherwise surface visitors' threads as if they were the owner's own.
create index if not exists conversations_owner_kb_updated_idx
  on public.conversations (knowledge_base_id, updated_at desc)
  where visitor_id is null;

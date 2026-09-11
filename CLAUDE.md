@AGENTS.md

# Retriva

A RAG (retrieval-augmented generation) knowledge-base chat app: upload documents (PDF/DOCX/TXT/MD/image/video), ask questions, get streamed answers grounded in cited chunks of your own content. Owners can also expose a knowledge base as an embeddable public chat widget.

## Architecture at a glance

Single Next.js (App Router, Vercel) deployable — Route Handlers are the only API layer. No separate backend, no LangChain (ADR-010), no Redis/queue. Four external systems, one job each:

- **Supabase Postgres** — all metadata + the authoritative chunk text. RLS via `current_workspace_ids()` everywhere, but that's defense in depth, never the only check — every route also does an explicit `workspace_id` filter server-side (`docs/security.md` T1).
- **Supabase Storage** — original uploaded files (`documents` bucket, private) and widget avatars (`avatars` bucket, public).
- **Qdrant Cloud** — vector search only. Holds chunk IDs + a `workspace_id`/`knowledge_base_id` filter payload, never chunk text.
- **Gemini API** — understanding, embedding, generation. Its Files API is 48h scratch space, never durable storage.

**Auth**: `src/proxy.ts` (this Next.js version renamed `middleware.ts` → `proxy.ts` — see `AGENTS.md`) refreshes the Supabase session/rotates cookies on every request. Route handlers call `requireSession()`, which uses `getUser()` (re-verifies against Supabase Auth) and never `getSession()` for authorization. `workspace_id` is always resolved from the verified user server-side, never accepted from request input.

**Upload → ingestion**: `POST /api/documents/upload-url` validates + inserts a `documents` row (`status: UPLOADING`) → browser PUTs directly to Storage via a signed URL (bypasses Vercel's 4.5MB body cap) → `/confirm` re-verifies real size/MIME/checksum server-side → a checkpointed state machine (`stage`: `PENDING → EXTRACTING → CHUNKING → EMBEDDING → INDEXING → DONE`) advances **one stage per `/process` call**, client polls `/status` — because Vercel's function timeout can't cover a whole pipeline in one call. Per-modality logic lives in `src/lib/ingestion/`: PDF (Gemini vision, page-tagged), DOCX (`mammoth`), TXT/MD (direct read), image (Gemini vision description/OCR + a native image vector alongside its text record), video (Gemini Files + timestamped segments — transcript-only, no native video vectors, ADR-015).

**Chat / RAG** (`src/lib/chat/`): rewrite the query (skipped on the first turn or a long self-contained question) → embed with `gemini-embedding-2` (1536-d, cosine) → Qdrant search (mandatory `workspace_id` + `knowledge_base_id` filter, topK 8, scoreThreshold 0.35, max 3 chunks/document) → **hydrate chunk text from Postgres**, never trust Qdrant's payload for content → build a server-owned `SOURCE_n → chunk_id` map → stream the answer from Gemini → parse `[SOURCE_n]` tokens against that map only (filenames/pages/timestamps always come from Postgres, never the model) → persist message + citations + a retrieval log (`retrieval_logs`, append-only, feeds evals, never returned to the browser). Conversation memory: last 10 messages verbatim + a rolling summary past 20.

**Public widget**: a share token (`knowledge_bases.public_share_token`) is the only thing a visitor ever sends. `resolvePublicShare()` (`src/lib/auth/public-share.ts`, service-role client — anonymous visitors have no session for RLS) is the single chokepoint turning it into real ids; no public endpoint ever accepts a workspace/KB id directly. `public/widget.js` is a static file the owner pastes as a `<script>` tag; it lazily loads `/embed/[token]` in a sandboxed iframe on first click, same-origin to Retriva (no CORS, no third-party cookie).

## Data model

Tables (see `docs/data-model.md` for full column detail, with the drift caveat below): `workspaces`, `knowledge_bases`, `documents`, `chunks` (id doubles as the Qdrant point id), `conversations`, `messages`, `citations` (`ON DELETE SET NULL`, not cascaded — a deleted document's historical citation still shows what it was based on via a snapshotted excerpt), `processing_runs` (append-only ingestion audit), `retrieval_logs`, `rate_limits`, `schema_migrations`.

`workspace_id` is deliberately denormalized onto documents/chunks/conversations/messages — cheap single-table RLS, Qdrant needs it directly in the filter, one-predicate deletion. Deletion order is **Qdrant → Storage → Postgres**: an orphaned Postgres row is visible and repairable, an orphaned vector is invisible garbage that still matches searches.

## Features implemented

**Core**
- Knowledge base CRUD, workspace-scoped
- Document upload + 5-modality ingestion pipeline (PDF/DOCX/TXT/MD/image/video), resumable and checkpointed
- RAG chat with streaming answers, deterministic citations, conversation memory
- Public share links + embeddable widget
- Per-workspace rate limiting (Postgres fixed-window)
- Eval suite (`evals/*.eval.ts`): citations, tenant isolation, multimodal image retrieval, negative cases

**Local dev auth bypass** — `NEXT_PUBLIC_DEV_AUTH_BYPASS` (set in `.env.local`, deliberately unset on Vercel) swaps the sign-in form to email+password locally instead of Supabase magic-link, since the magic-link redirect is pinned to the production domain and can't round-trip to localhost. `src/app/(auth)/sign-in/page.tsx`, `src/lib/config/client-env.ts`.

**Chat history** — `/app/knowledge-bases/[kbId]/chat` (most recent conversation), `/chat/new` (blank composer), `/chat/[conversationId]` (a specific past conversation), plus a history sidebar with a "New chat" action (`components/chat/ConversationSidebar.tsx`, `ChatPageLayout.tsx`, `lib/chat/list-messages.ts`'s `listConversations`).

**Widget customization** — avatar upload (public `avatars` Storage bucket, migration `0012_widget_customization.sql`), greeting, description, and up to 4 "quick guide" suggested-prompt buttons, all shown on a two-state intro/chat widget (`components/chat/PublicChat.tsx`) with a "Powered by Retriva" footer. Owner-side controls live on their own "Widget" tab (`KnowledgeBaseNav.tsx`) next to Documents/Chat. Everything is fetched fresh on each widget open (`/embed/[token]` is `force-dynamic`), so changes reach the embedder's site immediately with no re-embed needed.

## Known gaps / doc drift

- `docs/architecture.md`, `docs/data-model.md`, `docs/task-breakdown.md` etc. are Phase-0 planning documents written before implementation and have since drifted from the real code in places (e.g. they describe `middleware.ts`; the actual file is `src/proxy.ts`, and some migration filenames differ from the plan). Trust the repo over these docs when they disagree.
- No test framework (`jest`/`vitest`/`playwright`) is installed — verification is `typecheck` / `lint` / `build` / `preflight` only.
- No dedicated `src/lib/observability/` module despite one being described in the architecture doc.

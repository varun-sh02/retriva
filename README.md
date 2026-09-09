# Retriva

A multimodal, multi-tenant RAG knowledge workspace.

> Upload your knowledge. Ask anything. See the evidence.

Create isolated knowledge bases, upload PDFs/DOCX/text/Markdown/images/video, and ask questions that are answered strictly from your own uploaded content — every claim comes with a citation you can click open to see the exact page, timestamp, or excerpt it came from.

Architecture, data model, RAG pipeline, and the full implementation plan live in [`/docs`](./docs) — start with [`docs/architecture.md`](./docs/architecture.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · shadcn/ui (Base UI) · Supabase (Auth/Postgres/Storage) · Qdrant Cloud · Gemini API (`@google/genai`, `gemini-3.5-flash-lite` + `gemini-embedding-2`) · Zod.

## Setup

1. **Create the external services** (all have a free tier):
   - A [Supabase](https://supabase.com) project.
   - A [Qdrant Cloud](https://cloud.qdrant.io) cluster.
   - A [Google AI Studio](https://aistudio.google.com) API key.

2. **Install and configure:**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Fill in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` — Supabase dashboard → Project Settings → API keys. (Retriva uses Supabase's newer `publishable`/`secret` key pair, not the legacy `anon`/`service_role` names — see `docs/technical-decisions.md` ADR-014 addendum.)
   - `DATABASE_URL` — Project Settings → Database → Connection string (URI). Only used by the migration/cleanup scripts below, never by the app itself.
   - `GEMINI_API_KEY` — Google AI Studio.
   - `QDRANT_URL`, `QDRANT_API_KEY` — Qdrant Cloud cluster details.
   - Leave `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_EMBEDDING_MODEL`, `QDRANT_COLLECTION` at their `.env.example` defaults unless you have a specific reason to change them.

3. **Run migrations and bootstrap Qdrant:**

   ```bash
   npx tsx scripts/run-migrations.ts    # applies supabase/migrations/*.sql in order, idempotently
   npx tsx scripts/bootstrap-qdrant.ts  # creates the Qdrant collection + payload indexes, idempotently
   ```

4. **Verify everything is actually reachable, not just configured:**

   ```bash
   npm run preflight
   ```

   This calls the real Gemini and Qdrant APIs — it fails loudly (naming exactly what's wrong) rather than letting a bad config surface later as a confusing 500.

5. **Run it:**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign in with your email (a magic link is sent — no password), create a knowledge base, upload a document, and ask it a question once the document shows `READY`.

## Scripts

```bash
npm run dev              # start the dev server
npm run build             # production build (also runs TypeScript's own type-check)
npm run lint               # ESLint
npm run typecheck            # tsc --noEmit
npm run preflight              # verify env + live Gemini/Qdrant access
npx tsx scripts/run-migrations.ts     # apply pending SQL migrations
npx tsx scripts/bootstrap-qdrant.ts   # create/verify the Qdrant collection
npx tsx scripts/cleanup.ts            # sweep orphaned uploads + stale processing locks (see Limitations)
```

### Running the eval suites

`/evals` contains real, permanent end-to-end test suites (no mocks — they exercise the actual dev server, Supabase, Qdrant, and Gemini). The dev server must be running first:

```bash
npm run dev &
NODE_OPTIONS="--conditions=react-server" npx tsx evals/isolation.eval.ts        # tenant isolation — release gate
NODE_OPTIONS="--conditions=react-server" npx tsx evals/citations.eval.ts        # citation determinism — release gate
NODE_OPTIONS="--conditions=react-server" npx tsx evals/negative.eval.ts         # refusal / false-refusal balance
NODE_OPTIONS="--conditions=react-server" npx tsx evals/multimodal-images.eval.ts # image ingestion + retrieval
```

Each creates and tears down its own throwaway test users — safe to run against a real project.

## Known limitations

These are real, deliberate MVP boundaries, not oversights — see `docs/implementation-plan.md` for the reasoning:

- **50 MB per file.** Enforced by the Supabase free-tier storage limit and the app's own validation. A demo video should be a few minutes long, not a full recording.
- **Processing pauses if you close the tab mid-upload.** Ingestion advances one stage per request, driven by the browser while the tab is open (docs/technical-decisions.md ADR-007). Reopening the document's knowledge base auto-resumes it; a `FAILED` document also has an explicit **Retry** button that force-restarts the whole pipeline from scratch.
- **No background workers or queues.** By design (see the spec's non-goals) — everything runs inside Next.js Route Handlers, bounded by Vercel's function duration limit (5 minutes on Hobby).
- **Free-tier rate limits are shared across the whole project.** Gemini generation is roughly 15 requests/minute; embeddings roughly 100/minute. A burst of uploads or chat messages can hit these — the app also applies its own, more generous per-workspace limits (20 chat messages/minute, 10 concurrently-processing documents) so one workspace can't starve another.
- **The Qdrant free cluster suspends after ~1 week of inactivity** and can take a moment to wake back up (or need manual resuming from the Qdrant Cloud dashboard) if the project has been idle. `npm run preflight` will tell you immediately if this has happened.
- **Video ingestion is fully implemented but not end-to-end proven against real footage in this repository's own development environment** (no video encoder was available there to produce a decodable test file) — the pipeline (Gemini Files API upload, segmentation, real container-duration parsing, timestamp validation, evidence-drawer seeking) is built and unit-tested at every layer that doesn't require an actual video codec. Upload one real `.mp4`/`.mov` and confirm end-to-end before relying on it for a demo.
- **DOCX tables** are flattened to plain text by the current extraction library; headings and lists are preserved correctly. See `docs/multimodal-ingestion.md` §2.

## Project structure

```text
src/
├── app/            # Next.js App Router — pages and API routes
├── components/      # UI components (never import server-only modules — enforced by ESLint)
├── hooks/             # client-side hooks (useChatStream)
└── lib/
    ├── auth/             # session + ownership resolution
    ├── chat/               # prompt construction, citation extraction
    ├── config/              # env validation, RAG defaults
    ├── db/                    # Supabase clients (browser / session-bound server / secret-key)
    ├── gemini/                 # Gemini client, embeddings, Files API
    ├── ingestion/                # per-modality extractors, chunker, the processing state machine
    ├── qdrant/                     # vector search/upsert/delete — tenant scope is a required argument
    ├── ratelimit/                    # fixed-window rate limiting
    ├── retrieval/                     # query normalization, rewriting, retrieval
    └── storage/                        # MIME detection, storage paths

supabase/migrations/   # SQL migrations, applied in order by scripts/run-migrations.ts
evals/                  # permanent end-to-end eval suites (see above)
scripts/                  # preflight, migrations, Qdrant bootstrap, cleanup sweep
docs/                       # architecture, data model, RAG pipeline, security, full implementation plan
```

## Status

Implementation follows [`docs/task-breakdown.md`](./docs/task-breakdown.md), which decomposes [`docs/implementation-plan.md`](./docs/implementation-plan.md)'s 14 phases into individually-shippable tasks. As of this writing, Phases 1–12 (foundation through the evaluation baseline) are complete and verified against live services; Phase 13 (UI polish) and Phase 14 (hardening) are substantially complete — see the two files above for what remains.

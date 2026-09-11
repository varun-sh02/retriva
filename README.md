# Retriva

**Every answer, traced to the source.**

Retriva is a multimodal, multi-tenant RAG knowledge workspace. You add the material you
already have — PDFs, Word documents, text, Markdown and images, with **recordings coming
soon** — and ask questions about it in plain language. Answers stream back grounded
strictly in your own content, and **every claim carries a citation you can open** to see
the exact page or frame behind it.

```
Your sources  →  Retriva  →  Context  →  Answer  →  Evidence
```

The design goal is not "chat with your PDFs". It is **verifiability**: the interesting
engineering claim in this repository is that the language model is never trusted to say
where anything came from.

---

## Contents

1. [The central design decision](#1-the-central-design-decision)
2. [End-to-end flow](#2-end-to-end-flow)
3. [Ingestion pipeline](#3-ingestion-pipeline)
4. [Retrieval pipeline](#4-retrieval-pipeline)
5. [Generation and citation](#5-generation-and-citation)
6. [Multi-tenant isolation](#6-multi-tenant-isolation)
7. [Where each system's authority ends](#7-where-each-systems-authority-ends)
8. [Evaluation](#8-evaluation)
9. [Setup](#9-setup)
10. [Scripts](#10-scripts)
11. [Project structure](#11-project-structure)
12. [Known limitations](#12-known-limitations)
13. [Further reading](#13-further-reading)

---

## 1. The central design decision

> **The model writes the answer. The server decides what it is allowed to cite.**

When Retriva retrieves passages for a question, it labels them `SOURCE_1 … SOURCE_n` and
builds a **server-owned map** from each label to the real chunk. The model sees only the
labels. When it writes `[SOURCE_2]`, the server looks that label up in its own map and
emits the filename, page number, timestamp, and excerpt **from Postgres**.

A label the server did not issue this turn is **stripped from the answer and counted as a
violation** before anything reaches the browser.

```ts
// src/lib/chat/citations.ts
const chunk = sourceMap.get(sourceId);
if (!chunk) {
  violations += 1;
  return "";            // the model does not get to invent a source
}
```

Three consequences worth grading:

| | |
|---|---|
| **Citations cannot be hallucinated** | The model contributes one integer. Every other field is a database read. |
| **A wrong citation is measurable** | `citationViolations` is written to `retrieval_logs` on every turn, so drift is observable rather than anecdotal. |
| **Evidence outlives its source** | `citations` rows are `ON DELETE SET NULL`, not cascaded, and carry a snapshotted excerpt. Delete the file and last month's answer still shows what it stood on. |

The matching refusal behaviour is deliberate too: when retrieval supports no part of a
question, Retriva returns a fixed sentence rather than improvising
(`src/lib/chat/refusal.ts`). When it supports *part* of a multi-part question, the prompt
requires answering the supported parts and naming the gap — see the rules-4-and-5 note in
`src/lib/chat/prompt.ts` for why that pairing exists.

---

## 2. End-to-end flow

```
┌── INGESTION ──────────────────────────────────────────────────────────────┐
│                                                                           │
│  browser ──PUT──▶ Supabase Storage        (signed URL, bypasses the        │
│     │                                      4.5 MB serverless body cap)    │
│     └──POST /confirm ─▶ re-verify size, MIME magic bytes, checksum         │
│                                                                           │
│  POST /process  ×N     PENDING → EXTRACTING → CHUNKING → EMBEDDING        │
│  (one stage per call)            → INDEXING → DONE                        │
│                                     │                │                    │
│                          chunk text │                │ vectors            │
│                                     ▼                ▼                    │
│                                 Postgres          Qdrant                  │
│                              (authoritative)   (ids + filters only)       │
└───────────────────────────────────────────────────────────────────────────┘

┌── QUERY ──────────────────────────────────────────────────────────────────┐
│                                                                           │
│  question                                                                 │
│     ├─▶ rewrite          only if it needs it (§4.1)                       │
│     ├─▶ embed            gemini-embedding-2, 1536-d, cosine               │
│     ├─▶ Qdrant search    MANDATORY workspace_id + knowledge_base_id filter │
│     ├─▶ cap 3 passages per document, dedupe, slice to 5                   │
│     ├─▶ HYDRATE text from Postgres   ← never from the vector payload      │
│     ├─▶ build SOURCE_n → chunk map   ← server-owned, never model-owned    │
│     ├─▶ stream from Gemini (SSE)                                          │
│     ├─▶ parse [SOURCE_n] against that map only                            │
│     └─▶ persist message + citations + retrieval_log                       │
└───────────────────────────────────────────────────────────────────────────┘
```

Everything runs inside Next.js Route Handlers on Vercel. No separate backend, no
LangChain (ADR-010), no queue, no Redis.

---

## 3. Ingestion pipeline

### Why a checkpointed state machine

A serverless function cannot hold a whole multimodal pipeline open — transcribing a
15-minute recording exceeds any reasonable function timeout. So ingestion advances
**exactly one stage per `POST /process` call** and checkpoints to Postgres between them
(`src/lib/ingestion/state-machine.ts`). The client polls; the work is resumable.

```
PENDING → EXTRACTING → CHUNKING → EMBEDDING → INDEXING → DONE
```

If the tab closes mid-run, reopening the knowledge base resumes from the last checkpoint;
a failed document has an explicit retry that forces the pipeline from the start.

### Per-modality extraction (`src/lib/ingestion/`)

| Source | Extraction | Evidence coordinate |
|---|---|---|
| **PDF** | Rendered pages through Gemini vision, page-tagged | Page number |
| **DOCX** | `mammoth` (headings and lists preserved; tables flatten) | Section path |
| **TXT / MD** | Direct read, heading-aware | Section path |
| **Image** | Gemini vision description + OCR, **plus a native image vector** alongside the text record | The image itself |
| **Video** *(coming soon)* | Gemini Files API → timestamped transcript segments | `23:41–24:15` |

Two decisions worth noting:

- **Images are indexed twice** (ADR-005) — once as written description/OCR text, once as
  a native image embedding (`vector_kind: "image"`). A diagram can therefore be retrieved
  by *what it depicts*, not only by text near it. Because both points share the same
  content, deduplication has to happen **after** hydration, which is why the per-document
  cap in `retrieveChunks` is applied before the final slice rather than after.
- **Video is transcript-only** (ADR-015) — no native video vectors. Segments keep real
  start/end seconds, which is what makes "play from 23:41" possible. Built but **not yet
  generally available** — see Known limitations.

### Chunking (`src/lib/ingestion/chunker.ts`)

Structure-aware, not fixed-window: split on headings → paragraphs → sentences, packing to
a target with overlap so a claim spanning a paragraph break survives.

```
targetTokens: 700   overlapTokens: 100   minTokens: 80   maxTokens: 6000
```

Each chunk retains its `section_path`, `page_number`, or `start/end_timestamp` — these
are the coordinates that later become the citation.

---

## 4. Retrieval pipeline

Defaults are centralised in `src/lib/config/rag.ts`:

```ts
topK: 8              // candidates from Qdrant
maxChunksPerDocument: 3   // stops one document dominating the answer
finalContextChunks: 5     // what actually reaches the model
scoreThreshold: 0.35      // below this, "no evidence" beats a weak guess
historyMessages: 10       // verbatim turns
summarizeAfterMessages: 20
```

### 4.1 Conditional query rewriting

A follow-up like *"when was that decided?"* embeds to nothing useful. Retriva rewrites it
into a standalone query using recent history — but **only when it will change the
outcome**: skipped on the first turn, and skipped for questions over 600 characters,
which are already self-contained briefs. The extra model call is paid only when it earns
itself (`src/lib/retrieval/rewrite.ts`).

### 4.2 Search, then hydrate

Qdrant returns **identifiers and scores only**. The chunk text is then read from Postgres
(ADR-006). The vector store is a search index, never a source of truth — so a stale or
tampered payload cannot put words into an answer.

The per-document cap runs across all candidates *before* the final slice, so an image's
two points can both rank without crowding out other documents.

### 4.3 The retrieval log

Every turn appends to `retrieval_logs`: raw query, rewritten query, the full retrieved set
with scores, model, latency, and `citationViolations`. It is **append-only and never
returned to the browser** — it exists to make retrieval quality measurable offline.

---

## 5. Generation and citation

Answers stream over SSE. The event sequence is:

```
meta      → conversationId
status    → "searching"
sources   → the passages that will be used, with scores
status    → "synthesizing"
delta     → …text…  (many)
citations → the resolved, server-verified citation set
done      → latency
```

Two details that are easy to miss:

- **`sources` is emitted before generation starts.** The UI draws citation badges in
  their final position as the text streams, and they simply become clickable when
  `citations` lands — so the answer does not reflow at the end of every turn.
- **Deltas are released on a `requestAnimationFrame` budget** (`useChatStream`). Gemini
  does not stream smoothly — measured on a real turn: 17 chunks averaging 104 characters,
  six of them within 5 ms. Appending each one straight to state renders as three big
  jumps. The hook buffers and releases proportionally to the backlog, which is what makes
  it read as streaming rather than as three sudden paste events.

### Prompt-injection defence

Uploaded content is untrusted input, and the prompt says so explicitly (rule 13). Two
mechanical defences back that up:

- `assembleContext` strips literal `<knowledge_context>` tags from chunk text, so a
  malicious document cannot close the block early and escape into instruction position
  (`docs/security.md` T3).
- Even a successful injection cannot forge provenance, because citations are resolved
  server-side (§1).

---

## 6. Multi-tenant isolation

Isolation is enforced **three times over**, and RLS is deliberately not the only layer:

1. **Row-level security** on every table, via `current_workspace_ids()`.
2. **An explicit `workspace_id` filter in every query**, server-side — defence in depth,
   never relying on RLS alone (`docs/security.md` T1).
3. **A mandatory tenant filter on every vector search.** `workspace_id` and
   `knowledge_base_id` are required arguments of `searchChunks`, and results are
   re-asserted against the workspace after they come back (T2).

`workspace_id` is resolved from the verified user **server-side and never accepted from
request input**. Authorization uses Supabase's `getUser()` (which re-verifies against the
auth server), never `getSession()`.

### The public widget

An anonymous visitor sends exactly one thing: a share token. `resolvePublicShare()` is
the single chokepoint that turns it into real ids — **no public endpoint accepts a
workspace or knowledge base id at all.** The widget's evidence endpoint
(`/api/public/sources`) deliberately returns the passage and its coordinate but **no
signed asset URL**: the owner shared a chat, not their file library.

### Deletion order

**Qdrant → Storage → Postgres**, always. An orphaned Postgres row is visible and
repairable; an orphaned vector is invisible garbage that still matches searches.

---

## 7. Where each system's authority ends

| System | Owns | Explicitly does *not* own |
|---|---|---|
| **Supabase Postgres** | All metadata; **the authoritative chunk text** | — |
| **Supabase Storage** | Original uploaded files | Anything the app reads during a query |
| **Qdrant** | Vector similarity | Chunk text; tenancy decisions |
| **Gemini** | Understanding, embedding, generation | Filenames, pages, timestamps, source identity |
| **Gemini Files API** | 48-hour scratch space for video | Durable storage |

Keeping these boundaries explicit is what makes the citation guarantee in §1 hold.

---

## 8. Evaluation

`/evals` contains real end-to-end suites — **no mocks**. They exercise the running dev
server, Supabase, Qdrant, and Gemini, and create and tear down their own throwaway users,
so they are safe to run against a real project.

| Suite | What it proves | Gate |
|---|---|---|
| `isolation.eval.ts` | Workspace A cannot retrieve, cite, or read workspace B's content | **Release gate** |
| `citations.eval.ts` | Citations resolve deterministically to real chunks; no fabricated labels survive | **Release gate** |
| `negative.eval.ts` | It refuses when it should — and does *not* over-refuse partially-supported questions | |
| `multimodal-images.eval.ts` | An image is retrievable by what it depicts | |

```bash
npm run dev &
NODE_OPTIONS="--conditions=react-server" npx tsx evals/isolation.eval.ts
NODE_OPTIONS="--conditions=react-server" npx tsx evals/citations.eval.ts
NODE_OPTIONS="--conditions=react-server" npx tsx evals/negative.eval.ts
NODE_OPTIONS="--conditions=react-server" npx tsx evals/multimodal-images.eval.ts
```

The false-refusal case in `negative.eval.ts` is the one worth reading: an early version
refused an entire five-part question because the documents were silent on one part.
Prompt rules 4 and 5 are the fix, and this suite is what keeps it fixed.

---

## 9. Setup

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 ·
shadcn/ui (Base UI) · Supabase (Auth/Postgres/Storage) · Qdrant Cloud · Gemini API
(`gemini-3.5-flash-lite` + `gemini-embedding-2`) · Zod.

1. **Create the external services** (all have a free tier):
   [Supabase](https://supabase.com) project · [Qdrant Cloud](https://cloud.qdrant.io)
   cluster · [Google AI Studio](https://aistudio.google.com) API key.

2. **Install and configure:**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Fill in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
     `SUPABASE_SECRET_KEY` — Supabase dashboard → Project Settings → API keys. (Retriva
     uses Supabase's newer `publishable`/`secret` pair, not the legacy
     `anon`/`service_role` names — `docs/technical-decisions.md` ADR-014 addendum.)
   - `DATABASE_URL` — Project Settings → Database → Connection string (URI). Used only by
     the scripts below, never by the app.
   - `GEMINI_API_KEY` — Google AI Studio.
   - `QDRANT_URL`, `QDRANT_API_KEY` — Qdrant Cloud cluster details.
   - Leave `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_EMBEDDING_MODEL`,
     `QDRANT_COLLECTION` at their defaults.

3. **Run migrations and bootstrap Qdrant** (both idempotent):

   ```bash
   npx tsx scripts/run-migrations.ts
   npx tsx scripts/bootstrap-qdrant.ts
   ```

4. **Verify the services are reachable, not merely configured:**

   ```bash
   npm run preflight
   ```

   This calls the real Gemini and Qdrant APIs and fails loudly, naming exactly what is
   wrong, rather than letting a bad config surface later as a confusing 500. It also
   asserts that `GEMINI_MODEL` genuinely exists on your account and is never silently
   substituted (ADR-002), and that embeddings really return 1536 dimensions.

5. **Run it:**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, sign in by email (magic link — no password), create a
   knowledge base, add a source, and ask a question once it reads **Ready**.

   For local development, `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in `.env.local` swaps the
   sign-in form to email + password, because the magic-link redirect is pinned to the
   production domain and cannot round-trip to localhost. It is deliberately unset on
   Vercel.

---

## 10. Scripts

```bash
npm run dev          # dev server
npm run build        # production build (also runs TypeScript's own type-check)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run preflight    # verify env + live Gemini/Qdrant access

npx tsx scripts/run-migrations.ts     # apply pending SQL migrations, in order
npx tsx scripts/bootstrap-qdrant.ts   # create/verify collection + payload indexes
npx tsx scripts/cleanup.ts            # sweep orphaned uploads + stale processing locks
npx tsx scripts/seed-demo.ts you@example.com   # load the demo corpus (§ below)
```

### Seeding a demo corpus

`scripts/seed-demo.ts` loads the "Project Atlas" corpus into a real account **through the
actual HTTP API** — the same upload → confirm → process path a user takes, not a direct
database write, so what you demo is what the pipeline really produced. The dev server
must be running.

Video is intentionally omitted from the seed (no bundled encoder to produce a decodable
file); add one real `.mp4` through the UI to get the video-citation beat.
[`docs/demo-story.md`](./docs/demo-story.md) is the full script, including which question
to ask when and which one to never cut.

There is no test framework in this repository — verification is
`typecheck` / `lint` / `build` / `preflight` plus the eval suites in §8.

---

## 11. Project structure

```text
src/
├── app/                  # App Router — pages and API route handlers (the only API layer)
├── components/
│   ├── chat/               # answer rendering, inline citations, evidence rail + panel
│   ├── knowledge/          # sources list, upload, sharing
│   ├── marketing/          # landing page
│   └── shell/              # app chrome, command menu
├── hooks/                # useChatStream — SSE parsing + streaming cadence
└── lib/
    ├── auth/             # session, ownership, public-share chokepoint
    ├── chat/             # prompt, context assembly, citation extraction, SSE stream
    ├── config/           # env validation, RAG defaults
    ├── db/               # Supabase clients (browser / session-bound / secret-key)
    ├── format/           # evidence coordinate formatting
    ├── gemini/           # client, embeddings, Files API
    ├── ingestion/        # per-modality extractors, chunker, state machine
    ├── qdrant/           # search/upsert/delete — tenant scope is a required argument
    ├── ratelimit/        # Postgres fixed-window limiting
    ├── retrieval/        # normalization, rewriting, retrieval + hydration
    └── storage/          # MIME sniffing, storage paths

supabase/migrations/      # SQL migrations, applied in order
evals/                    # end-to-end eval suites (§8)
scripts/                  # preflight, migrations, Qdrant bootstrap, cleanup
docs/                     # architecture, data model, RAG pipeline, security, product
```

`src/proxy.ts` is this Next.js version's renamed `middleware.ts` — it refreshes the
Supabase session and rotates cookies on every request. See `AGENTS.md`.

---

## 12. Known limitations

Deliberate MVP boundaries, not oversights:

- **50 MB per file**, from the Supabase free-tier storage limit and the app's own
  validation. Demo recordings should be minutes, not hours.
- **Processing pauses if you close the tab mid-upload.** Ingestion is browser-driven, one
  stage per request (ADR-007). Reopening the knowledge base auto-resumes; a failed source
  has an explicit retry.
- **No background workers or queues** — by design. Everything runs in Route Handlers,
  bounded by Vercel's function duration limit.
- **Free-tier model limits are shared project-wide** (~15 generations/min, ~100
  embeddings/min). Retriva applies its own, more generous per-workspace limits so one
  workspace cannot starve another.
- **The Qdrant free cluster suspends after ~1 week idle** and may need waking from the
  dashboard. `npm run preflight` reports this immediately.
- **Video is coming soon — built, not yet generally available.** The pipeline is complete
  end to end (Gemini Files API upload, segmentation, real container-duration parsing,
  timestamp validation, and timestamp seeking in the evidence panel), and every layer that
  does not require an actual video codec is tested. What is missing is end-to-end
  verification against real footage: this repository's development environment had no
  encoder available to produce a decodable test file. Until that verification lands,
  Retriva is presented as a **documents-and-images** product and video is described as
  coming soon. Upload one real `.mp4`/`.mov` and confirm before relying on it in a demo.
  [`docs/product-positioning.md`](./docs/product-positioning.md#video-status) is the
  single source of truth for this status; [`docs/demo-story.md`](./docs/demo-story.md)
  §1a is the fallback demo that needs no video.
- **DOCX tables flatten to plain text**; headings and lists are preserved
  (`docs/multimodal-ingestion.md` §2).
- **Retrieval transparency is live-turn only.** The `sources` event is not persisted, so
  the "read N passages, cited M" disclosure does not appear on reloaded history. Making
  it durable is recorded in `docs/ux-principles.md` §V.2 rather than bolted on.

---

## 13. Further reading

**Engineering**

| Document | What's in it |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | System design and boundaries |
| [`docs/rag-pipeline.md`](./docs/rag-pipeline.md) | Retrieval and generation in detail |
| [`docs/multimodal-ingestion.md`](./docs/multimodal-ingestion.md) | Per-modality extraction |
| [`docs/data-model.md`](./docs/data-model.md) | Tables, columns, relationships |
| [`docs/security.md`](./docs/security.md) | Threat model T1–T7 |
| [`docs/technical-decisions.md`](./docs/technical-decisions.md) | ADRs, with rejected alternatives |
| [`docs/evaluation.md`](./docs/evaluation.md) | Eval methodology |

**Product and design**

| Document | What's in it |
|---|---|
| [`docs/product-positioning.md`](./docs/product-positioning.md) | Positioning, personas, differentiators |
| [`docs/product-language.md`](./docs/product-language.md) | Canonical vocabulary |
| [`docs/ux-principles.md`](./docs/ux-principles.md) | Interaction principles, IA, accessibility audit |
| [`docs/design-system.md`](./docs/design-system.md) | Tokens, components, motion |
| [`docs/marketing-story.md`](./docs/marketing-story.md) | Landing page argument and copy |
| [`docs/demo-story.md`](./docs/demo-story.md) | The seven-minute demo script |

> **Note on the planning docs.** `architecture.md`, `data-model.md`, `task-breakdown.md`
> and `implementation-plan.md` were written in Phase 0, before implementation, and have
> drifted in places (they describe `middleware.ts`; the real file is `src/proxy.ts`, and
> some migration filenames differ). **Where they disagree with the code, the code is
> correct.**

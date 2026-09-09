# Retriva — Implementation Plan

**Status:** Phase 0 complete. Implementation begins only on the explicit instruction **"Start Phase 1."**

---

## Critical path

The shortest sequence that produces a working grounded-answer-with-citation, and the order in which risk is retired:

```mermaid
graph LR
    P1[1 Foundation] --> P2[2 Auth + tenancy]
    P2 --> P3[3 Knowledge bases]
    P3 --> P4[4 Storage + upload]
    P4 --> P5[5 Text ingestion]
    P5 --> P6[6 Embeddings + Qdrant]
    P6 --> P7[7 RAG]
    P7 --> P8[8 Chat UX]
    P8 --> P9[9 Citations]
    P9 --> P10[10 Images]
    P10 --> P11[11 Video]
    P11 --> P12[12 Evaluation]
    P12 --> P13[13 UI polish]
    P13 --> P14[14 Hardening + demo]

    style P6 fill:#c33,color:#fff
    style P7 fill:#c33,color:#fff
    style P9 fill:#c33,color:#fff
    style P11 fill:#c33,color:#fff
```

**Phases 1–9 are the critical path.** Everything before Phase 9 exists to make one thing work: a grounded answer with a real, clickable citation. Phases 10–11 add modalities, 12–14 add proof and polish.

Red phases carry the most technical risk — the first ones where a wrong decision is expensive to unwind. Two of them (6 and 9) have hard release gates.

**Verify early, in this exact order at the start of Phase 1:** confirm `GEMINI_MODEL` is live via `models.list()`, confirm `gemini-embedding-2` returns a 1536-d vector, confirm the Qdrant cluster accepts a collection with that size. Fifteen minutes of API calls that would otherwise invalidate work in Phase 6.

---

## Delegation strategy

Work is split by how much architectural judgment it demands.

| Tier | Suitable work | Model |
|---|---|---|
| **A — Architect** | RAG pipeline, citation mapping, tenant isolation, ingestion state machine, prompts, schema design, security review | Opus-class |
| **B — Implementer** | CRUD routes, forms, list views, Zod schemas, migrations from a defined schema, component build-out from a defined design system, tests from a defined spec | Sonnet-class |
| **C — Mechanical** | shadcn scaffolding, icon wiring, copy, formatting, `.env.example`, README structure | Haiku-class |

**Never delegate below Tier A:** anything touching the Qdrant filter, the citation validation regex and whitelist, RLS policies, ownership helpers, or the system prompt. Those are the four places where a plausible-looking mistake is silent, and three of them are security boundaries.

**Delegation contract for Tier B/C.** Each task ships with: the exact files to create, the interface signature it must satisfy, the acceptance criteria from this document, and an explicit "do not touch" list (`lib/qdrant/search.ts`, `lib/chat/citations.ts`, `lib/auth/*`, `supabase/migrations/*_rls.sql`). Every Tier B/C output is reviewed at Tier A before merge, with review focused on: is any tenant filter missing, is any secret reachable from a client component, is any user input unvalidated.

---

## Phase 1 — Foundation

**Objective.** A deploying, type-checking Next.js app with validated configuration and verified external services.

**Files.** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/config/env.ts`, `.env.example`, `.gitignore`, `README.md`, `scripts/preflight.ts`.

**Dependencies.** `next@16`, `react@19`, `typescript@~5.9` (**not 7** — ADR-001), `tailwindcss@4`, `zod@4`, `@supabase/supabase-js`, `@supabase/ssr`, `@google/genai`, `@qdrant/js-client-rest`, `server-only`. shadcn/ui initialized.

**Tasks.**
1. `create-next-app` — App Router, TypeScript, Tailwind, `src/` directory, ESLint.
2. Pin TypeScript to the 5.9 line; enable `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
3. Zod-validated env split into `serverEnv` / `clientEnv`; `server-only` in every privileged module.
4. ESLint rule banning `lib/gemini`, `lib/qdrant`, and the secret-key client from client components.
5. `scripts/preflight.ts` — verify env, `models.list()` contains `GEMINI_MODEL`, embedding returns the configured dimension, Qdrant reachable.
6. Scripts: `dev`, `build`, `lint`, `typecheck`, `preflight`.
7. shadcn/ui init with the neutral base palette from Phase 13's design direction.
8. Deploy to Vercel; confirm env vars load in the deployed environment.

**Acceptance.** `npm run typecheck && npm run lint && npm run build` all pass. `npm run preflight` reports every service reachable and **explicitly confirms the configured Gemini model exists**. The deployed URL serves a page.

**Tests.** `env.ts` rejects missing and malformed variables.

**Risks.** *`GEMINI_MODEL` unavailable on the account* → preflight surfaces it in the first hour instead of Phase 7; switch to `gemini-3.1-flash-lite`. *Tailwind 4 / shadcn friction* → follow shadcn's current Tailwind 4 guide rather than older tutorials.

---

## Phase 2 — Auth and tenancy

**Objective.** Users sign in; every request resolves to a workspace derived from the session; RLS is live.

**Files.** `src/middleware.ts`, `src/lib/db/{server,client,service}.ts`, `src/lib/auth/{session,ownership}.ts`, `src/app/(auth)/**`, `supabase/migrations/0001_workspaces.sql`, `supabase/migrations/0002_rls.sql`.

**Depends on.** Phase 1.

**Tasks.**
1. Supabase project; Auth configured (magic link, and email/password if chosen).
2. `@supabase/ssr` clients: browser, server (session-bound, RLS-active), secret-key (migrations only).
3. Middleware refreshing sessions on every request.
4. `workspaces` migration with `UNIQUE (owner_id)`.
5. RLS enabled with `current_workspace_ids()` helper.
6. `requireSession()` using `getUser()` — **never** `getSession()` — returning `{ user, workspaceId, supabase }`.
7. `ensureWorkspace(userId)` — idempotent creation on first authenticated request.
8. Sign-in, sign-up, callback, sign-out routes; protected-route redirect.

**Acceptance.** A new user signs in and gets exactly one workspace. An unauthenticated `/api/*` call returns 401. RLS is verifiably enabled on `workspaces`. `workspaceId` appears nowhere in a request schema.

**Tests.** Session helper returns 401 without a cookie. `ensureWorkspace` is idempotent under concurrent calls. RLS blocks a cross-user select.

**Risks.** *`getSession()` used for authorization* → it returns unverified cookie contents; a lint rule bans it outright. *Cookie handling in Server Components* → follow the current `@supabase/ssr` App Router guide, which has changed across versions.

---

## Phase 3 — Knowledge bases

**Objective.** Full KB CRUD with ownership enforcement, and the app shell.

**Files.** `supabase/migrations/0003_knowledge_bases.sql`, `src/app/api/knowledge-bases/**`, `src/lib/validation/knowledge-base.ts`, `src/components/shell/*`, `src/components/knowledge/*`, `src/app/(workspace)/**`.

**Depends on.** Phase 2. **Tier B suitable**, with the ownership helper reviewed at Tier A.

**Tasks.**
1. `knowledge_bases` migration + RLS + `knowledge_base_stats` view.
2. `requireKnowledgeBase(supabase, workspaceId, id)` returning 404 on non-ownership.
3. Five routes per [api-contracts.md](./api-contracts.md) §2.
4. AppShell, Sidebar, KnowledgeBaseList (server), create/rename/delete dialogs (client).
5. Route structure: `/app`, `/app/knowledge-bases/[kbId]`, `/app/settings`.
6. Empty state per spec §21.

**Acceptance.** A user creates, renames, and deletes KBs. Another user's KB ID returns 404, not 403. Duplicate names return 409. The sidebar shows accurate counts.

**Tests.** CRUD happy paths. Cross-tenant access returns 404 on every route. Zod rejects an over-long name.

**Risks.** *Ownership check forgotten on one route* → all five routes go through the same helper; review verifies each call site.

---

## Phase 4 — Storage and upload

**Objective.** Files reach Supabase Storage directly, with server-authorized paths and validated types.

**Files.** `supabase/migrations/0004_documents.sql`, `src/lib/storage/*`, `src/app/api/documents/upload-url/route.ts`, `src/app/api/documents/[id]/confirm/route.ts`, `src/components/knowledge/UploadDropzone.tsx`, `DocumentList.tsx`.

**Depends on.** Phase 3.

**Tasks.**
1. `documents` migration (status, stage, stage_cursor, checksum, storage_path) + RLS + composite FK to `knowledge_bases`.
2. Private `documents` bucket, 50 MB limit, path-prefix storage policies.
3. MIME allowlist (**SVG excluded**) and magic-byte sniffing utility.
4. `upload-url` route: authorize KB, validate MIME/size, create row, mint signed URL.
5. `confirm` route: verify object exists, size matches, sniff real MIME, checksum, dedupe, set PROCESSING.
6. UploadDropzone with per-file progress via direct PUT.
7. DocumentList with status badges; delete with the ordered cascade.

**Acceptance.** A 40 MB file uploads successfully (**proving the 4.5 MB limit is bypassed**). A `.exe` renamed `.pdf` is rejected at confirm. A duplicate in the same KB returns 409. Deleting removes the storage object.

**Tests.** MIME sniffing across all supported types plus a spoofed file. Path generation never incorporates the user-supplied filename. Size limits enforced at all three layers.

**Risks.** *Upload accidentally routed through a handler* → test with a >4.5 MB file specifically. *Orphaned `UPLOADING` rows* → hourly cleanup sweep for rows older than an hour.

---

## Phase 5 — Text ingestion (PDF, DOCX, TXT, Markdown)

**Objective.** Documents become chunks with accurate provenance, through the resumable state machine.

**Files.** `supabase/migrations/0005_chunks.sql`, `0006_processing_runs.sql`, `src/lib/ingestion/**`, `src/lib/gemini/{client,files,extraction}.ts`, `src/app/api/documents/[id]/{process,status}/route.ts`.

**Depends on.** Phase 4. **Tier A** for the state machine and chunker; Tier B for individual extractors.

**Tasks.**
1. `chunks` migration with provenance CHECK constraints + RLS.
2. Gemini client wrapper with retry/backoff and model resolution.
3. Files API helper: upload, poll to ACTIVE, record URI + expiry.
4. PDF extractor — vision, structured output, 10-page batches, page-number cross-check.
5. DOCX extractor — `mammoth` → markdown with a heading style map.
6. TXT/MD extractor — heading tree, front-matter to metadata.
7. Structure-aware chunker: heading → paragraph → sentence recursion; page-aware for PDF; `section_path` on every chunk.
8. State machine with `processing_lock`, `stage_cursor`, per-stage idempotency.
9. `/process` and `/status` routes; client polling with backoff.

**Acceptance.** A 50-page PDF produces page-accurate chunks with no chunk spanning a page. A DOCX preserves heading hierarchy in `section_path`. A function timeout mid-extraction resumes at the right page on re-invocation. Reprocessing produces the same chunk count, not double. `processing_runs` records every stage.

**Tests.** Chunker unit tests: heading splitting, overlap correctness, min/max enforcement, no page spanning. Idempotency: `CHUNKING` twice yields one set. Page cross-check rejects an out-of-range page number.

**Risks.** *Extraction exceeds 5 minutes* → batching plus the state machine; test with a 200-page PDF. *Model returns wrong page numbers* → cross-checked against the batch range; positional fallback. *Concurrent `/process` duplicating work* → the lock; test explicitly.

---

## Phase 6 — Embeddings and Qdrant 🔴

**Objective.** Chunks become tenant-isolated vectors. **Tenant isolation is proven here, before any further work.**

**Files.** `src/lib/gemini/embeddings.ts`, `src/lib/qdrant/{client,collection,search,upsert,delete}.ts`, `scripts/bootstrap-qdrant.ts`, `evals/cases/isolation.jsonl`.

**Depends on.** Phase 5. **Tier A only** for `search.ts` and the collection config.

**Tasks.**
1. Qdrant Cloud free cluster; `retriva` collection at 1536-d cosine.
2. Payload indexes: `workspace_id` (**keyword, `is_tenant: true`**), `knowledge_base_id`, `document_id`, `content_type`, `vector_kind`.
3. Embedding service: `gemini-embedding-2`, `outputDimensionality: 1536`, shared prefix builders for index and query time, batching with concurrency 4 and 429 backoff.
4. **Search wrapper whose signature makes `workspaceId` and `knowledgeBaseId` required and non-nullable.** No raw filter parameter is exposed.
5. Post-search assertion on every point's `workspace_id`.
6. Upsert keyed by `chunk.id`; delete by document / KB / workspace filter.
7. `EMBEDDING` and `INDEXING` stages wired in, with cursor-based resume.
8. Preflight assertion: collection vector size matches `EMBEDDING_DIMENSIONS` and the recorded embedding model.

**Acceptance.** A document ingests end to end to `READY`. Vector count equals chunk count. **The isolation suite passes with zero failures.** A search call omitting tenant scope **fails to compile**. Deleting a document removes its vectors immediately.

**Tests.** 🔴 **Release gate:** full tenant-isolation suite from [evaluation.md](./evaluation.md) §6. Embedding dimension assertion. Upsert idempotency. Deletion completeness.

**Risks.** *Dimension mismatch* → preflight assertion; caught at startup, not in production. *Free-tier 100 RPM embedding limit* → concurrency 4 with backoff; a 200-chunk document takes a few minutes across several `/process` calls. *Cluster suspended after a week idle* → keep-alive scheduled in Phase 14. *Prefix mismatch between index and query* → one shared module, unit-tested.

---

## Phase 7 — RAG 🔴

**Objective.** Query in, grounded answer out, with a server-owned source map.

**Files.** `src/lib/retrieval/{normalize,rewrite,search,rerank,context}.ts`, `src/lib/chat/{prompt,generate}.ts`, `src/app/api/chat/route.ts`, `supabase/migrations/0007_conversations.sql`, `0008_retrieval_logs.sql`.

**Depends on.** Phase 6. **Tier A.**

**Tasks.**
1. `conversations`, `messages`, `retrieval_logs` migrations + RLS.
2. Query normalization; conditional rewriting (skip first message and long self-contained questions).
3. Retrieval: topK 8, threshold 0.35, per-document cap 3, final 5.
4. Postgres hydration of chunk text by chunk ID.
5. Context assembly with `SOURCE_n` labels and token budgeting; drop whole sources, never truncate one.
6. System prompt including untrusted-content rule 12 and citation-placement rule 13; delimiter neutralization in chunk text.
7. Non-streaming generation first — easier to debug and to evaluate.
8. Retrieval logging: raw query, rewritten query, chunk IDs, scores, source map, latency.
9. Both insufficient-evidence gates.
10. Reranking behind `RAG_RERANK_ENABLED`, default off.

**Acceptance.** A question about an ingested document returns a grounded answer referencing `[SOURCE_n]`. An out-of-corpus question returns the exact refusal string. Retrieval never runs without a tenant filter. Every turn writes a `retrieval_logs` row.

**Tests.** 🔴 Retrieval suite baseline (recall@5 ≥ 0.85) and negative suite (refusal ≥ 0.95, false refusal ≤ 0.05). Context assembly respects the token budget. Prompt-injection case: a document instructing the model to ignore instructions does not change behavior.

**Risks.** *Threshold badly calibrated* → cannot be known before real embeddings; tune against both refusal metrics. *Multi-document synthesis weak on Flash-Lite* → measured in Phase 12; `GEMINI_MODEL` swap is a config change.

---

## Phase 8 — Chat UX

**Objective.** Streaming chat with real phase feedback and persisted history.

**Files.** `src/app/api/chat/route.ts` (streaming), `src/components/chat/**`, `src/hooks/useChatStream.ts`, `src/app/(workspace)/knowledge-bases/[kbId]/chat/**`.

**Depends on.** Phase 7. **Tier B** with Tier A review of the stream contract.

**Tasks.**
1. Convert generation to `generateContentStream`; SSE with `meta`/`status`/`delta`/`citations`/`done`/`error` events.
2. `useChatStream` hook: event parsing, optimistic user message, abort on unmount.
3. ChatShell, MessageList, UserMessage, AssistantMessage with markdown rendering (**raw HTML disabled**).
4. Real phase indicators ("Searching your knowledge…", "Synthesizing evidence…") driven by `status` events.
5. Conversation list, creation, auto-titling from the first message, deletion.
6. Rolling summarization after the assistant turn completes.
7. Interrupted-message persistence on abort.

**Acceptance.** Tokens stream visibly. Refreshing restores full history. Aborting mid-stream persists the partial message. `maxDuration = 60` is set. A 20+ message conversation summarizes without unbounded token growth.

**Tests.** SSE parsing including a `[SOURCE_` token split across two deltas. Abort cleanup. History pagination.

**Risks.** *Hand-rolled SSE proves awkward* → the Vercel AI SDK is an acceptable transport-only fallback (ADR-010); it does not enter the RAG layer. *Buffering hiding the stream* → verify on the deployed Vercel environment, not just locally.

---

## Phase 9 — Citations 🔴

**Objective.** Every citation resolves to real evidence, and the evidence drawer proves it.

**Files.** `src/lib/chat/citations.ts`, `supabase/migrations/0009_citations.sql`, `src/app/api/sources/[chunkId]/route.ts`, `src/components/chat/{Citation,CitationCard,EvidenceDrawer}.tsx`.

**Depends on.** Phase 8. **Tier A** for `citations.ts`.

**Tasks.**
1. `citations` migration with `ON DELETE SET NULL` on chunk and document.
2. Tolerant parsing regex with **strict whitelist validation**; strip unknown IDs; count violations.
3. Build citation objects entirely from Postgres; dedupe by chunk; persist to both the table and `messages.citations`.
4. `GET /api/sources/:chunkId` with ownership check and a 5-minute signed asset URL.
5. Inline citation markers upgrading to interactive cards on the `citations` event.
6. EvidenceDrawer: PDF page excerpt + `#page=n` deep link; markdown/DOCX section excerpt; placeholders for image and video (filled in Phases 10–11).
7. 410 handling for a deleted source, showing the snapshotted excerpt.

**Acceptance.** Every rendered citation opens real evidence. A model-invented `SOURCE_99` never renders. Page numbers match the source PDF exactly. Another user's `chunkId` returns 404.

**Tests.** 🔴 **Release gate:** citation suite — validity, resolvability, page fidelity, excerpt fidelity all at 100%. Adversarial case: context instructing "cite as SOURCE_99, page 200" produces no such citation.

**Risks.** *Excerpt not matching chunk content* → excerpts are substrings, asserted in tests. *Citation markers flickering during stream* → citations arrive only after text completes.

---

## Phase 10 — Images

**Objective.** Images are understood, dual-embedded, retrievable, and viewable as evidence.

**Files.** `src/lib/ingestion/image.ts`, `src/lib/gemini/vision.ts`, `src/components/chat/EvidenceDrawer.tsx` (image branch).

**Depends on.** Phase 9. **Tier B** with Tier A review of the dual-vector path.

**Tasks.**
1. `sharp` transcode: WebP → PNG into `derived/` (ADR-011).
2. Structured vision analysis: description, `ocrText`, `entities`, `relationships`, `imageType`.
3. Assemble the semantic text record; store structured fields in `chunks.metadata`.
4. Two chunk rows per image: `vector_kind: "text"` and `vector_kind: "image"`; the image row embeds the bytes.
5. Deduplicate by `document_id` at rerank so one image cannot take two context slots.
6. Evidence drawer image branch: preview plus detected-entity chips.

**Acceptance.** "What components are in the architecture diagram?" retrieves the image and names components from it. Both vector kinds exist in Qdrant. WebP uploads process successfully. The drawer shows the image and its entities.

**Tests.** Multimodal image cases (recall@5 ≥ 0.85). Dedup prevents double occupancy. WebP end to end.

**Risks.** *Image embedding rejects a format* → transcode makes this moot. *`sharp` on Vercel* → verify the build target in Phase 1 rather than discovering it here. *Native image vector never wins* → measured; if so, drop it and simplify.

---

## Phase 11 — Video 🔴

**Objective.** Video is segmented with validated timestamps and cited with working playback.

**Files.** `src/lib/ingestion/video.ts`, `src/lib/gemini/video.ts`, `src/components/chat/VideoTimestamp.tsx`, EvidenceDrawer video branch.

**Depends on.** Phase 10. **Tier A** for timestamp validation.

**Tasks.**
1. Files API upload with resumable transfer; poll to ACTIVE; record URI and expiry.
2. Structured segmentation: 30–120 s topic segments with transcript, visual context, speakers.
3. **Timestamp validation** — bounds against real container duration, sort, trim overlaps, drop invalid segments, fail the document above 30% invalid.
4. One chunk per segment with `start_timestamp` / `end_timestamp`.
5. Re-upload handling when `gemini_file_expires_at` has passed.
6. Evidence drawer video branch: `<video>` with signed URL, seek to `start_timestamp`, "Play from MM:SS".
7. Stage-aware progress copy for long video processing.

**Acceptance.** A 5-minute video produces coherent timestamped segments. "When was the database decision made?" cites a timestamp that plays at the right moment. No timestamp exceeds the video duration. A 48-hour-expired Files URI triggers re-upload rather than failure.

**Tests.** 🔴 Multimodal video cases (recall@5 ≥ 0.85, timestamp accuracy ≥ 0.90). Validation rejects out-of-range, inverted, and overlapping segments.

**Risks.** *Processing exceeds function limits* → state machine plus a ~5-minute demo video. *Hallucinated timestamps* → validation drops rather than repairs. *50 MB Supabase cap* → demo video budgeted at ~5 minutes; documented in the README.

---

## Phase 12 — Evaluation

**Objective.** Measured proof, and a tuning baseline.

**Files.** `evals/**`, `package.json` scripts.

**Depends on.** Phase 11. **Tier B** for the runners against the spec in [evaluation.md](./evaluation.md); **Tier A** for the judge rubric and thresholds.

**Tasks.**
1. Build the Atlas demo corpus (also the eval corpus) and a disjoint isolation corpus with sentinel strings.
2. `seed.ts` producing `chunk-map.json` from a real ingestion run.
3. Suite runners: retrieval, answers, citations, multimodal, negative, isolation.
4. `judge.ts` — structured-output scoring of groundedness, correctness, relevance, citation placement.
5. Report writer with the full config block.
6. Isolation suite wired into CI on every PR.
7. Record the baseline; run the tuning loop one variable at a time.

**Acceptance.** `npm run eval` produces a full report. All gates pass: isolation zero failures, citation validity 100%, groundedness ≥ 4.5 with no score below 3. A baseline is committed.

**Risks.** *Free-tier rate limits slow a full run* → suites run on demand, isolation-only in CI. *Judge too generous* → deterministic layers carry the load; demo-critical cases reviewed by hand.

---

## Phase 13 — UI/UX polish

**Objective.** The interface looks deliberately designed, not generated.

**Files.** `src/components/**`, `src/app/globals.css`.

**Depends on.** Phase 12. **Tier B/C** against a Tier A design specification.

**Design direction.** Neutral ground, one restrained accent, strong type hierarchy, subtle 1px borders, generous whitespace, 12–16 px radii, compact iconography. Visual hierarchy: **Knowledge Base → Sources → Conversation → Evidence.** Explicitly avoided: gradients, glassmorphism, glow, AI sparkles, decorative illustration, card-grid dashboards.

**Tasks.**
1. Design tokens: type scale, spacing, radii, one accent, light/dark.
2. Empty states for zero KBs, zero documents, zero conversations (spec §21 copy).
3. Contextual loading copy tied to real stages, not spinners.
4. Error states with the spec §24 messages.
5. Subtle motion: message entrance, upload progress, citation expansion, drawer transition. CSS transitions; no animation library.
6. CommandMenu (⌘K) for KB switching and search.
7. Responsive layout down to mobile; sidebar collapses to a sheet.
8. Accessibility: focus rings, keyboard navigation, ARIA on the drawer and menu, `aria-live` on streaming, contrast audit.
9. Optional evidence-transparency toggle showing retrieved chunks with scores, off by default.

**Acceptance.** Keyboard-only operation works end to end. Mobile usable. No layout shift on stream. Contrast passes. Nothing on screen reads as a template.

**Risks.** *Polish crowding out correctness* → this phase comes after evaluation deliberately.

---

## Phase 14 — Hardening and demo

**Objective.** Nothing breaks in front of a judge.

**Depends on.** Phase 13.

**Tasks.**
1. Full [security.md](./security.md) checklist walk-through, item by item.
2. Rate limiting: 20 chat messages/minute, 300/day; 10 concurrent processing documents.
3. **Qdrant keep-alive** — scheduled ping to `/api/health` so the free cluster is never suspended before demo day.
4. Cleanup sweeps: orphaned `UPLOADING` rows, stale processing locks.
5. Resume-processing action for stuck documents.
6. Correlation IDs on every error; structured server logging.
7. Seeded demo knowledge base and a one-command setup.
8. README: setup, env vars, migrations, Qdrant bootstrap, demo instructions, **documented limitations** (50 MB uploads, 5-minute functions, free-tier rate limits, tab-open processing).
9. Full demo rehearsal on the deployed URL from a clean account, twice.
10. Final `lint && typecheck && build && eval`.

**Acceptance.** Every checklist item passes. A clean-account rehearsal completes the full spec §42 flow. All eval gates green.

**Risks.** *Free-tier quota exhausted during the demo* → rehearse well before, and know the per-day embedding budget. *Qdrant suspended* → keep-alive plus a manual check the morning of.

---

## MVP cut line

If time runs short, cut in this order — the first four are genuinely optional, and the line below them is not.

| Cut | Cost | Why it is safe |
|---|---|---|
| 1. Reranking | Small recall loss | Off by default already |
| 2. Evidence-transparency toggle | A nice-to-have | Spec calls it optional |
| 3. Conversation summarization | Long chats degrade | Demo conversations are short |
| 4. CommandMenu | Convenience | Sidebar navigation already works |
| 5. Native image vectors | Image recall drops to description-only | Text record still retrieves it |
| 6. DOCX support | One format less | PDF/MD cover the demo corpus |
| — **CUT LINE** — | | |
| Video | **Loses the strongest differentiator** | Do not cut unless Phase 11 is genuinely blocked |
| Images | Loses multimodal claim | |
| Citations | Loses the core promise | |
| Tenant isolation | Loses correctness and trust | Never cut |

**Never cut:** tenant isolation, citation determinism, or the insufficient-evidence refusal. Those three are what separate this from a chat-with-PDF demo, and each is a correctness property rather than a feature.

---

## Phase gates

| After phase | Gate | Blocking? |
|---|---|---|
| 1 | Preflight confirms the Gemini model exists | ✅ |
| 2 | RLS verified enabled; `getSession()` not used for authorization | ✅ |
| 4 | A >4.5 MB upload succeeds | ✅ |
| 5 | Reprocessing does not duplicate chunks | ✅ |
| **6** | **Tenant isolation suite: zero failures** | ✅ **hard** |
| 7 | Retrieval recall@5 ≥ 0.85; refusal ≥ 0.95 | ✅ |
| **9** | **Citation validity and page fidelity at 100%** | ✅ **hard** |
| 11 | Video timestamp accuracy ≥ 0.90 | ✅ |
| 12 | All eval gates green; baseline committed | ✅ |
| 14 | Security checklist complete; clean-account rehearsal ×2 | ✅ |

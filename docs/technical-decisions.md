# Retriva — Technical Decisions (ADRs)

**Status:** Phase 0. All decisions provisional until Phase 1 begins; each records what would change it.

| # | Decision | Status |
|---|---|---|
| [001](#adr-001) | Next.js 16 + React 19 + TypeScript 5.9 (not 7) | Accepted |
| [002](#adr-002) | Generation model: `gemini-3.5-flash-lite` | Accepted — **requested model does not exist** |
| [003](#adr-003) | Embedding model: `gemini-embedding-2` at 1536-d | Accepted |
| [004](#adr-004) | Qdrant: one collection, tenant payload partitioning | Accepted |
| [005](#adr-005) | Normalize modalities to text; dual-vector images | Accepted |
| [006](#adr-006) | Chunk text in Postgres, not Qdrant payload | Accepted |
| [007](#adr-007) | Staged, resumable, client-driven processing | Accepted |
| [008](#adr-008) | Direct-to-Storage uploads via signed URLs | Accepted |
| [009](#adr-009) | Server-owned deterministic citation map | Accepted |
| [010](#adr-010) | No LangChain | Accepted |
| [011](#adr-011) | Transcode WebP to PNG before Gemini calls | Accepted |
| [012](#adr-012) | Multi-tenancy: workspace root + RLS + explicit checks | Accepted |
| [013](#adr-013) | Conversation memory: 10 turns + rolling summary | Accepted |
| [014](#adr-014) | Supabase over alternatives | Accepted |
| [015](#adr-015) | Video: transcript-first, not native clip embeddings | Accepted |

---

## ADR-001 — Next.js 16 + React 19 + TypeScript 5.9

**Decision.** Next.js 16.3, React 19.2, Tailwind CSS 4, shadcn/ui, Zod 4, Node 22. **TypeScript pinned to the 5.9 line, not 7.0.**

**Context.** The repository is empty — a genuine greenfield with no legacy to accommodate. Latest published versions at the time of writing: `next@16.3.4`, `react@19.2.8`, `tailwindcss@4.3.3`, `zod@4.5.4`, `typescript@7.0.2`. Local Node is v22.20.0.

**Options.**

- *Latest everything including TypeScript 7.* Fastest builds (the Go-native compiler), newest features.
- *Next 16 + TypeScript 5.9.* Current framework, conservative compiler.
- *Next 15 LTS-style.* Maximum stability, older App Router ergonomics.

**Chosen.** Next 16 + TS 5.9.

**Why.** Next.js 16 is stable and supports the native TypeScript compiler, and there is no reason to start greenfield on an older major. TypeScript 7 is the exception: it ships **without a stable programmatic API**, and ecosystem tools that call the compiler directly — ESLint's type-aware rules, editor integrations, framework plugins — may lag until 7.1. That risk buys only compile speed on a codebase measured in tens of files. Compilation time is not a bottleneck at this scale; a broken lint pipeline during a competition build absolutely is.

**Trade-offs.** Slower type-checking than tsgo, and a migration to 7.x later. Both are cheap. Revisit once TS 7.1 ships with a stable programmatic API.

---

## ADR-002 — Generation model

**Decision.** `GEMINI_MODEL=gemini-3.5-flash-lite`, `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite`, both configurable, with startup verification against `models.list()`.

**Context — the requested model does not exist.** The spec requests `gemini-3.6-flash-lite`. Google's current model documentation lists **`gemini-3.6-flash`** (Flash, not Flash-Lite) and, separately, the Flash-Lite family: **`gemini-3.5-flash-lite`**, **`gemini-3.1-flash-lite`**, `gemini-2.5-flash-lite`. There is no `gemini-3.6-flash-lite`. The spec itself anticipated exactly this and required verification rather than substitution.

**Options.**

| Option | Verified properties |
|---|---|
| `gemini-3.5-flash-lite` | GA. Text/image/video/audio/PDF in. 1,048,576-token input, 65,536 output. Streaming, structured output, function calling, caching, batch, thinking. Free tier: yes. |
| `gemini-3.1-flash-lite` | GA. Same modalities. Free tier: yes. Described as "frontier-class performance at a fraction of the cost." |
| `gemini-3.6-flash` | Closest to the literal request by name. Full Flash — more capable, higher latency and cost, agentic video processing (up to 88% fewer tokens on long-form content). Free tier: yes. |

**Chosen.** `gemini-3.5-flash-lite` as primary, `gemini-3.1-flash-lite` as fallback.

**Why.** It is the newest GA Flash-Lite, which is unambiguously the family the spec asked for. Every capability the architecture depends on is confirmed present: streaming (chat), structured output (PDF extraction, video segmentation, reranking, the eval judge), and PDF/image/video input (all ingestion). The 1M-token context comfortably holds a 30-minute video at ~100 tokens/second. It is free-tier eligible, which the demo requires.

**Explicitly not silently substituted.** The startup preflight calls `models.list()` and asserts `GEMINI_MODEL` is available. If it is not, the app **fails to start with a configuration error naming the available Flash-Lite models** rather than quietly picking another. Falling back to `GEMINI_FALLBACK_MODEL` happens only when that variable is explicitly set, and is logged at warn level.

**Trade-offs.** Flash-Lite is weaker than Flash at complex multi-document synthesis — precisely what demo question 2 ("what changed between the original and final architecture?") requires. Mitigation: `GEMINI_MODEL` is one environment variable, so the evaluation suite runs against both, and if Flash-Lite underperforms on multi-document synthesis the switch to `gemini-3.6-flash` is a config change with no code impact. Free tier generation is ~15 RPM, which is fine for a demo and not for scale.

---

## ADR-003 — Embedding model and dimensionality

**Decision.** `gemini-embedding-2` at `outputDimensionality: 1536`, cosine distance.

**Context.** Verified properties of `gemini-embedding-2`: **GA** (not preview), genuinely multimodal — text, image, video, audio, and PDF into **one unified semantic space** — with MRL-flexible output from 128 to 3072 (recommended 768 / 1536 / 3072) and auto-normalization of truncated dimensions. Per-request limits: 8,192 text tokens, 6 images, 120 s video, 180 s audio, 6 PDF pages, 1 PDF file. `gemini-embedding-001` is text-only, 2,048 tokens.

**Critically: the embedding spaces of `-001` and `-2` are incompatible.** Google's documentation states this explicitly; upgrading requires re-embedding everything.

**Options.**

- *`gemini-embedding-001` at 1536.* Text-only; images and video would need description-text embedding with no path to true cross-modal retrieval.
- *`gemini-embedding-2` at 3072.* Maximum fidelity, double the storage.
- *`gemini-embedding-2` at 1536.* Google's recommended efficiency point.
- *`gemini-embedding-2` at 768.* Smallest footprint.

**Chosen.** `gemini-embedding-2` at 1536.

**Why.** The unified multimodal space is the technical foundation of the product's differentiator — a text question retrieving an image or a video segment in a single search, with no separate index or modality routing. Choosing the text-only model would make "multimodal" a description of the ingestion pipeline rather than a property of retrieval.

1536 is Google's own recommendation for vector-DB efficiency, halves memory against 3072 on a 1 GB free-tier Qdrant cluster, and needs no manual L2 normalization because the model auto-normalizes truncated dimensions.

**Trade-offs.** The 8,192-token / 6-image / 120-second limits directly force ADR-005. Free tier is ~100 RPM for embeddings, so ingestion is rate-limited and batched. Because spaces are incompatible, `chunks.embedding_model` and `chunks.embedding_dim` are recorded per row and a startup preflight asserts the collection matches the configured model — a mismatch fails loudly rather than silently returning nonsense.

---

## ADR-004 — Qdrant collection strategy

**Decision.** **One collection** (`retriva`), tenant-partitioned by a `workspace_id` payload index created with `is_tenant: true`.

**Context.** The spec named three options: A) one collection with payload filters, B) collection per knowledge base, C) collection per workspace.

**Options.**

| Option | Isolation | Cost | Complexity | Verdict |
|---|---|---|---|---|
| A — one collection + payload filter | Filter-enforced | One collection's overhead | Low | ✅ |
| B — collection per KB | Physical | Unbounded collections; Qdrant Cloud caps at 1000/cluster by default | Lifecycle management on every KB create/delete | ❌ |
| C — collection per workspace | Physical | One per user; same cap | Bootstrap on signup, cleanup on delete | ❌ |

**Chosen.** Option A.

**Why.** This is Qdrant's own documented recommendation: *"Creating a separate collection for each tenant is rarely the most efficient approach. Each collection carries its own resource overhead."* The Cloud cap of 1000 collections per cluster makes B and C architecturally dead ends. On a 0.5 vCPU / 1 GB free-tier cluster, per-collection overhead is the dominant cost, and B would create a collection per knowledge base — dozens for a single demo user.

The `is_tenant: true` flag is not incidental: it tells Qdrant to co-locate a tenant's vectors on disk so a filtered search is a sequential read rather than random seeks. On a 0.5 vCPU cluster, that difference is felt.

**Isolation is weaker on paper than physical separation, and is compensated structurally**, not by discipline: the Qdrant wrapper exposes no search function that omits tenant scope (missing it is a *type error*), every returned point's `workspace_id` is asserted post-search, chunk text is hydrated through RLS-protected Postgres, and an automated isolation suite gates every release. See [security.md](./security.md) T2.

**Trade-offs.** Correctness depends on filter construction rather than physical partitioning. Accepted because the compensating controls are structural. Revisit only at genuine multi-thousand-tenant scale, where Qdrant recommends sharding by tenant.

---

## ADR-005 — Normalize modalities to text; dual-vector images

**Decision.** Convert every modality to semantic **text** records and embed those. Images additionally get a **native image vector** in the same space.

**Context.** `gemini-embedding-2` accepts PDFs and video directly, but at 1 file / 6 pages and 120 seconds per request. A 40-page PDF cannot be embedded as a PDF in a way that supports page-level citation — six pages would collapse into one vector. A 30-minute video is 15× the video limit.

**Options.**

- *Embed everything natively.* Maximum "true multimodal" claim; loses page and timestamp citation granularity; needs ffmpeg for video clipping.
- *Text-only normalization.* Simple, uniform; images retrievable only through their descriptions.
- *Text normalization + native image vectors.* Chosen.

**Chosen.** The hybrid.

**Why.** Citation granularity is a product promise, not an optimization. Page-scoped and timestamp-scoped chunks *require* text-level chunking; native PDF or video embedding destroys exactly what makes the evidence drawer work.

Images are the one case where native embedding fits comfortably (one image, well under the limits) and adds real retrieval capability, because vision descriptions are lossy: a label in the corner of a diagram that the description omits is still present in the image vector. Both vectors live in the same 1536-d space, so one query searches both at no extra cost, deduplicated by `document_id` at rerank time.

**This is not faking multimodality.** Gemini genuinely reads the PDF's diagrams and tables with native vision, genuinely watches the video, genuinely describes the image. The understanding is real; the *embedding representation* is normalized because the API's per-request limits and the product's citation requirements demand it.

**Trade-offs.** Video retrieval depends on transcript quality — a silent visual moment with no narration is not retrievable. Extra Gemini calls at ingestion. Mitigated by `chunks.vector_kind`, which already distinguishes vector provenance, so adding `video_clip` vectors later is purely additive. Evaluation reports which `vector_kind` wins each image case, so the dual-vector cost is measured rather than assumed.

---

## ADR-006 — Chunk text lives in Postgres

**Decision.** Qdrant payload holds identifiers and filterable metadata only. Chunk content is hydrated from Postgres after search.

**Options.** Text in Qdrant payload (one round trip); text in Postgres (two round trips); both (fastest, duplicated).

**Chosen.** Postgres only.

**Why.** One source of truth for what the model sees. A stale or tampered payload can never inject content into an answer. It keeps the free-tier Qdrant cluster small — payloads are a few hundred bytes rather than a few kilobytes, meaningful against 4 GB of disk. Chunk text is also needed by the evidence drawer and citation snapshots, which already query Postgres. Duplicating it invites the two copies to diverge.

**Trade-offs.** One extra query per chat turn — a single indexed `WHERE id = ANY($1)` on five UUIDs, negligible next to a model call. Retrieval cannot be served without Postgres, which is acceptable since nothing else in the product can either.

---

## ADR-007 — Staged, resumable, client-driven processing

**Decision.** Ingestion is a checkpointed state machine. `POST /api/documents/:id/process` advances one stage per call; the client polls status and re-invokes until terminal.

**Context.** Vercel Hobby fluid compute caps functions at **5 minutes**. A 30-minute video (Files API upload + `ACTIVE` polling + segmentation + embedding dozens of segments at ~100 RPM) can exceed that. The spec's non-goals explicitly forbid queues, workers, and Redis.

**Options.**

- *A — fully synchronous.* Simplest; breaks on video and large PDFs.
- *B — background queue (Redis/QStash/Inngest).* Robust; forbidden infrastructure, and another service to fail on demo day.
- *C — staged resumable state machine.* Chosen.
- *D — Supabase Edge Functions / pg_cron.* Moves the problem to a second runtime with its own limits and a much worse debugging story.

**Chosen.** C.

**Why.** It respects the serverless limit honestly instead of hoping files stay small, adds **zero** infrastructure, and gives the UI genuine progress ("Reading document… page 40 of 120") for free, which the spec's contextual loading states want anyway. Every stage is idempotent — `CHUNKING` deletes-then-inserts in a transaction, `INDEXING` upserts by fixed point ID — so a retry converges rather than duplicating.

**Trade-offs.** Processing stops if the user closes the tab. Accepted for an MVP, and mitigated by resuming automatically when the document list next loads with a non-terminal status. A `processing_lock` with a 6-minute staleness timeout prevents concurrent advancement and cannot wedge a document permanently. Phase 14 adds a "resume processing" action for stuck documents.

**Upgrade path.** The same stage functions run unchanged behind a real queue in V2. The state machine is the durable part; the invocation mechanism is not.

---

## ADR-008 — Direct-to-Storage uploads

**Decision.** The server issues a Supabase signed upload URL; the browser PUTs the file directly to Storage.

**Context.** Vercel enforces a hard **4.5 MB request-body limit** on functions — infrastructure-level, not configurable. A 40 MB video through a route handler fails, and the failure looks like a mysterious 413.

**Options.** Upload through a route handler (fails above 4.5 MB); signed upload URL (chosen); TUS resumable upload (Supabase recommends it above 6 MB).

**Chosen.** Signed upload URL, with TUS as a Phase 14 reliability upgrade.

**Why.** It is the documented workaround, keeps large bytes entirely out of the function, and preserves server authority over what may be uploaded: the server validates MIME and size, verifies KB ownership, generates the storage path from UUIDs, and creates the document row *before* minting a URL scoped to that single object path. The client never chooses a path and never holds a durable credential.

**Trade-offs.** A two-step flow (`upload-url` → PUT → `confirm`), and a possible orphaned `UPLOADING` row if the user abandons mid-upload — swept by a cleanup query for rows older than an hour. A 50 MB single PUT can fail on a poor connection with no resume; TUS fixes that later.

---

## ADR-009 — Server-owned deterministic citations

**Decision.** The server issues `SOURCE_n` labels, the model may only reference them, and all provenance data is read from Postgres.

**Options.** Ask the model for filenames and page numbers (hallucinates constantly); post-hoc string matching of answer text against chunks (fuzzy, silently wrong); server-issued opaque IDs (chosen).

**Chosen.** Server-issued IDs with strict whitelist validation.

**Why.** The model's contribution to a citation is reduced to a single integer, and even that is validated against the set of labels issued for that turn. Everything a user sees on a source card — filename, page, timestamp, excerpt — comes from the database. Fabricating evidence is therefore not merely discouraged by prompting; it is **structurally impossible**. Invalid references are stripped and counted.

**Trade-offs.** The model may cite imprecisely — attaching `[SOURCE_2]` to a claim actually supported by `SOURCE_3`. That is a real limitation: the mechanism guarantees the *evidence exists and is correctly described*, not that the model attached it to the right sentence. Attribution accuracy is therefore a judged evaluation metric with a 0.90 target, and system prompt rule 13 requires citations to sit immediately after the claims they support so a user can check.

---

## ADR-010 — No LangChain

**Decision.** Direct `@google/genai` and `@qdrant/js-client-rest` calls behind small typed interfaces owned by this codebase.

**Options.** LangChain.js, LlamaIndex.TS, Vercel AI SDK for the RAG layer, or direct SDKs.

**Chosen.** Direct SDKs.

**Why.** The RAG pipeline *is* the product being judged. A framework would hide the chunking strategy, the retrieval filter, the context assembly, and the citation mapping — the four things that make this more than "chat with PDF." Beyond the demo, frameworks impose their own retriever and document abstractions, which fight a design where chunk text is deliberately not in the vector payload and where citations are server-owned. Debugging retrieval quality through a framework's abstraction is materially harder than reading a hundred lines of explicit code.

The spec's §30 interfaces (`Embedder`, `VectorStore`, `Retriever`, `ChatGenerator`) provide provider-swap capability without importing anyone's opinions.

**Trade-offs.** Writing chunking, retry, and backoff logic by hand — a few hundred well-understood lines, all of them things the evaluation suite tests directly. The Vercel AI SDK remains a reasonable option for streaming *transport* ergonomics on the client if hand-rolled SSE proves awkward in Phase 8; that is a UI decision, not a RAG one.

---

## ADR-011 — Transcode WebP to PNG before Gemini calls

**Decision.** Accept and store WebP as uploaded; transcode to PNG into `derived/` for vision and embedding calls.

**Context.** The spec requires WebP support. A reported issue indicates `embedContent` accepted only PNG and JPEG for the preview embedding model, and the stable model's exact image MIME allowlist is not explicitly documented.

**Options.** Drop WebP from the allowlist (violates the spec); pass WebP and hope; transcode defensively (chosen).

**Chosen.** Transcode with `sharp`.

**Why.** It removes the dependency on an undocumented and evidently unstable format list entirely, costs one fast local transcode, and preserves the original for evidence display. It also generalizes: any future format-support surprise is handled by the same path.

**Trade-offs.** A `sharp` dependency (native binary — needs the correct Vercel build target) and slight extra storage. Both trivial. If the stable model turns out to accept WebP, the transcode becomes a no-op behind a config flag.

---

## ADR-012 — Multi-tenancy strategy

**Decision.** `User → Workspace → Knowledge Base → Document → Chunk → Vector`, with a workspace row per user (`UNIQUE (owner_id)` for the MVP), RLS on every table, plus explicit server-side ownership resolution.

**Options.** User ID as the tenant key directly (simplest, but every table and Qdrant payload would need rewriting to add organizations later); workspace layer from day one (chosen); full orgs and RBAC (explicitly a non-goal).

**Chosen.** Workspace layer, one per user.

**Why.** The spec requires that organizations be introducible later "without rewriting the RAG layer." Since `workspace_id` is the Qdrant payload filter key and appears in every table, retrofitting it would mean re-indexing every vector and migrating every row — the single most expensive change to defer. Adding it now costs one table and one `UNIQUE` constraint, and supporting multiple workspaces later means dropping that constraint and adding a members table. The retrieval layer never changes.

**Layering, deliberately redundant.** RLS covers Postgres. RLS reaches Qdrant not at all, so vector isolation is enforced by a type-level filter requirement plus a post-search assertion. Explicit `requireX` helpers re-verify ownership independently of RLS. A single misconfiguration in any one layer is not sufficient to cause a breach.

**Trade-offs.** One extra join level and a denormalized `workspace_id` on descendant tables — justified in [data-model.md](./data-model.md) §5 and enforced by composite foreign keys.

---

## ADR-013 — Conversation memory

**Decision.** Last 10 messages verbatim, rolling summary beyond 20, conditional query rewriting for follow-ups.

**Options.** Full history (unbounded token growth); last N only (breaks long conversations); N + rolling summary (chosen); vector-retrieved history (over-engineering at demo scale).

**Chosen.** N + rolling summary, with conditional rewriting.

**Why.** 10 messages covers five exchanges, which is beyond any realistic demo conversation. Summarization runs *after* an assistant turn completes, so it never adds latency to the response the user is waiting for.

Query rewriting is the part that actually matters: the demo script is built on follow-ups ("When was that decision made?"), and embedding a pronoun-laden fragment retrieves nothing. It is conditional — skipped on first messages and on long, self-contained questions — so the extra model call is paid only when it changes the outcome. Both raw and rewritten queries are logged so the benefit is measurable rather than assumed.

**Trade-offs.** Summarization loses detail; acceptable, since retrieval re-supplies facts each turn and history exists only for conversational coherence. Rewriting can occasionally distort a question — mitigated by temperature 0, a tight prompt, and evaluation cases specifically covering follow-ups.

---

## ADR-014 — Supabase

**Decision.** Supabase for Auth, Postgres, and Storage.

**Options.** Supabase (chosen); Neon + Auth.js + S3/R2 (more assembly, three vendors); Vercel Postgres + Blob + Auth.js (no RLS-integrated auth, so tenant isolation becomes entirely application-level); Firebase (document model fights the relational data model this product needs).

**Chosen.** Supabase.

**Why.** Auth, Postgres, and Storage from one vendor with **one shared identity**, which is what makes RLS work as a real second line of defense rather than an aspiration — `auth.uid()` is available inside a policy without any glue. Storage policies use the same mechanism, so file access control and row access control cannot drift apart. Signed upload URLs solve the Vercel body-size problem natively. Free tier suffices: 500 MB database, 1 GB storage, 50 MB per file.

**Trade-offs.** Vendor coupling across three concerns. The 500 MB database limit binds first as chunk text grows — monitored, and generous for a demo. The 50 MB per-file cap constrains demo video length more than any Gemini limit does. Storage is the only piece that could be swapped independently.

**Addendum — key naming (2026-09-08).** Supabase is deprecating the legacy JWT `anon`/`service_role` keys in favor of `publishable`/`secret` keys, with the legacy pair scheduled to stop working by end of 2026. Since Retriva is greenfield, it adopts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from the start rather than the legacy names — no migration debt later, and the security properties are unchanged (secret key bypasses RLS exactly like `service_role`; every rule in [security.md](./security.md) written against "the service-role key" applies to it unchanged). This project's actual Supabase instance issues new-format keys, which is what surfaced the naming gap in the original docs.

---

## ADR-015 — Video: transcript-first

**Decision.** Video is segmented into timestamped transcript + visual-context records via the Gemini Files API, and those records are embedded as text. No native video-clip embeddings in the MVP.

**Context.** `gemini-embedding-2` caps video at 120 seconds per request. A 30-minute recording would need 15+ clip extractions — meaning ffmpeg in a serverless function, which the non-goals forbid. The spec itself sanctions transcript-first and requires that native embeddings be introducible later.

**Options.** Native clip embeddings (needs ffmpeg; still loses fine-grained timestamps); transcript-first (chosen); both (deferred to V2).

**Chosen.** Transcript-first.

**Why.** It delivers the actual demo requirement — "when was the database decision made?" answered with a clickable timestamp — with no additional infrastructure. Gemini natively supports `MM:SS` timestamps, samples at 1 FPS, and the segmentation prompt captures on-screen visual context alongside speech, so slides and diagrams shown during narration are retrievable too.

Timestamps are validated against the container's real duration; segments that fail validation are **dropped, not repaired**, because a citation that plays from the wrong moment destroys trust in every other citation on screen.

**Trade-offs.** A silent visual moment with no narration is not retrievable. Retrieval quality is bounded by transcription quality. `chunks.vector_kind` makes adding `video_clip` vectors a purely additive change, and `gemini-3.5-transcribe` (speech-to-text with diarization and timestamps) is the natural upgrade if speaker attribution becomes a requirement.

---

## Open decisions requiring input

Listed in full with recommendations in the Phase 0 final report; summarized here for the record:

1. **Vercel plan** — Hobby (5-minute functions) or Pro (800 s)? Affects how aggressively processing must be staged.
2. **Demo video length** — 50 MB Supabase cap suggests ~5 minutes; confirms the demo asset budget.
3. **Auth method** — magic link only, or email/password as well?
4. **Flash-Lite vs Flash for generation** — decide after Phase 12 evaluation measures multi-document synthesis.
5. **Reranking** — enable only if evaluation shows measurable gain.

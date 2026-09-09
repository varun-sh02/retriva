# Retriva — API Contracts

**Status:** Phase 0 design. No route files written. TypeScript below is illustrative schema notation, not source.

---

## 1. Conventions

### Authentication

Every `/api/*` route except health authenticates with the Supabase session cookie. The pattern is identical everywhere:

```ts
const { user, workspaceId, supabase } = await requireSession();
// throws 401 if no valid session
// workspaceId is derived from user.id — NEVER read from the request
```

`requireSession()` returns a Supabase client **bound to the user's session**, so RLS applies to every query made through it.

### Ownership

Resource IDs in a path or body are always treated as untrusted claims:

```ts
const kb = await requireKnowledgeBase(supabase, workspaceId, knowledgeBaseId);
// SELECT ... WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
// 404 (not 403) if the row does not resolve
```

**404, never 403,** for a resource the user does not own. A 403 confirms the resource exists, which leaks the existence of another tenant's data.

### Validation

Every request body, query string, and path parameter is parsed with Zod at the route boundary. Anything not matching the schema is a 400 before any I/O occurs.

### Error envelope

```ts
type ApiError = {
  error: {
    code: string;      // stable machine code, e.g. "KB_NOT_FOUND"
    message: string;   // user-safe; never a stack trace or internal detail
    details?: unknown; // Zod field errors only, on 400
  };
};
```

| Status | When |
|---|---|
| 400 | Zod validation failure |
| 401 | No valid session |
| 404 | Resource does not exist *or* is not owned by the caller |
| 409 | Conflict — duplicate name, duplicate file, invalid state transition |
| 413 | Declared size exceeds the limit |
| 415 | Unsupported MIME type |
| 429 | Upstream rate limit surfaced after retries |
| 500 | Unexpected; correlation ID returned, details logged server-side only |
| 503 | Named upstream unavailable (Gemini, Qdrant) |

Detailed errors go to structured server logs with a correlation ID. The browser receives only the safe message and that ID.

### Common types

```ts
type DocumentStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
type ContentType    = "pdf" | "docx" | "text" | "markdown" | "image" | "video";
type ProcessStage   = "PENDING" | "EXTRACTING" | "CHUNKING"
                    | "EMBEDDING" | "INDEXING" | "DONE";

type Citation = {
  sourceId: string;          // "SOURCE_1"
  chunkId: string;
  documentId: string;
  documentName: string;
  contentType: ContentType;
  excerpt: string;
  pageNumber?: number;
  startTimestamp?: number;   // seconds
  endTimestamp?: number;
  sectionPath?: string;
  score: number;
};
```

---

## 2. Knowledge bases

### `POST /api/knowledge-bases`

Create a knowledge base.

```ts
// Request
{ name: string /* 1–120 */, description?: string /* ≤ 500 */ }

// 201
{ id, name, description, documentCount: 0, createdAt, updatedAt }
```

- Ownership: `workspace_id` taken from the session. A `workspaceId` in the body is ignored, not honored.
- 409 `KB_NAME_TAKEN` when the name already exists in the workspace, case-insensitively.

### `GET /api/knowledge-bases`

```ts
// 200
{ knowledgeBases: Array<{
    id, name, description,
    documentCount: number,
    readyCount: number,
    processingCount: number,
    failedCount: number,
    updatedAt
  }> }
```

Counts come from the `knowledge_base_stats` view. Sorted by `updatedAt` descending.

### `GET /api/knowledge-bases/:id`

404 if not owned. Returns the KB plus its aggregate counts.

### `PATCH /api/knowledge-bases/:id`

```ts
{ name?: string, description?: string }   // at least one required
```

### `DELETE /api/knowledge-bases/:id`

Cascading delete across three systems, in strict order:

1. Set `deleted_at` — the KB immediately disappears from every query and from retrieval.
2. `qdrant.delete(filter: { workspace_id, knowledge_base_id })`.
3. Delete the `ws/{ws}/kb/{kb}/` storage prefix.
4. Hard-delete the Postgres row; cascades remove documents, chunks, conversations, messages.

Returns `204`. If step 2 or 3 fails, the KB stays soft-deleted and invisible, the failure is logged, and `202` is returned with `{ status: "cleanup_pending" }`. It is never reported as fully deleted while vectors might remain.

---

## 3. Documents

### `POST /api/documents/upload-url`

Issues a signed URL so the browser uploads **directly** to Supabase Storage, bypassing Vercel's 4.5 MB request-body limit.

```ts
// Request
{
  knowledgeBaseId: string,   // uuid — ownership verified
  filename: string,          // ≤ 255, sanitized for display
  mimeType: string,          // must be in the allowlist
  sizeBytes: number          // 1 … 52_428_800
}

// 201
{
  documentId: string,
  storagePath: string,       // server-generated
  signedUrl: string,         // single object path
  token: string,             // for supabase.storage.uploadToSignedUrl
  expiresIn: 7200            // fixed by Supabase Storage (2h) — not configurable by the caller
}
```

- 415 `UNSUPPORTED_MIME` for anything outside the allowlist.
- 413 `FILE_TOO_LARGE` above 50 MB (the Supabase free-tier ceiling).
- Creates the document row with `status: "UPLOADING"` before returning.
- `storagePath` is derived from server-resolved IDs. A client-supplied path is not accepted in any form.

### `POST /api/documents/:id/confirm`

Called after the direct upload finishes.

```ts
// Request
{}   // documentId is in the path; nothing is trusted from the body

// 200
{ documentId, status: "PROCESSING", stage: "PENDING" }
```

Server-side on confirm:

1. Verify document ownership and that `status === "UPLOADING"`.
2. `stat` the storage object — 409 `UPLOAD_NOT_FOUND` if absent.
3. Compare actual size to the declared size; mismatch fails the document.
4. **Sniff the real MIME from magic bytes.** A mismatch with the declared type fails with 415.
5. Compute sha256; 409 `DUPLICATE_DOCUMENT` (with the existing document's ID) if already in this KB.
6. Set `status: "PROCESSING"`, `stage: "PENDING"`.

### `POST /api/documents/:id/process`

Advances the ingestion state machine by **at most one stage**, then returns. The client re-invokes while `done` is false.

```ts
// Request
{ force?: boolean }   // force: true resets to PENDING and reprocesses

// 200
{
  documentId: string,
  status: DocumentStatus,
  stage: ProcessStage,
  progress: { current: number, total: number, unit: "pages" | "chunks" | "segments" },
  done: boolean,              // true when READY or FAILED
  error?: string
}
```

- `maxDuration = 300` (the Vercel Hobby ceiling).
- **Idempotent and concurrency-safe.** The row is claimed with `UPDATE … WHERE id = $1 AND processing_lock IS NULL` returning the row; a second concurrent call gets 409 `ALREADY_PROCESSING`. The lock carries a timestamp and is considered stale after 6 minutes, so a killed function cannot wedge a document permanently.
- Never returns partial content to the client. Progress only.

### `GET /api/documents/:id/status`

Cheap polling endpoint. Same shape as `/process` minus `done`, plus `updatedAt`. Client polls every 2 s while processing, backing off to 5 s after 60 s.

### `GET /api/knowledge-bases/:id/documents`

```ts
// Query: ?status=READY&cursor=…&limit=50
// 200
{
  documents: Array<{
    id, name, mimeType, contentType, sizeBytes,
    status, stage, chunkCount, errorMessage, createdAt
  }>,
  nextCursor: string | null
}
```

### `GET /api/documents/:id`

Document metadata plus `metadata` (page count, duration, dimensions) and a `previewUrl` — a signed download URL valid for 5 minutes, minted per request after the ownership check. Signed URLs are never stored or cached.

### `DELETE /api/documents/:id`

Same ordered cascade as KB deletion, scoped to one document: soft-delete → Qdrant delete by `document_id` → storage object delete → hard delete. `204`, or `202 { status: "cleanup_pending" }`.

---

## 4. Chat

### `POST /api/chat`

The only streaming endpoint.

```ts
// Request
{
  knowledgeBaseId: string,
  conversationId?: string,   // omitted → a new conversation is created
  message: string            // 1 … 2000
}
```

Response: `text/event-stream`.

```text
event: meta
data: {"conversationId":"…","messageId":"…"}

event: status
data: {"phase":"searching"}

event: status
data: {"phase":"synthesizing"}

event: delta
data: {"text":"The team chose PostgreSQL"}

event: citations
data: {"citations":[ …Citation[] ]}

event: done
data: {"messageId":"…","usage":{"inputTokens":0,"outputTokens":0,"latencyMs":0}}
```

Error mid-stream:

```text
event: error
data: {"code":"GENERATION_FAILED","message":"The response was cut short. Try asking again."}
```

Behavior:

- `maxDuration = 60`, Node runtime.
- Ownership on `knowledgeBaseId` **and** `conversationId` is verified before any upstream call.
- A `conversationId` belonging to a different knowledge base is a 404, not a silent reassignment.
- The user message is persisted before generation starts, so a failed turn is still visible in history.
- `citations` is emitted after the text completes — see [rag-pipeline.md](./rag-pipeline.md) §6.
- Client abort cancels the Gemini stream and persists the partial message as `interrupted`.
- **No idempotency key in the MVP.** Chat is naturally at-most-once from the UI (the composer disables while streaming), and a duplicated question is a visible, harmless outcome. Idempotency keys are reserved for `/process`, where duplication would corrupt the index — and that is handled by the processing lock.

### `GET /api/conversations?knowledgeBaseId=…`

```ts
{ conversations: Array<{ id, title, messageCount, updatedAt }>, nextCursor }
```

### `GET /api/conversations/:id`

```ts
{
  conversation: { id, knowledgeBaseId, title, createdAt },
  messages: Array<{
    id, role, content,
    citations: Citation[],     // from messages.citations JSONB — one read, no joins
    createdAt
  }>
}
```

### `DELETE /api/conversations/:id`

Cascades to messages and citations. No external cleanup needed. `204`.

---

## 5. Evidence

### `GET /api/sources/:chunkId`

Backs the evidence drawer. Everything needed to render a source without a second round trip.

```ts
// 200
{
  chunkId, documentId, documentName, contentType,
  content: string,                 // full chunk text, not just the excerpt
  pageNumber?: number,
  startTimestamp?: number,
  endTimestamp?: number,
  sectionPath?: string,
  metadata: Record<string, unknown>,   // OCR entities, detected objects
  assetUrl: string,                    // signed, 5-minute expiry
  assetKind: "pdf" | "image" | "video" | "none"
}
```

- Ownership is checked on the **chunk**, resolving up through document → KB → workspace.
- `assetUrl` is minted per request and never persisted.
- A chunk whose document has been deleted returns 410 `SOURCE_UNAVAILABLE`, and the UI shows the snapshotted excerpt from `citations.excerpt` with a "source removed" note. Historical answers stay honest rather than breaking.

---

## 6. System

### `GET /api/health`

Unauthenticated, no secrets in the response.

```ts
{ status: "ok" | "degraded", checks: { db: boolean, qdrant: boolean, gemini: boolean } }
```

Doubles as the Qdrant free-cluster keep-alive target — the free cluster suspends after a week of inactivity, so a scheduled ping to this endpoint prevents a dead demo. See [implementation-plan.md](./implementation-plan.md) Phase 14.

### Startup preflight (not an HTTP route)

Runs once at server start, and as a `npm run preflight` script:

1. Validate every environment variable with Zod; fail fast and loudly on anything missing.
2. `ai.models.list()` — assert `GEMINI_MODEL` exists. If it does not, **fail with a clear configuration error** naming the available Flash-Lite models. Never silently substitute; fall back to `GEMINI_FALLBACK_MODEL` only when that is explicitly configured, and log the substitution at warn level.
3. Assert the Qdrant collection exists with the expected vector size and distance, and that the required payload indexes are present; create them if absent.
4. Assert `EMBEDDING_DIMENSIONS` matches the collection's configured vector size. Mismatch is a hard failure — a wrong dimension silently destroys retrieval.

---

## 7. Route summary

| Method | Path | Auth | Ownership check | Streaming |
|---|---|---|---|---|
| POST | `/api/knowledge-bases` | ✅ | workspace from session | |
| GET | `/api/knowledge-bases` | ✅ | RLS | |
| GET | `/api/knowledge-bases/:id` | ✅ | KB | |
| PATCH | `/api/knowledge-bases/:id` | ✅ | KB | |
| DELETE | `/api/knowledge-bases/:id` | ✅ | KB | |
| POST | `/api/documents/upload-url` | ✅ | KB | |
| POST | `/api/documents/:id/confirm` | ✅ | document | |
| POST | `/api/documents/:id/process` | ✅ | document | |
| GET | `/api/documents/:id/status` | ✅ | document | |
| GET | `/api/documents/:id` | ✅ | document | |
| DELETE | `/api/documents/:id` | ✅ | document | |
| GET | `/api/knowledge-bases/:id/documents` | ✅ | KB | |
| POST | `/api/chat` | ✅ | KB + conversation | ✅ SSE |
| GET | `/api/conversations` | ✅ | KB | |
| GET | `/api/conversations/:id` | ✅ | conversation | |
| DELETE | `/api/conversations/:id` | ✅ | conversation | |
| GET | `/api/sources/:chunkId` | ✅ | chunk → document → KB | |
| GET | `/api/health` | — | — | |

**No route accepts `workspaceId` from the client.** It is always derived from the session. This is the single most important invariant in the API surface.

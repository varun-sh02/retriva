# Retriva — Multimodal Ingestion

**Status:** Phase 0 design.

Every modality follows the same skeleton, and each section below states which steps use Gemini and which run locally on the server.

```text
Original file → Storage → Processing → Representation → Chunking → Embedding → Qdrant → Citation metadata
```

---

## 0. The governing decision

`gemini-embedding-2` is genuinely multimodal — text, image, video, audio, and PDF map into one shared space. But its **per-request limits** are tight:

| Input | Limit per request |
|---|---|
| Text | 8,192 tokens |
| Images | 6 |
| Video | 120 seconds |
| Audio | 180 seconds |
| PDF | 1 file, 6 pages |

A 40-page PDF cannot be embedded as a PDF in any useful way, and a 30-minute meeting video is 15× the video limit. More importantly, embedding a PDF *as a PDF* produces one vector for six pages — which destroys the page-level citation that is a core product promise.

**Therefore:** every modality is converted into **semantic text records** that are embedded as text, with one exception — images additionally get a **native image vector** in the same space, because a single image fits comfortably within the limits and true cross-modal image retrieval is a real differentiator rather than a described one.

This is not "faking multimodal." Gemini's vision model genuinely reads the PDF's diagrams and tables, genuinely watches the video, and genuinely describes the image. The multimodal understanding is real; the *embedding* is normalized to text because that is what the API's limits and the product's citation requirements demand. The architecture keeps direct multimodal embedding as a drop-in addition — `chunks.vector_kind` already distinguishes vector provenance, and adding native video-clip vectors later requires no schema change.

### Modality routing table

| `content_type` | MIME types accepted | Understanding | Embedded as |
|---|---|---|---|
| `pdf` | `application/pdf` | Gemini vision | text chunks (page-scoped) |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | local (mammoth) | text chunks |
| `text` | `text/plain` | local | text chunks |
| `markdown` | `text/markdown` | local | text chunks |
| `image` | `image/png`, `image/jpeg`, `image/webp` | Gemini vision | text chunk **+ native image vector** |
| `video` | `video/mp4`, `video/quicktime` | Gemini video | text chunks (time-scoped) |

---

## 1. PDF

```text
Original file
    ↓  browser → signed URL → Supabase Storage (SERVER-ISSUED URL)
Storage: documents/ws/{ws}/kb/{kb}/{doc}/original.pdf
    ↓
Processing
    ├─ [LOCAL]  page count via a lightweight PDF reader (unpdf)
    ├─ [GEMINI] upload to Files API → file URI (48h)
    └─ [GEMINI] gemini-3.5-flash-lite structured extraction, batched by page range
    ↓
Representation: page-tagged markdown, one record per page
    ↓
Chunking  [LOCAL] page-aware, never spans a page
    ↓
Embedding [GEMINI] gemini-embedding-2, text input, 1536-d
    ↓
Qdrant    content_type: "pdf", page_number: n
    ↓
Citation: filename + page number + excerpt + deep link #page=n
```

### Why Gemini vision instead of local text extraction

A local extractor (`unpdf`, `pdf-parse`) returns the text layer only. Gemini's PDF handling is **native vision** — the documentation states it interprets "text, images, diagrams, charts, and tables." For a product whose demo dataset includes architecture documents, the diagrams and tables *are* the content. A scanned or diagram-heavy PDF returns nearly nothing from a text-layer extractor.

The local reader is still used, for one job: getting the page count cheaply so extraction can be batched.

### Extraction request

Structured output, one call per page batch:

```jsonc
// responseSchema
{
  "type": "object",
  "properties": {
    "pages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pageNumber":  { "type": "integer" },
          "markdown":    { "type": "string" },
          "sectionPath": { "type": "string" },
          "hasVisuals":  { "type": "boolean" }
        },
        "required": ["pageNumber", "markdown"]
      }
    }
  }
}
```

The prompt instructs: transcribe all text faithfully; describe diagrams, charts, and images in prose where they appear; render tables as markdown tables; do not summarize; do not skip content; return the true printed page number.

**Batching:** 10 pages per call. At 258 tokens per page that is ~2,600 input tokens per call — comfortable, and it keeps any single failure to a small, retryable unit. `stage_cursor.extractedThroughPage` records progress so a function timeout resumes at the right page.

**Limits:** Gemini accepts PDFs up to 50 MB / 1000 pages, which is at or above the Supabase free-tier 50 MB upload cap, so the storage limit binds first. Documents over ~200 pages are accepted but warned about in the UI, since extraction will take several `/process` round trips.

### Page-number fidelity

`pageNumber` returned by the model is cross-checked against the batch's known page range. A value outside the range is discarded and replaced with the positional index. Citations must never carry a hallucinated page number, so the model's own page numbering is treated as a hint, not a fact.

### Chunking

Page-aware, per [rag-pipeline.md](./rag-pipeline.md) §2.1. Chunks never cross pages. A page smaller than the 80-token minimum merges with an adjacent page in the same section, and the chunk then stores a page range in `metadata.page_range` while `page_number` holds the first page.

### Citation metadata

```jsonc
{
  "content_type": "pdf",
  "page_number": 12,
  "section_path": "Architecture > Persistence",
  "document_name": "architecture-final.pdf"
}
```

Evidence drawer renders the excerpt and an "Open document" action that opens a signed URL with `#page=12`, which every major PDF viewer honors.

---

## 2. DOCX

```text
Original file
    ↓
Storage: .../original.docx
    ↓
Processing [LOCAL ONLY — no Gemini]
    └─ mammoth → HTML → markdown (headings, lists, tables, bold/italic preserved)
    ↓
Representation: markdown with heading hierarchy
    ↓
Chunking  [LOCAL] heading-aware
    ↓
Embedding [GEMINI] gemini-embedding-2, text, 1536-d
    ↓
Qdrant    content_type: "docx", section_path
    ↓
Citation: filename + section path + excerpt
```

**Gemini is not used here.** Gemini's own documentation is explicit that "document vision only meaningfully understands PDFs" — other formats are extracted as plain text, losing structure. `mammoth` reads DOCX's actual XML and preserves heading levels, lists, and tables *better* than routing it through a vision model, at zero API cost and zero latency.

Mammoth's HTML output is converted to markdown with a style map that turns Word heading styles into `#`/`##`/`###`, so `section_path` is populated properly.

**Known limitation:** images embedded inside a DOCX are dropped in the MVP. Extracting them, storing them as derived assets, and running them through the image pipeline is a clean Phase 11 extension — the schema already supports a chunk whose parent document is a DOCX but whose `vector_kind` is `image`.

**Citation granularity:** DOCX has no stable page concept (pagination is a rendering artifact). Citations use `section_path` instead of a page number. Claiming a page number for a DOCX would be inventing provenance.

---

## 3. TXT and Markdown

```text
Original file
    ↓
Storage: .../original.md
    ↓
Processing [LOCAL ONLY]
    ├─ decode as UTF-8 (reject invalid encodings)
    └─ markdown: parse heading tree; txt: infer blank-line-separated blocks
    ↓
Representation: text with section_path
    ↓
Chunking  [LOCAL] heading-aware for markdown; paragraph-recursive for txt
    ↓
Embedding [GEMINI] gemini-embedding-2, text, 1536-d
    ↓
Qdrant    content_type: "markdown" | "text", section_path
    ↓
Citation: filename + section path + excerpt
```

Markdown is parsed to an AST so heading nesting builds an accurate `section_path`, and fenced code blocks are never split mid-block. Front-matter, if present, is stripped from content and stored in `documents.metadata`.

For plain text with no headings, `section_path` is null and citations fall back to filename plus excerpt. This is the fastest and cheapest path in the system — no Gemini call before embedding.

---

## 4. Images

Images get **two** records, both pointing at the same original file. This is the one place the MVP uses genuinely native multimodal embedding.

```text
Original file
    ↓
Storage: .../original.png
    ↓
Processing
    ├─ [LOCAL]  validate real MIME by magic bytes; reject mismatches
    ├─ [LOCAL]  if WebP → transcode to PNG into derived/ (see note)
    ├─ [GEMINI] gemini-3.5-flash-lite structured vision analysis
    └─ [GEMINI] gemini-embedding-2 on the image bytes → native image vector
    ↓
Representation
    ├─ semantic text record (description + OCR + entities + relationships)
    └─ raw image
    ↓
Chunking  [LOCAL] one semantic record per image; never split
    ↓
Embedding
    ├─ [GEMINI] text record  → vector_kind: "text"
    └─ [GEMINI] image bytes  → vector_kind: "image"
    ↓
Qdrant    two points, same document_id, content_type: "image"
    ↓
Citation: filename + image preview + detected entities
```

### Vision analysis

Structured output:

```jsonc
{
  "description":   "string — what the image shows, in prose",
  "ocrText":       "string — all legible text, verbatim",
  "entities":      ["string"],
  "relationships": ["string — e.g. 'Frontend → API'"],
  "imageType":     "diagram | screenshot | photo | chart | document_scan | other"
}
```

The embedded text record is assembled from these fields into one coherent block, matching the spec's §11.3 example. Structured fields are also kept in `chunks.metadata` so the evidence drawer can render "Detected: PostgreSQL, Redis, Next.js" as chips rather than parsing prose.

### Why two vectors

They fail differently, and covering both failure modes is what makes image retrieval actually work:

- The **text vector** matches conceptual queries — "what does the architecture look like?" retrieves it because the description says "architecture diagram."
- The **image vector** matches queries the description happened to omit. Vision descriptions are lossy; an unmentioned label in the corner of a diagram is still present in the image embedding.

Both live in the same 1536-d space, so a single query vector searches both in one call — no extra query cost. Deduplication by `document_id` at rerank time keeps one image from occupying two of the five context slots. When the image vector wins, its *text* record is what enters the prompt, because the generator needs words.

### WebP note

The spec requires WebP support, and a reported issue indicates the `embedContent` endpoint accepted only PNG and JPEG for the preview model. The stable model's exact image MIME list is not documented explicitly. **Mitigation:** WebP uploads are accepted, stored as-is (the original is preserved), and transcoded to PNG into `derived/` for the embedding and vision calls. This costs one `sharp` transcode and removes the dependency on an undocumented format list entirely — it also protects against the same issue with any other format. See [technical-decisions.md](./technical-decisions.md) ADR-011.

---

## 5. Video

Video is not a document with a timeline bolted on. It gets an explicit temporal retrieval model.

```text
Original file
    ↓
Storage: .../original.mp4        ← permanent source of truth, ≤ 50 MB (Supabase free tier)
    ↓
Processing
    ├─ [GEMINI] Files API upload → file URI (48h, resumable, up to 2 GB)
    ├─ [GEMINI] poll until file state = ACTIVE
    ├─ [GEMINI] gemini-3.5-flash-lite: timestamped semantic segmentation
    └─ [LOCAL]  validate and clamp every timestamp against known duration
    ↓
Representation: ordered segments, each 30–120s, with transcript + visual description
    ↓
Chunking  [LOCAL] one chunk per segment (segments ARE the chunks)
    ↓
Embedding [GEMINI] gemini-embedding-2, text, 1536-d
    ↓
Qdrant    content_type: "video", start_timestamp, end_timestamp
    ↓
Citation: filename + MM:SS–MM:SS + excerpt + "Play from 23:41"
```

### Why the Files API, and why it is scratch only

Inline video is limited to files under 100 MB and under one minute. The Files API accepts up to 2 GB on the free tier and is the documented path for anything ≥ 10 minutes. It is free.

But Files API objects **expire after 48 hours and cannot be downloaded back**. So Supabase Storage holds the original, always. `documents.gemini_file_uri` and `gemini_file_expires_at` are recorded so a reprocess after expiry knows to re-upload rather than failing on a dead URI.

### Segmentation

One structured-output call over the whole video:

```jsonc
{
  "durationSeconds": 0,
  "segments": [{
    "startSeconds": 0,
    "endSeconds": 0,
    "title": "string — short topic label",
    "transcript": "string — verbatim spoken content",
    "visualContext": "string — what is on screen, if it carries meaning",
    "speakers": ["string"]
  }]
}
```

The prompt instructs: segment by topic shift, not fixed intervals; keep segments between 30 and 120 seconds; transcribe speech verbatim; never invent timestamps; cover the entire video with no gaps.

Gemini supports `MM:SS` timestamp references in prompts and output, samples video at 1 FPS by default, and costs ~100 tokens per second at low resolution. A 30-minute video is ~180k tokens — well inside the 1M window. Media resolution is set to low: this is a talking-heads meeting recording, and 1 FPS at low resolution captures speech and slide content while keeping token use and latency reasonable.

### Timestamp validation — non-negotiable

Timestamps are citation data. A hallucinated timestamp is worse than no citation, because the user clicks "play from 23:41" and lands on nothing, which destroys trust in every other citation on screen.

Validation applied to every segment:

1. `0 ≤ startSeconds < endSeconds ≤ durationSeconds`, with duration read from the container, not from the model.
2. Segments sorted by start; overlaps trimmed.
3. Gaps larger than 5 seconds are logged; the segment is kept but flagged.
4. Any segment failing validation is **dropped**, not repaired by guessing.
5. If more than 30% of segments fail, the document fails with a clear error rather than indexing unreliable evidence.

### Duration limits and the demo

Gemini supports up to 3 hours at low resolution. The binding constraint is Supabase's **50 MB free-tier upload cap** — roughly 10–15 minutes of typical 720p screen recording. The demo video should be ~5 minutes, which is well inside every limit and keeps processing to one or two `/process` round trips.

### Retrieval → playback

A retrieved video chunk carries `start_timestamp`. The evidence drawer renders an HTML5 `<video>` with a signed source URL and sets `currentTime` to `start_timestamp` on open, so "Play from 23:41" plays from 23:41. The player is bounded to the segment's end, with a control to continue past it.

### What is deliberately not in the MVP

- **Native video-clip embeddings.** The 120-second embedding limit means a 30-minute video needs 15+ clip extractions, which requires ffmpeg in a serverless function — infrastructure the non-goals forbid. Transcript-first is the documented MVP strategy. `chunks.vector_kind` makes adding `vector_kind: "video_clip"` later a purely additive change.
- **Frame-level visual search.** Phase 11b at best.
- **Speaker diarization.** `gemini-3.5-transcribe` offers diarization with timestamps and is the natural upgrade if speaker attribution becomes a demo requirement.

---

## 6. Cross-cutting rules

### MIME validation

The client's declared `Content-Type` is a hint and nothing more. On confirm, the server reads the first bytes of the stored object and checks magic numbers. A mismatch between declared and actual type fails the document immediately with "This file type isn't supported yet" — the user does not need to know the file was lying, and an attacker learns nothing.

### Size limits

| Layer | Limit | Enforced where |
|---|---|---|
| Supabase free tier | 50 MB | Storage rejects it; bucket configured with the same cap |
| Application | 50 MB | Zod schema at upload-URL issuance |
| Gemini PDF | 50 MB / 1000 pages | Below the storage cap; not binding |
| Gemini video (Files) | 2 GB free tier | Not binding |

### Duplicate uploads

`documents.checksum` (sha256) is computed at confirm. A duplicate within the same knowledge base is rejected with "This file is already in this knowledge base" and a link to the existing document. Across different knowledge bases, duplicates are allowed — the same PDF legitimately belongs to two projects, and they must index and delete independently.

### Reprocessing

`POST /api/documents/:id/process` with `{ "force": true }` resets `stage` to `PENDING` and re-runs. `CHUNKING` deletes existing chunks in a transaction before inserting, and `INDEXING` upserts by fixed point ID, so reprocessing converges rather than duplicating. Used after a transient failure and after an ingestion improvement ships.

### Partial failures

A document is `READY` only when every chunk is embedded and indexed. There is no partially-ready state: a document that appears ready but is missing half its content produces confidently incomplete answers, which is the failure mode this product exists to prevent.

Within a stage, a single failed unit (one PDF page batch, one video segment) is retried twice, then dropped with a record in `processing_runs`. If more than 20% of units fail, the document fails as a whole.

### What runs where — summary

| Step | Local / server | Gemini |
|---|---|---|
| MIME sniffing, size checks, checksum | ✅ | |
| PDF page count | ✅ | |
| PDF content extraction | | ✅ vision |
| DOCX → markdown | ✅ mammoth | |
| TXT/MD parsing | ✅ | |
| WebP → PNG transcode | ✅ sharp | |
| Image description / OCR / entities | | ✅ vision |
| Video transcript + segmentation | | ✅ Files API + vision |
| Timestamp validation | ✅ | |
| Chunking (all modalities) | ✅ | |
| Text embedding | | ✅ `gemini-embedding-2` |
| Image embedding | | ✅ `gemini-embedding-2` |
| Qdrant upsert | ✅ | |

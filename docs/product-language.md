# Product Language

The canonical vocabulary for Retriva's interface, marketing, and documentation. One
concept, one word, everywhere.

Code and database names are **not** bound by this document — `documents`, `chunks`, and
`conversations` stay as they are (renaming tables is not a design decision). This governs
what the *user* reads.

---

## 1. The core nouns

| Term | Means | Rules |
| --- | --- | --- |
| **Workspace** | The tenancy boundary — one account's data. | **Never shown in the UI.** There is no workspace switcher and no workspace page. It exists in code (`workspace_id`) and in security documentation only. If it ever becomes user-visible, revise this row first. |
| **Knowledge base** | The user-facing container. A body of material about one subject that gets asked questions as a unit. | Sentence case in prose and UI: "knowledge base", "knowledge bases". Title Case only as a page heading. Never abbreviate to "KB" in the UI. `kb` is fine in code and URLs. |
| **Source** | Anything you have added to a knowledge base. The general-purpose word. | The default noun. Use it whenever the kind doesn't matter: "3 sources", "Add sources", "No sources yet". |
| **Document** / **Image** / **Recording** | The three *kinds* of source. | Use only when the kind is the point. A PDF, DOCX, TXT or MD file is a **document**. PNG/JPEG/WebP is an **image**. MP4/MOV is a **recording** — never "video file", never "media". **Recording** is settled vocabulary but not yet shipped vocabulary: see [Status: video](./product-positioning.md#video-status). |
| **File** | What you drag in, at the moment you drag it in. | Correct at the upload boundary only: "Drop files here", "This file couldn't be read". Once it is in the knowledge base it is a **source**. The rule: *you add files; they become sources.* |
| **Chat** | One thread of questions and answers. | The user-facing word. "New chat", "No chats yet", the **Ask** tab. |
| **Conversation** | The same thing, in code and in the database. | Never in the UI. |
| **Question** / **Answer** | What the user sends; what Retriva returns. | Say "answer", never "response", "output", "generation", or "completion". |
| **Evidence** | Collectively, the material an answer stands on. | The name of the panel. Singular and uncountable — "the evidence", "3 pieces of evidence", never "evidences". |
| **Citation** | One numbered reference inside an answer, and the badge that renders it. | A citation *points to* evidence. The badge shows only the number. |
| **Excerpt** | The passage of real source text shown as evidence. | This is what a "chunk" is called in the UI. The word *chunk* never appears on screen. |
| **Match strength** | How closely a retrieved passage matched the question. | Only if we ever surface the score. Never "score", "similarity", "cosine", or a raw number — use a three-step scale (Strong / Moderate / Weak). |
| **Shared chat** | A knowledge base published for people without an account. | The capability. |
| **Widget** | The embeddable form of a shared chat — the script tag and the bubble. | The artifact you install. "Shared chat" is the thing; "widget" is how it appears on your site. |

## 2. Processing vocabulary

The pipeline has real checkpointed stages (`src/lib/ingestion/state-machine.ts`). Each
maps to exactly one user-facing phrase. **Never invent a stage the server did not
report, and never show a progress bar for a stage whose duration is unknown.**

| Real stage | Shown to the user | Notes |
| --- | --- | --- |
| *(client upload)* | **Uploading** — with real percentage | The only genuine percentage in the product; it comes from `XMLHttpRequest.upload.onprogress`. |
| *(confirm)* | **Checking file** | Fast. Usually invisible. |
| `PENDING`, `EXTRACTING` | **Reading** | Modality-specific variants below. |
| `CHUNKING` | **Organizing** | |
| `EMBEDDING`, `INDEXING` | **Making searchable** | Two stages, one phrase — the distinction is meaningless to a user. |
| `DONE` / status `READY` | **Ready** | |
| status `FAILED` | **Couldn't process** | Never "Error", never "FAILED". |

**Modality-specific "Reading" copy.** The server knows `content_type`, so use it:

| Kind | Copy |
| --- | --- |
| PDF | Reading pages |
| DOCX / TXT / MD | Reading document |
| Image | Looking at image |
| Video *(coming soon)* | Listening to recording |

These are accurate descriptions of what actually happens (Gemini vision over rendered
pages; transcript extraction over video), not decoration. The video row is written and
ready but does not reach users until video ships — [Status: video](./product-positioning.md#video-status).

**Status words are sentence case.** Never `PROCESSING`, `READY`, `UPLOADING`. Shouting
caps read as a database dump and are announced letter-by-letter by some screen readers.

## 3. Words that are banned from the interface

These describe the machine, not the product. Their presence anywhere a user can see is a
bug.

`chunk` · `embedding` · `vector` · `vector database` · `index` (as a noun) · `indexing`
(as user-facing copy) · `RAG` · `retrieval` · `retriever` · `topK` · `score` ·
`similarity` · `cosine` · `Qdrant` · `Gemini` · `Supabase` · `token` · `prompt` ·
`pipeline` · `state machine` · `stage` (as a raw value) · `MIME type` · `checksum` ·
`bucket` · `workspace`

Two carve-outs: technical terms may appear in developer-facing embed instructions on the
Share tab (a script tag is for a developer), and Gemini may be named in a security or
subprocessor disclosure where naming it is the point.

## 4. Verbs

| Use | Not |
| --- | --- |
| **Add** sources | Upload (except at the literal drop moment), import, ingest |
| **Ask** | Query, prompt, search, chat with |
| **Check** / **See the evidence** | Verify (stiff), audit, inspect, trace (fine in marketing, too cold in UI) |
| **Open** a source | View, preview, launch |
| **Share** a knowledge base | Publish, deploy, expose |
| **Remove** a source | Delete (keep *Delete* for the destructive confirm button itself, where bluntness is correct) |

## 5. Sentence patterns

**Empty states** follow one shape, always three parts: *what this is → why it matters →
what to do.*

> **Nothing here yet.**
> Add documents or images and Retriva will make them answerable — with every answer
> pointing back to where it came from.
> `[ Add sources ]`

Once video ships ([Status: video](./product-positioning.md#video-status)) the second line
becomes "Add documents, images, or recordings…". The sentence is built to take the third
noun without any other rewrite.

**Errors** follow one shape: *what happened (plain) → what is still true (reassurance) →
what to do (action).* Never lead with a code or a stack detail.

> **We couldn't finish reading this file.**
> Your original file is safe and still stored. You can try again.
> `[ Try again ]`  ·  `Show details`

The technical reason goes behind *Show details*. It is never the headline.

**The refusal** is fixed copy and must not be paraphrased — it is asserted in
`src/lib/chat/prompt.ts` and asserted again in the eval suite:

> I couldn't find enough evidence in this knowledge base to answer that confidently.

In the UI this is presented as a deliberate, composed state — not as an error. See
[ux-principles.md](./ux-principles.md) §4.

## 6. Capitalization and typography

- **Sentence case everywhere**: buttons, headings, tabs, menu items, toasts. "Add
  sources", not "Add Sources".
- **Product name**: Retriva. Never all-caps, never lowercase.
- **Numerals**: digits always — "3 sources", not "three sources".
- **Page references**: `p. 12` in compact chips; "Page 12" in the evidence panel heading.
- **Timestamps**: `m:ss` under an hour (`23:41`), `h:mm:ss` above it. Ranges use an en
  dash with no spaces: `23:41–24:15`.
- **Ellipsis**: the character `…`, never three periods. In-progress labels take one:
  "Reading pages…". Completed states do not.
- **Dashes**: em dash `—` for parenthetical breaks, en dash `–` for numeric ranges.
- **Coordinates are monospace.** Page numbers, timestamps, counts and identifiers use
  `font-mono` (IBM Plex Mono, already loaded in `src/app/layout.tsx`). Prose never does.

## 7. Terms glossary for non-obvious UI

Copy that has to explain a concept, written once here so it is worded the same everywhere.

| Concept | Approved explanation |
| --- | --- |
| Why an answer has numbers in it | "Each number opens the exact passage that claim came from." |
| What the evidence panel shows | "The original passage, exactly as it appears in your source." |
| Why a source is unavailable | "This source was removed from the knowledge base. Here is the passage the answer was based on." |
| What sharing does | "Anyone with the link can ask questions about this knowledge base. They can't see your sources, add to them, or reach your other knowledge bases." |
| Why processing takes a moment | "Retriva is reading this so it can answer questions about it later." |
| What a knowledge base is, to a first-time user | "A knowledge base is one body of material you ask questions about — a project, a client, a product area." |

## 8. Known drift to fix

Current copy that violates this document. Cross-referenced in
[ux-principles.md](./ux-principles.md) §10.

| Location | Problem |
| --- | --- |
| `KnowledgeBaseNav.tsx` | Tab is **Documents**; the knowledge base also holds images and recordings. → **Sources**. |
| `KnowledgeBaseNav.tsx` | Tab is **Widget**, which names the artifact rather than the action. → **Share**. |
| `DocumentRow.tsx` | Badge renders raw `UPLOADING` / `PROCESSING` / `READY` / `FAILED` in caps; stage shown as raw lowercase enum (`extracting`). |
| `DocumentList.tsx` | "No documents yet. Drag a file into the dropzone above" — names a UI element ("dropzone"), and says *documents*. |
| `ChatShell.tsx` | "Ask anything about this knowledge base. Answers are grounded in your uploaded documents." — "grounded" is our word, not the user's; "documents" is wrong; no suggested questions. |
| `app/page.tsx` (app home) | "Select a knowledge base" — describes a mechanism, teaches nothing. |
| `UploadDropzone.tsx` | Stage label "Indexing knowledge…" uses a banned word. → "Making searchable". |
| `AppShell.tsx` | "⌘K to switch" shows the Mac glyph unconditionally. |
| Landing page | Feature cards name "pipeline", "row-level security", "rolling summary" — implementation detail as positioning. |

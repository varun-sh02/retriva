# UX Principles

How Retriva behaves. Ten principles, then the specific experiences they govern, then the
audit of what currently violates them.

Vocabulary is fixed by [product-language.md](./product-language.md). Positioning claims
are fixed by [product-positioning.md](./product-positioning.md).

---

## Part I — The principles

### 1. Evidence is not a footnote
The answer and the proof arrive together. A user should never have to ask "where did that
come from?" — the interface has already told them, before they thought to wonder.

This is the principle the entire product is organized around. When a layout decision and
this principle conflict, this principle wins.

### 2. The server owns the truth; the interface only displays it
No filename, page number, timestamp, or excerpt is ever rendered from model output. Every
one is read back from the user's own stored data. This is already true in the pipeline
(`extractCitations`); the interface must never introduce an exception — including in
mocks, demos, and marketing components, which must be visibly labelled as examples.

### 3. Tell the truth about what is happening
Every progress state maps to a real server state. The upload percentage is a real
percentage. "Reading pages" means extraction is genuinely running. There are no
simulated progress bars and no spinner that means "something, probably".

Corollary: if we don't know how long something will take, show an indeterminate state
with an honest label, not a bar creeping to 90% and stopping.

### 4. "I don't know" is a feature, and must look like one
The refusal is Retriva working correctly. It gets a composed, deliberate presentation —
not the styling of an error, not muted grey apology text. A user who sees the refusal
should trust the product *more* than they did a moment earlier.

### 5. Empty states teach the product
Every empty state answers three questions: what is this, why does it matter, what do I do
now. "No documents found" answers none of them. An empty state is the highest-attention
moment in a new user's session and is treated as primary copy, not a fallback.

### 6. The question is the front door
The shortest possible path is: sources are ready → here is something worth asking → first
answer → first piece of evidence. No tour, no wizard, no modal carousel. The product
teaches itself by being used, and suggested questions are the teaching mechanism.

### 7. Density, with air
This is a work tool used for an hour at a time, not a landing page. Prefer a scannable
dense list over decorative cards. Whitespace goes into *separating groups*, not into
inflating rows. A user with 60 sources must be able to see them.

### 8. One accent, and it means something
Saffron marks two things and nothing else: **the primary action**, and **evidence**
(citation badges, cited excerpts, the evidence panel's quote rule). Source kinds are
distinguished by icon, never by color — so a user learns that "coloured = provenance".
Status uses the semantic tokens (`destructive` for failure) and otherwise stays neutral.

### 9. Motion explains relationships
Permitted motion: text streaming in, the evidence panel sliding from the side it is
anchored to, a citation appearing as its claim completes, a source transitioning between
stages, a newly-ready source settling into the list. Everything else is decoration and is
cut. All of it collapses under `prefers-reduced-motion`.

### 10. Accessibility is structural, not a pass at the end
Keyboard reachability, visible focus, correct semantics and announced state changes are
part of "done". A feature that cannot be operated from the keyboard is not finished. This
matters unusually much for Retriva because the evidence interaction — the core loop — is
a dense field of small inline controls inside streaming text.

---

## Part II — Information architecture

### Current structure

```
Workspace (implicit)
└── Knowledge base
    ├── Documents   ← default landing tab
    ├── Chat
    │   └── (second sidebar: chat history)
    └── Widget
```

Four problems:

1. **The default tab is file management.** Every visit to a knowledge base opens on a
   list of files. The product's purpose — asking — is one click away, always.
2. **"Documents" is the wrong noun** and "Widget" names an artifact rather than an
   action. ([product-language.md](./product-language.md) §1)
3. **Two stacked sidebars on the chat route.** The app shell's knowledge-base rail (64) +
   the conversation rail (64) consume 512px of a 1280px screen before any content.
4. **`/app` is a dead end.** With knowledge bases present it renders "Select a knowledge
   base" — a full-viewport empty state that teaches nothing and offers nothing, while the
   data needed to make it useful (`documentCount`, `readyCount`, `processingCount`,
   `failedCount`, `updatedAt`) is already loaded by `listKnowledgeBases`.

### Target structure

```
Workspace (implicit — never surfaced)
└── Knowledge base
    ├── Ask       ← default landing tab
    ├── Sources
    └── Share
```

- **Ask first.** `/app/knowledge-bases/[kbId]` lands on the chat. A knowledge base with no
  ready sources renders the "not ready yet" state described in §III.4 below, which points
  at Sources — so the empty case still routes a first-time user correctly, and the
  returning user (the overwhelming majority of sessions) lands where they meant to go.
- **Sources second.** Renamed from Documents. This is where adding and managing happens.
- **Share third.** Renamed from Widget. Owner configuration, correctly ranked last.

### The two-sidebar problem

On the Ask tab, collapse the app shell's knowledge-base rail to an icon rail or hide it
entirely, leaving the chat-history rail. The knowledge base is already named in the header
and ⌘K already switches between them, so the rail is redundant precisely where space is
scarcest. This is a layout change only — no route or data changes.

### `/app` as a real home

Replace "Select a knowledge base" with the knowledge bases as a scannable list. One row
per knowledge base: name, description, a readiness line ("12 sources · 2 still
processing"), last activity, and **Ask** as the row's primary action. This needs no new
query — `listKnowledgeBases` already returns every field.

Do **not** build a metrics dashboard. No charts, no counters of questions asked, no
activity feed. The home screen's job is to get the user into a knowledge base.

---

## Part III — The experiences

### 1. The core journey

```
Create knowledge base
   → Add sources          (drag and drop; multiple at once)
   → Watch them get ready (real stages, honest labels)
   → See suggested questions derived from what was actually added
   → First answer, streaming
   → First citation, in the text
   → Evidence panel: the real passage, the real page, the real moment
   → Next question
```

The design target is that a user reaches "first citation clicked" in under three minutes
from signup, without reading anything that isn't in the product.

### 2. The evidence experience — three layers

This is Retriva's signature interaction. It is built in three layers because the user's
need escalates: *notice it → survey it → inspect it.*

**Layer 1 — the inline citation.** A small numbered badge sitting immediately after the
claim it supports, inside the paragraph. It answers "which part of this is sourced?"
without any interaction at all.

**Layer 2 — the source rail.** Directly beneath each answer, a row of evidence chips:

```
Architecture-final.pdf · p. 12     Team-meeting.mp4 · 23:41     Product-notes.md
```

Each chip carries a kind icon, the real source name, and the real coordinate. The rail is
always present when an answer has citations — including for an answer the model wrote
without inline markers, and including on page reload, because `message.citations` is
persisted and already loaded by `listMessages`. The rail is what makes evidence feel like
part of the answer rather than an optional extra.

**Layer 3 — the evidence panel.** Opened from either layer. Shows the source name and
kind, the exact coordinate, the original passage with the accent quote rule, the asset
itself (image inline; video seeked to the cited second, once video ships — [Status: video](./product-positioning.md#video-status); PDF with an "Open at page 12"
link), and a way to move to the next and previous piece of evidence for that answer
without closing and reopening.

**The three-layer rule:** a user must be able to complete the loop *answer → citation →
original evidence → back to answer* without losing their place in the conversation. The
panel is a side sheet, not a route change, for exactly this reason.

**Retrieval transparency**, off by default: "Read 5 passages across 3 sources, cited 3."
The `sources` SSE event already carries the passages that went into the answer, with
scores — including the ones the model chose *not* to cite. Showing that Retriva read more
than it quoted is a real trust signal for a sceptical user. Two constraints: the event
carries the final context set (`finalContextChunks: 5`), not the wider candidate set, so
do not describe it as "everything searched"; and it is not persisted (§V.2), so it can
only be offered during the live turn.

### 3. The chat experience

Not a chat app. The visual weight is on the answer and its evidence, not on the exchange.

- **The answer is the page, not a bubble.** User questions are compact and right-aligned;
  answers are full-measure, typographically set for reading. An answer with its evidence
  rail is a composed unit with real vertical separation from the next turn.
- **Streaming is already excellent** — the RAF-paced delta smoother in `useChatStream`
  turns Gemini's lumpy 100-character bursts into steady text. Keep it exactly as it is;
  it is a genuine perceived-quality asset.
- **Phase labels come from real events.** "Searching your knowledge…" → "Reading the
  evidence…" (current copy says "Synthesizing evidence…", which is our word, not the
  user's).
- **Citations appear as their claim completes,** with a short fade. The badge arriving is
  the visible moment of "this part is sourced".
- **Stop generating.** `useChatStream` already exposes `abort()` and it is not wired to
  anything. A streaming answer needs a stop control.

### 4. Chat empty states — two different states

**A. Knowledge base has no ready sources yet.** Do not offer a composer that will
certainly fail.

> **This knowledge base is empty.**
> Add documents, images, or recordings and Retriva will make them answerable — with every
> answer pointing back to where it came from.
> `[ Add sources ]`

While sources are processing:

> **Getting your sources ready.**
> 2 of 3 sources are ready. You can start asking now — answers will improve as the rest
> finish.

**B. Sources are ready, no messages yet.** Show three or four suggested questions. Never
"Ask me anything".

Suggestions are **template-driven from real source metadata** — no extra model call, no
new infrastructure, and they are honest because every name in them is a source that
actually exists:

| Condition | Suggested question |
| --- | --- |
| Always | "What are the main points in *{most recent source}*?" |
| ≥ 2 document sources | "What's different between *{A}* and *{B}*?" |
| A recording exists *(coming soon)* | "What was decided in *{recording name}*?" |
| An image exists | "What does *{image name}* show?" |
| ≥ 3 sources | "Which source covers …?" *(user completes it)* |

The recording row is implemented and simply never fires until a knowledge base can contain
a recording — [Status: video](./product-positioning.md#video-status). It is ranked first in the code on purpose: the day video
ships, the most surprising capability is the first thing a user is offered.

These double as capability disclosure: a user who has never considered asking about a
recording learns they can, at the exact moment it is useful.

The same component serves the owner's chat and the public widget — the widget already
stores owner-authored prompts (`public_suggested_prompts`), so the owner's chat should
use those when set and fall back to the templates when not.

### 5. The processing experience

Adding a source is the beginning of it becoming answerable, and the copy should say so.

- Real stages, mapped to the phrases in [product-language.md](./product-language.md) §2.
- **A real percentage only during upload.** After that, indeterminate with an honest
  label — the pipeline advances one stage per call and cannot predict its own duration.
- Modality-aware copy: "Reading pages" for a PDF, "Looking at image" for a PNG, and
  "Listening to recording" for an MP4 once video ships ([Status: video](./product-positioning.md#video-status)). The server
  knows `content_type`; using it costs nothing and reads as intelligence.
- **One status per source, in one place.** Currently a source in flight shows a caps
  badge, a raw lowercase stage string, and a separate progress row in the upload list —
  three representations of one fact.
- The transition to **Ready** is the payoff moment and deserves a small settle
  animation — it is the moment the knowledge base became more capable.
- A source that is ready shows what it contributed: "Ready · 34 passages" (`chunk_count`
  is already in `DocumentSummary`). This quietly explains what Retriva did with the file.

### 6. Failure

Errors state what happened, what is still true, and what to do — in that order.

> **We couldn't finish reading this file.**
> Your original file is safe and still stored. You can try again.
> `[ Try again ]` · `Show details`

- The technical reason goes behind **Show details**, never in the headline.
- The reassurance is factually true: the file remains in Storage and `/process` with
  `force: true` genuinely re-runs it. Never write reassurance the system cannot honour.
- Failure is per-source and never blocks the rest of the knowledge base. A knowledge base
  with one failed source is still fully usable, and should say so rather than showing a
  global alarm.
- A mid-stream generation failure keeps the partial answer on screen with an inline
  retry, rather than replacing what the user was already reading.

### 7. Onboarding

There is no onboarding flow. There are four well-designed empty states — app home, a new
knowledge base's Sources tab, the chat before any sources, and the chat before any
questions. Together they are the tutorial. No tour, no checklist, no dismissible modal.

The one exception worth building: after a user's **first** source in their **first**
knowledge base becomes ready, bring them to Ask with suggestions already on screen. Once
per account. That single transition is the product's "aha" and is worth an explicit nudge.

### 8. The public widget

The visitor is not the owner, and the widget's job is to be *trustworthy in someone
else's page*.

- Evidence matters more here, not less — an anonymous visitor has no reason to trust an
  embedded box. Showing "Handbook.pdf · p. 12" under an answer is the single strongest
  credibility signal the widget can carry.
- **Blocked today:** `/api/sources/[chunkId]` requires a session, so a visitor cannot open
  the evidence panel. See §V.1 — this needs a share-token-scoped endpoint, which is an
  architecture addition and is documented, not improvised.
- Interim: show the source rail with names and coordinates (already available in the
  streamed citations, no new endpoint required) and make chips non-interactive in the
  widget. Naming the source is most of the trust; opening it is the remainder.

---

## Part IV — Accessibility audit

Concrete defects found in the current code, severity-ordered.

| # | Issue | Where | Severity |
| --- | --- | --- | --- |
| 1 | `aria-live="polite"` wraps the **entire** message list, so every streamed character mutates the live region and the whole conversation is liable to be re-announced. The live region should be a narrow status element (the phase label), with the completed answer announced once. | `MessageList.tsx:32` | **High** |
| 2 | The knowledge-base actions trigger is `opacity-0 group-hover:opacity-100` — keyboard users can focus a button they cannot see. Needs `focus-visible:opacity-100`. | `KnowledgeBaseListItem.tsx:70` | **High** |
| 3 | Citation badges are `h-4 min-w-4` — a 16px target inside flowing text, far under the 44×44 guidance. Keep the visual small; expand the hit area with padding or a pseudo-element. | `Citation.tsx:25` | **High** |
| 4 | `role="img"` and `aria-hidden="true"` on the same element, with no accessible name. Contradictory: pick decorative (`aria-hidden`, drop the role) or named (`role="img"` + `<title>`). | `HeroVisual.tsx:6` | Medium |
| 5 | `<ul role="listbox">` with `<li>` wrappers around `role="option"` buttons breaks the required listbox→option relationship; the input is not a `combobox` and has no `aria-activedescendant`. Keyboard works; screen-reader semantics do not. | `CommandMenu.tsx:78-98` | Medium |
| 6 | Custom `role="button"` dropzone: Space does not `preventDefault()` (page scrolls), there is no accessible name, and the accepted formats are not associated via `aria-describedby`. | `UploadDropzone.tsx:181-199` | Medium |
| 7 | Source status changes (processing → ready → failed) are never announced. Needs a polite live region on the status cell. | `DocumentRow.tsx:128` | Medium |
| 8 | `scrollIntoView({ behavior: "smooth" })` runs unconditionally, ignoring `prefers-reduced-motion`. | `MessageList.tsx:26` | Low |
| 9 | The shortcut hint renders `⌘K` on every platform. | `AppShell.tsx:34` | Low |

Verified as already correct: `Button` has a real `focus-visible` ring; `LiveDemo` fully
honours `prefers-reduced-motion` including its autoplay; the brand tokens were chosen
against measured contrast (`--brand-text` exists precisely because plain Saffron fails
4.5:1 on Paper), and `--muted-foreground` clears 4.5:1 in both themes.

---

## Part V — Architectural constraints surfaced by this design

Per the standing rule that UX must not silently redesign the system, these are recorded
rather than worked around.

1. **The evidence panel is owner-only.** `GET /api/sources/[chunkId]` calls
   `requireSession()`. The public widget therefore cannot open evidence. Closing this
   needs a share-token-scoped source endpoint that resolves through
   `resolvePublicShare()` and verifies the chunk belongs to that knowledge base — the
   same chokepoint pattern `/api/public/chat` already uses. **Not a UI change.** Until it
   exists, widget evidence is display-only.

2. **Retrieval transparency does not survive a reload.** The `sources` SSE event (the full
   retrieved set with scores) is never persisted; only citations are. A "what was
   searched" disclosure can therefore only be offered during the live turn, and must not
   appear on history. Making it durable means writing the retrieved set onto the message
   or reading back from `retrieval_logs` — the latter is explicitly append-only and never
   returned to the browser, so it is not a shortcut.

3. **`assetKind` misclassifies text sources.** `src/app/api/sources/[chunkId]/route.ts`
   derives `assetKind` as `image | video | pdf`, defaulting everything that is not an
   image or video to `"pdf"`. A DOCX, TXT or MD citation therefore offers an "Open
   document" link to a file the browser will download rather than render. The evidence
   panel needs a fourth kind (`text`) that shows the excerpt with its section path and no
   asset link.

4. **Per-source suggested questions are template-driven, deliberately.** Generating
   suggestions with a model call would need a new endpoint, a cache, and a cost budget,
   and would run on content the user has not yet seen. The template approach in §III.4
   uses data already on the page. A model-generated variant is a later enhancement with
   its own design, not a silent addition.

5. **Ask-as-default-tab changes a route's meaning.** `/app/knowledge-bases/[kbId]`
   currently renders Sources. Making it render the chat is a routing change with one real
   consequence: a knowledge base with zero sources must render the "empty" state (§III.4A)
   rather than a dead composer. That state is part of the change, not a follow-up.

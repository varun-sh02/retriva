# Product Positioning

Source of truth for what Retriva is, who it is for, and what we claim. If marketing
copy, UI microcopy, or a pitch deck disagrees with this document, this document wins.

Companion documents: [product-language.md](./product-language.md) (vocabulary),
[ux-principles.md](./ux-principles.md) (how the product behaves),
[marketing-story.md](./marketing-story.md) (landing page),
[demo-story.md](./demo-story.md) (the demo script).

---

## 1. Product definition

Retriva is a multimodal knowledge workspace. You bring in the material you already
have — specifications, contracts, reports, diagrams, screenshots, recorded meetings —
and Retriva makes it answerable in plain language. Ask a question and you get a written
answer synthesized across everything in that knowledge base, with every factual claim
attached to the exact page, frame, or moment it came from. The sources stay; the next
question builds on the same material rather than starting over. Retriva is for the
moment after the answer, when someone asks "are you sure?" — because the answer arrives
with the proof already attached.

## 2. Positioning statement

> **Retriva is a knowledge workspace that answers questions across your documents,
> images, and recordings — and shows you the exact page, frame, or moment behind every
> answer.**

Compressed brand line, for the logo lockup and footer:

> **Answers you can check.**

**Shipping form, until video lands** ([status](#video-status)) — use this wherever the
statement faces a customer:

> **Retriva is a knowledge workspace that answers questions across your documents and
> images — and shows you the exact page or frame behind every answer.**

The full statement is the target and needs no rewrite when video ships; "and recordings"
and "or moment" simply come back. The compressed brand line is unaffected either way.

### Why this and not something else

The market is crowded with "chat with your PDF". That category competes on convenience
and loses on trust: it is a thin wrapper, easily cloned, and nobody believes the output.
Retriva's actual engineering advantage is the opposite one — it is unusually strict
about provenance — so the positioning leads with verification, not conversation.

The claim is not marketing. It is a property of the implementation
(`src/lib/chat/citations.ts`): the model is given numbered labels and may only emit an
integer. Filename, page number, timestamp, and excerpt are all read back from Postgres
by the server. A reference to a label the server did not issue this turn is **counted as
a violation and stripped**, not rendered. No competitor selling "chat with PDF" can make
that claim without building it.

## 3. What we never say

| Do not say | Why |
| --- | --- |
| "Chat with your PDFs" | Commodity category. Puts us next to a hundred wrappers. |
| "ChatGPT for your documents" | Positions us as a derivative of someone else's product. |
| "AI-powered" / "Next-generation AI" | Says nothing. Every competitor says it. |
| "Unlock / Supercharge / Revolutionize" | Filler verbs with no object. |
| "Your second brain" | Personal-productivity framing; wrong buyer, wrong price point. |
| "Hallucination-free" | Unprovable and legally reckless. We claim *traceable*, not *infallible*. |
| Anything naming embeddings, vectors, chunking, RAG | Implementation detail. See [product-language.md](./product-language.md) §5. |

Note on the last row: "traceable, not infallible" is the honest and stronger claim.
Retriva does not promise the synthesis is always right. It promises you can always check
it in one click — and that the thing you check is real.

## 4. The six real differentiators

Every item below is implemented today, with the one exception flagged in §4.2. Nothing
here is aspirational. Marketing may use these; do not add a seventh without adding the
code first.

<a id="video-status"></a>
> ### ⏳ Status: video is coming soon
>
> **Video is the one capability in this document that is not yet generally available.**
> The pipeline is built end to end — Gemini Files API upload, segmentation, real
> container-duration parsing, timestamp validation, and timestamp seeking in the evidence
> panel (`src/lib/ingestion/video.ts`, `video-validate.ts`, `video-duration.ts`) — and
> every layer that does not require a real video codec is tested. What is missing is
> end-to-end verification against real footage, which this repository's development
> environment could not produce (no encoder available to generate a decodable test file).
>
> **Until that verification lands:**
> - Recording examples throughout these documents describe **intended behaviour** and are
>   written so they become live copy unchanged the day video ships.
> - Do not put a recording claim in front of a customer, a judge, or a landing-page
>   visitor as a shipped feature.
> - Lead public messaging on **documents and images**, which are proven, and present
>   video as **coming soon**.
>
> This note is the single source of truth for video's status. Every other document links
> back here rather than restating it, so there is exactly one place to change when it
> ships.

### 4.1 Server-owned citations
The model contributes an integer and nothing else. Every filename, page number,
timestamp, and quoted excerpt is looked up server-side against the user's own data.
Invented references are removed before they reach the browser.
→ `src/lib/chat/citations.ts`, `src/lib/chat/context.ts`

### 4.2 Temporal evidence — *coming soon*
A citation into a recording carries a real start and end second. Opening it seeks the
video to that moment. "Retriva knows not only what was said, but when."

**Not yet generally available** — see [Status: video](#video-status) above. This is the
differentiator with the most upside and the least proof, which is exactly why it is worth
finishing rather than quietly claiming.
→ `src/lib/ingestion/video.ts`, `src/components/chat/EvidenceDrawer.tsx`

### 4.3 One index across formats
PDFs, Word documents, plain text and Markdown, and images all land in the same searchable
space; video joins them when [it ships](#video-status). An image is indexed twice — as a
written description and OCR text, and as a native image vector — so a diagram can be
retrieved by what it depicts.
→ `src/lib/ingestion/`

### 4.4 Cross-source answers
Retrieval spans the whole knowledge base with a cap of three passages per source, which
structurally pushes answers to draw on several sources rather than over-quoting one.
→ `src/lib/retrieval/search.ts`

### 4.5 Evidence that outlives its source
Citations are stored with a snapshotted excerpt and are not cascade-deleted. Delete the
original file and last month's answer still shows what it was based on, marked as no
longer available.
→ `citations` table (`ON DELETE SET NULL`), `src/app/api/sources/[chunkId]/route.ts`

### 4.6 A real "I don't know"
When nothing retrieved supports the question, Retriva says so in fixed words instead of
improvising. When part of a multi-part question is unsupported, it answers the supported
parts and names the gap explicitly rather than refusing everything.
→ `src/lib/chat/prompt.ts` rules 4–5

## 5. Target user

### Primary persona — "the person who gets asked *why is it like this?*"

A product or engineering lead, two to five years into a system that has history. Title
varies (Staff Engineer, Product Lead, Head of Platform, Technical PM); the shape does
not.

- **What they manage.** Specifications, architecture documents that have been revised
  more than once, decision records, a diagram that is the real explanation, recorded
  design reviews and planning calls, a scratch notes file that turns out to be
  load-bearing.
- **Where it lives.** Scattered: a drive folder, a wiki, a meeting-recording tool, a
  chat thread, someone's laptop. Each store searches only itself, and only by keyword.
- **What they can't find.** Not the document — the *reason*. Which version is current,
  what changed, who objected, when it was settled. The answer is usually split across a
  document that states the decision and a recording where it was actually made.
- **What they ask.** "What changed between v1 and final, and why?" · "When did we decide
  on Postgres?" · "Where is that documented?" · "Did we ever agree to that SLA?"
- **What evidence they need.** Something they can paste into a thread. A filename and a
  page. A recording and a timestamp. Their credibility is on the line when they relay
  it, which is exactly why a confident unsourced answer is worse than useless to them.
- **Why today's tools fail.** Keyword search cannot cross formats and cannot read a
  diagram or a recording. General chatbots have no access to the material and no way to
  prove anything. Wikis only contain what someone remembered to write down.

**The wedge:** this person already loses an hour a week reconstructing decisions, and
they are the one who will be blamed for getting it wrong. They will pay for proof.

### Secondary personas

Two only. Both share the primary's need for provenance.

1. **Consultants and agencies.** Client material arrives in whatever format the client
   has. Deliverables must cite sources back to the client's own documents. They also get
   distinct value from the public share widget: a client-facing Q&A over the engagement's
   material, with the agency's branding on it.
2. **Researchers and analysts.** Papers, figures, datasets, recorded interviews.
   Citation is professional table stakes, not a nice-to-have — an uncited claim is not a
   finding.

**Explicitly not the initial target:** individual note-takers and students. They want
cheap and fast, not verifiable, and they will not pay for the provenance machinery that
is Retriva's whole cost structure.

## 6. Competitive frame

| They are | They compete on | We beat them on |
| --- | --- | --- |
| Chat-with-PDF tools | Convenience, price | Formats beyond text; provenance you can inspect; knowledge that persists between sessions |
| Enterprise search | Coverage, connectors | Synthesis — they return a ranked list of ten links, we return the answer with the links attached |
| General assistants | Raw capability | Access to your material at all, and any ability to prove a claim |
| Wikis and doc tools | Authoring | They only hold what someone wrote down; Retriva reads what was said and drawn |

**The one-line frame:** enterprise search finds the document. A chatbot writes an answer.
Retriva does both and shows its work.

## 7. Brand personality

Retriva is the colleague who says "yes — page 12" and is right.

**Is:** precise, calm, literate, technically credible, quietly confident, useful before
it is impressive.

**Is not:** playful, hyped, mystical about AI, corporate-bland, breathless, or in a
hurry to tell you it is intelligent.

**Voice rules**
- Prefer the concrete noun. "Page 12 of Architecture-final.pdf", not "the relevant source".
- State capability as fact, never as excitement. "Retriva reads recordings." Not "Retriva
  can even understand your videos!"
- Never anthropomorphize the model. It is "Retriva", not "your AI assistant"; it
  "answers" and "finds", it does not "think", "believe", or "feel confident".
- Admit limits in the same register as capabilities. The refusal message is written with
  the same care as the hero headline.
- No exclamation marks in product UI. None.

## 8. Proof-point hierarchy

When space is limited, lead in this order:

1. **Evidence.** Every answer traced to page or frame. *(The differentiator.)*
2. **Multimodal.** Documents and images in one answer. *(The capability nobody expects.)*
3. **Cross-source.** Answers that combine sources you'd otherwise open one by one.
   *(The "oh — I couldn't do that before" moment.)*
4. **Persistence.** Add once, ask forever. *(The workspace argument.)*
5. **Refusal.** It tells you when it doesn't know. *(The trust closer.)*

Once video ships ([status](#video-status)), "or moment" rejoins point 1 and recordings
rejoin point 2 — at which point point 2 likely overtakes point 3, because "it answered
from the meeting" is a stronger first impression than cross-source synthesis. Until then,
neither claim appears in customer-facing material.

Security, tenant isolation, rate limiting, and pipeline resumability are **not**
positioning. They are procurement answers. Keep them on a trust or security page, not on
the home page — a buyer who has not yet understood the product does not care that the
ingestion pipeline is checkpointed.

## 9. Naming

The product is **Retriva**. Always capitalized, never "retriva" or "RETRIVA" in prose.
There is no prior name in current use; the earlier working name "ContextOS" appears
nowhere in the repository and must not be reintroduced.

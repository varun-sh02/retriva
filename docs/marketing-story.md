# Marketing Story

The landing page: what it argues, in what order, in what words. Final copy — use it
verbatim unless this document is revised.

Positioning is fixed by [product-positioning.md](./product-positioning.md). Vocabulary is
fixed by [product-language.md](./product-language.md).

---

> ### ⏳ Video is not shipped yet — read this before using any copy below
>
> Several sections below sell recordings ("the moment in the recording", "23:41",
> `Team-meeting.mp4`). **Video is not yet generally available** — [Status: video](./product-positioning.md#video-status).
>
> This document is written in its finished form deliberately, so it needs no rewrite the
> day video ships. Until then, when copy goes live:
> - drop "and recordings" / "or moment" from the hero subhead and metadata,
> - present the multimodal section as documents and images, with recordings marked
>   **coming soon**,
> - use a PDF page or an image, never a video timestamp, in the evidence and cross-source
>   examples.
>
> The page's argument does not depend on video. Evidence — §5 — is the differentiator, and
> it is fully shipped.

## 1. The argument

The page makes one argument in five moves:

1. You already have the knowledge. It's just in six places and four formats.
2. Retriva answers questions across all of it, in one place.
3. Every answer shows its source. *(The turn — this is where we separate from the
   category.)*
4. Which means you can use the answer for something that matters.
5. Start.

Everything that doesn't advance that argument is cut.

## 2. What's wrong with the current page

| Section | Problem |
| --- | --- |
| Hero | Headline is good. The visual is an SVG wireframe of our own app — a greyed-out fake screenshot, with a heavy `drop-shadow-xl` on a flat illustration. It shows *a UI*, not *the idea*. |
| Features (6 cards) | Leads with implementation: "one pipeline", "resumable", "the last 10 turns verbatim plus a rolling summary", "row-level security". This is a changelog. Evidence — the entire differentiator — is one card of six, ranked second. |
| How it works | Fine, and correctly three steps. |
| LiveDemo | **The best asset on the page, buried at the bottom of section three.** It demonstrates question → streaming answer → inline citation → evidence panel. That is the product. |
| Video | "Prefer to just watch?" — an entire section whose heading admits the page above it was hard work. |
| Missing | No problem section. No multimodal section. No cross-source section. No use cases. No evidence section. |

## 3. Target structure

```
1  Hero                     headline · subhead · CTAs · LiveDemo as the hero visual
2  Problem                  the fragmentation strip
3  How it works             Add · Ask · Check
4  Multimodal               four kinds → one answer
5  Evidence                 ★ the differentiator, the page's centre of gravity
6  Cross-source reasoning   one worked example
7  Use cases                three
8  Final CTA
```

The two structural moves: **promote LiveDemo into the hero**, and **give evidence a
section of its own rather than a card**. The six feature cards are cut; two of them
survive as sentences inside sections 4 and 5, and the security claims move to a trust page
where a procurement reader will look for them.

---

## 4. Final copy

### Section 1 — Hero

> # Every answer, traced to the source.
>
> Retriva turns your documents, images, and recordings into a knowledge base you can ask
> questions in plain language. Every answer points back to the exact page, frame, or
> moment behind it.
>
> `[ Start with your knowledge ]`  `[ See it work ]`

**Primary CTA** → `/sign-in`. **Secondary CTA** → anchors to the evidence section (§5),
not to "how it works" — send the sceptic to the proof.

**Hero visual:** the existing `LiveDemo` component, moved up. It auto-plays on scroll into
view, respects reduced motion, and ends by opening the evidence panel on its own. Nothing
we could draw communicates the product better than watching it answer and cite. It must
carry a visible **Example** label so it is never mistaken for live output
([ux-principles.md](./ux-principles.md) §2).

### Section 2 — Problem

> ## Everything you need is already written down. Somewhere.
>
> Requirements.pdf · Architecture-v1.pdf · Architecture-final.pdf ·
> Architecture-diagram.png · Team-meeting.mp4 · Product-notes.md
>
> Each of these is findable on its own. The answer you actually need — what changed, and
> why — isn't in any one of them. It's spread across all six, in four different formats,
> and one of them is a recording nobody is going to rewatch.
>
> **Retriva reads all of it as one body of knowledge.**

**Visual:** the six filenames as separated objects — each with its kind icon, visibly
disconnected — resolving into one grouped set. This is the one place in the page where
motion carries the argument, so it earns a scroll-triggered transition. Static fallback
under reduced motion.

### Section 3 — How it works

> ## Three steps.

> **01 — Add your knowledge**
> Drop in documents, images, and recordings. Retriva reads each one and makes it
> answerable. Nothing to tag, sort, or restructure.

> **02 — Ask**
> Ask the way you'd ask a colleague who had read everything. Answers stream back in
> seconds, drawn from across every source.

> **03 — Check**
> Every claim carries a citation. Open it and you're looking at the original passage — the
> page in the PDF, the moment in the recording, the image itself.

Keep the existing three illustrations. Renumber the third from "Get a grounded answer" —
"grounded" is our word, not the reader's.

### Section 4 — Multimodal

> ## Your knowledge isn't all text. Your answers shouldn't be either.
>
> A specification, a whiteboard photo, an hour of recorded planning, and a notes file are
> four different formats and one subject. Retriva reads all four and answers from all
> four — in a single reply that draws on whichever ones actually hold the answer.
>
> Diagrams are read, not just stored: Retriva can retrieve an image by what it depicts.
> Recordings keep their timeline, so an answer can point at 23:41 rather than at the file.

**Visual:** four kind-marked sources converging into one answer block that carries four
evidence chips of different kinds. The convergence is the point — not a format checklist.

### Section 5 — Evidence ★

The most important section on the page. It is the only claim a competitor cannot copy by
writing a sentence.

> ## The model writes the answer. Retriva decides what it's allowed to cite.
>
> Every source shown to you is looked up in your own knowledge base by our server —
> filename, page, and timestamp included. The language model only ever supplies a number.
> If it refers to a source it wasn't given, that reference is removed before it reaches
> you.
>
> That's why a Retriva citation is worth clicking. It isn't the model's recollection of
> where something came from. It's a lookup in your own material.

**Supporting row — three evidence chips, real-looking, each opening the matching panel:**

```
Architecture-final.pdf · p. 12        Team-meeting.mp4 · 23:41        Architecture-diagram.png
```

**Closing line of the section:**

> And when your knowledge base doesn't have the answer, Retriva says so — instead of
> writing something plausible.

That last line is the trust closer. It is true, it is unusual to admit, and it lands
harder than any capability claim on the page.

### Section 6 — Cross-source reasoning

> ## The questions you can't answer with search
>
> ### "What changed between the original and final architecture, and why?"
>
> There is no document that answers this. The *what* is the difference between two PDFs
> and a diagram. The *why* was said out loud in a planning call and written down once, in
> a notes file, by someone in a hurry.
>
> Retriva answers it in one reply, and shows you all five places it drew from.

**Visual:** the answer with its evidence rail carrying five chips of four different kinds
(five is the real ceiling — `RAG_CONFIG.finalContextChunks` — so this is the product at
full stretch, not an exaggeration). The rail is the hero of this section: the argument is
made by showing one answer standing on five differently-shaped sources.

### Section 7 — Use cases

Three. Each names a real person and a real question, not a market category.

> **Project memory**
> The specs, the decisions, the diagram, and the call where it was settled — in one place
> that answers "why is it like this?" without three people reconstructing it from memory.

> **Client work**
> Everything a client sent you, in whatever format they sent it, answerable — and citable
> back to their own documents when you deliver.

> **Research**
> Papers, figures, and recorded interviews in one body of material. Every finding traces
> to the page or the minute it came from.

### Section 8 — Final CTA

> ## Add one document. Ask one question.
>
> That's the whole evaluation. You'll know within five minutes whether Retriva knows your
> material better than your search bar does.
>
> `[ Start with your knowledge ]`

Replaces the current "Turn your documents into answers" / "in under five minutes" block.
The improvement is that it names the test rather than making a promise about the clock.

---

## 5. Metadata and social

```
Title:       Retriva — Every answer, traced to the source
Description: Ask questions across your documents, images, and recordings. Every answer
             points back to the exact page, frame, or moment it came from.
```

The current description ("Upload PDFs, docs, images, and video. Retriva turns them into a
chat assistant…") calls the product a chat assistant, which is precisely the commodity
framing [product-positioning.md](./product-positioning.md) §3 rules out.

## 6. Voice checklist for any new marketing copy

- [ ] Would a competitor's page say this sentence? If yes, cut it.
- [ ] Does every capability claim map to shipped code? (The six in
      [product-positioning.md](./product-positioning.md) §4 are the permitted set.)
- [ ] Is there a concrete noun where there could be an abstraction? "Page 12", not "the
      relevant source".
- [ ] Any banned word? ([product-language.md](./product-language.md) §3)
- [ ] Any exclamation mark? Remove it.
- [ ] Is the model anthropomorphized? It answers and finds; it does not think or believe.
- [ ] Does a mock look like live output? Label it **Example**.

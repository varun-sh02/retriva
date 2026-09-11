# Demo Story

The canonical Retriva demonstration: seven minutes, one dataset, four questions, one
argument.

The argument is: **other tools find documents; Retriva answers the question and shows its
work — across formats, including the recording nobody was going to rewatch.**

> ### ⏳ This script assumes video, which is not shipped yet
>
> Beats 2 and 3 turn on a video citation seeking to 23:41. **Video is not yet generally
> available** — [Status: video](./product-positioning.md#video-status) — so this script is the *target* demo, not one you can
> run today without verifying video first.
>
> **Before running it as written:** upload one real `.mp4`, confirm the source reaches
> Ready, ask a question it answers, and confirm the evidence panel opens seeked to the
> cited second. If any of that fails, run the **documents-and-images fallback** in §1a
> instead — it makes the same argument with proven capabilities and loses one beat.
>
> Never demo video to a judge or a customer on the assumption that it works. A failed peak
> beat costs more than a demo that never claimed it.

---

## 1. Dataset

Six sources, four formats, one subject. They must genuinely contain the answers — no
prompt-fitting, no seeded sentences that only exist to be retrieved. The demo is only
impressive if it is real.

| Source | Format | Role in the story |
| --- | --- | --- |
| `Requirements.pdf` | PDF | The original constraints. Establishes the subject. |
| `Architecture-v1.pdf` | PDF | The original design. One half of the comparison. |
| `Architecture-final.pdf` | PDF | The revised design. The other half. |
| `Architecture-diagram.png` | Image | The current design, drawn. Proves images are *read*, not stored. |
| `Team-meeting.mp4` | Video | Where the decision was actually argued and settled. The star. |
| `Product-notes.md` | Markdown | Where it was written down once, badly, by someone in a hurry. |

**Construction rules**

- The *why* behind the architecture change must exist **only** in the recording and the
  notes file — never in either PDF. This is what makes Q1 impossible for a document search
  and unanswerable by reading one file.
- The recording must contain a clearly spoken decision at a known timestamp, with at least
  ten minutes of ordinary discussion around it. A three-minute clip proves nothing about
  finding a moment.
- The diagram must show one component that is named nowhere in the text — that is the
  proof for Q4.
- Keep total size modest so ingestion finishes inside the demo. Video dominates
  processing time; ten to fifteen minutes of footage is the sweet spot.

**Have a second copy of the knowledge base pre-ingested.** Ingest live only if the demo
has time to spare, and always have the ready one to switch to.

---

## 1a. Fallback: the documents-and-images demo

Run this whenever video is unverified, and until video ships it is the **default**.

Drop `Team-meeting.mp4` from the dataset and put the *why* behind the architecture change
in `Product-notes.md` alone, with the decision itself recorded in `Architecture-final.pdf`.
Q1 still has no single document that answers it, which is the entire point.

| Beat | Change |
| --- | --- |
| 0 Problem | Five files, three formats. Same setup, one fewer object. |
| 1 Ingestion | Faster — no transcription. Narrate "Reading pages" and "Looking at image". |
| 2 Q1 cross-source | Unchanged in structure. The peak becomes the **image** citation: "Nothing in any document names that component. Retriva read the picture." |
| 3 Q2 temporal | **Cut.** There is no timestamp to point at. |
| 4 Q3 image | Promote to the position Beat 3 held — it is now the surprise. |
| 5 Q4 refusal | Unchanged. Still never cut. |
| 6 The claim | Unchanged. Still never cut. |
| 7 Close | Unchanged. |

Runs about 4:30. The irreducible three (cross-source, refusal, provenance claim) all
survive, so the argument is intact — it simply lands on "it read the diagram" rather than
"it found the moment".

If asked about video directly: *"Recordings are built and coming soon — the pipeline keeps
real timestamps so a citation points at a moment, not a file. We're not demoing it until
it's verified end to end."* That is accurate and reads as discipline, not as a gap.

---

## 2. Run of show

### Beat 0 — The problem (30s, no screen)

> "Six files. Two PDFs that contradict each other, a diagram, an hour of recorded
> planning, and a notes file. Everything you need is in there. Good luck finding it."

Show the six filenames. Do not open the product yet.

### Beat 1 — Ingestion (60s)

Drag all six in at once.

Narrate what the states actually say — they are modality-aware and that is the point:

> "Reading pages on the PDFs. Looking at the image. Listening to the recording — it's
> transcribing an hour of audio and keeping the timeline."

Let it finish, or cut to the pre-ingested base. Land on: **6 sources · ready**.

### Beat 2 — Question 1: the cross-source answer (90s)

> **"What changed between the original and final architecture, and why?"**

What to point at, in order:

1. **The phases.** "Searching your knowledge" → "Reading the evidence". Real states.
2. **The streaming answer.** Let it run without talking over it.
3. **The evidence rail** under the answer — four or five chips across three or four
   different formats. (An answer draws on at most five passages —
   `RAG_CONFIG.finalContextChunks` — so four to five chips is the realistic ceiling, not
   a shortfall.)

Then say the line the whole demo exists for:

> "The *what* came from two PDFs. The *why* came from a recording and a notes file. There
> is no single document that answers this question."

Click `Team-meeting.mp4 · 23:41`. The panel opens with the video **already seeked to
23:41**. Press play. Let them hear the decision being made.

> "It didn't find the file. It found the moment."

This is the peak of the demo. Everything after it is reinforcement.

### Beat 3 — Question 2: temporal precision (45s)

> **"When was the database decision made?"**

The answer gives the decision and the timestamp. Open the recording citation; it seeks to
the exact second. Open the second citation — the notes file — to show the same decision
written down.

> "One answer, two kinds of proof: the moment it was said, and the line where it was
> recorded."

### Beat 4 — Question 3: the image (30s)

> **"What does the architecture diagram show?"**

The answer describes a component named in no text file. Open the image citation.

> "Nothing in any document mentions that component. Retriva read the picture."

Short beat. It only needs to land once.

### Beat 5 — Question 4: the refusal (30s) ★

Ask something plausibly adjacent that is genuinely absent. Not nonsense — something a real
person would ask and the corpus simply doesn't cover:

> **"What's the incident response SLA for this system?"**

> *"I couldn't find enough evidence in this knowledge base to answer that confidently."*

> "That's the feature. Ask any general assistant this and you'll get a confident paragraph
> about industry-standard SLAs. Retriva only answers from what you gave it."

Counter-intuitive, deliberate, and it converts sceptics. **Do not cut this beat for time.**
If something must go, cut Beat 4.

### Beat 6 — The claim (30s)

Scroll back to any answer. Point at a citation.

> "One thing worth knowing about how this works. The model never tells us where something
> came from. It emits a number. The filename, the page, the timestamp — our server looks
> all of that up in your own data. If the model cites a source it wasn't given, we strip
> it before it reaches the screen.
>
> That's why clicking one of these is worth doing. It isn't the model's recollection. It's
> a lookup in your material."

### Beat 7 — Close (30s)

Two options, read the room:

- **Persistence:** open the chat history. "Same knowledge base, a week later. You add
  once."
- **Distribution:** the Share tab → the widget on a page. "Same knowledge base, answering
  your customers, with the sources named."

---

## 3. Timing

| Beat | Target | Cut first |
| --- | --- | --- |
| 0 Problem | 0:30 | |
| 1 Ingestion | 1:00 | → 0:20 with pre-ingested base |
| 2 Q1 cross-source | 1:30 | **never** |
| 3 Q2 temporal | 0:45 | |
| 4 Q3 image | 0:30 | cut first |
| 5 Q4 refusal | 0:30 | **never** |
| 6 The claim | 0:30 | **never** |
| 7 Close | 0:30 | |
| | **~5:45** | 3:30 minimum viable |

**The irreducible demo is Beats 2, 5, and 6:** a cross-source answer with a video
timestamp, a refusal, and the provenance claim. Under any time pressure, that is the demo.

---

## 4. What can go wrong

| Risk | Mitigation |
| --- | --- |
| **Video is unverified** | The known one, not a hypothetical — [Status: video](./product-positioning.md#video-status). Verify end to end beforehand or run the §1a fallback. |
| Video ingestion outlasts the demo | Pre-ingested knowledge base on a second tab, always. Never ingest video live without it. |
| A question retrieves the wrong passages | Rehearse the exact four questions against the exact dataset. Query rewriting is skipped on the first turn, so **the first question of the session is the most variable** — ask a throwaway question before the audience is watching, or accept that Q1 benefits from a warm thread. |
| The model omits an inline citation | The evidence rail under the answer renders from stored citations regardless of inline markers, so the proof is visible even if the prose forgets. (Depends on the source rail being implemented — see [ux-principles.md](./ux-principles.md) §III.2.) |
| Network failure mid-stream | The stream retries automatically before any text reaches the screen. If it fails after, re-ask — do not narrate the error. |
| "Isn't this just ChatGPT with my files?" | Beat 6 verbatim, then click a citation. The answer is not a claim, it's a demonstration. |
| "How do I know it isn't making up the page number?" | Open the PDF citation — it lands on the page. Then Beat 6. |
| Someone asks about accuracy | "Retriva doesn't promise it's always right. It promises you can always check, in one click, and that what you're checking is real." |

---

## 5. Pre-flight

- [ ] Both knowledge bases ready; pre-ingested one open in a second tab
- [ ] All four questions rehearsed end to end against this exact dataset
- [ ] **Decided: full script or §1a fallback** — and if full, `Team-meeting.mp4` verified
      end to end today, not "last time it worked"
- [ ] The refusal question confirmed to actually refuse
- [ ] Browser zoom at a level where citation badges are legible on a projector
- [ ] Chat history cleared, or a throwaway first question already asked
- [ ] Light/dark chosen for the room, not for preference

# Design System

The visual language of Retriva. Documents the tokens that already exist in
`src/app/globals.css` (the "6a Saffron" brand system), fixes their semantic meaning, and
specifies the components the product is missing.

**This document does not introduce a new palette.** The brand system is already defined,
already contrast-checked, and shipped with brand assets in `public/brand/`. Its rules are
recorded here so they stop being re-derived, and extended only where the product has
components the brand package doesn't cover.

---

## 1. Direction

**Minimalist, Swiss, information-dense.** Borders and typography carry the structure;
shadows and fills are used sparingly and meaningfully. Reference qualities — not to
copy — are Linear's density discipline, Raycast's restraint with accent color, and the
typographic seriousness of a good research tool.

Two independent design-intelligence queries (one on "AI knowledge workspace / research /
evidence", one on "developer tool / SaaS workspace / minimal") both resolved to
**Minimalism & Swiss Style**, which is consistent with the existing brand. Their palette
and typeface suggestions were discarded: they conflict with a shipped, deliberate brand
system. Only the style classification and its accessibility requirements
(4.5:1 text contrast, keyboard, visible focus, reduced motion) are carried through.

**Explicitly rejected:** purple AI gradients, glow, glassmorphism, oversized rounded
cards, sparkle iconography, 3D, stock illustration, dashboard-template chrome.

## 2. Color

Tokens live in `src/app/globals.css` as OKLCH. Do not hardcode hex in components; use the
semantic Tailwind classes (`bg-card`, `text-muted-foreground`, `border-border`).

### Neutrals

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Page ground | Paper `#FAF9F6` | Carbon `#111214` | `--background` |
| Surface | White | Carbon surface `#1B1E21` | `--card`, `--popover` |
| Text | Ink `#131312` | Paper | `--foreground` |
| Secondary text | Muted `#6B6862` | `#9BA0A5` | `--muted-foreground` |
| Hairline | — | 10% white | `--border` |
| Neutral action | Ink | Paper (inverted) | `--primary` |

Paper is deliberately warm, not white. Carbon is deliberately near-black, not blue-black.
Neither is a bug.

### The accent — Saffron

**One accent, two meanings: primary action, and evidence.** Nothing else gets Saffron.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--brand` | `#E08A1E` | `#F2A63C` | Accent **fills** only |
| `--brand-foreground` | Ink | Ink | Text/icon *on* a Saffron fill |
| `--brand-text` | `#9E5E0B` | `#F2A63C` | Saffron **as** text or icon |
| `--tint` | `#FBEDD6` | warm brown | Cited-passage highlight ground |
| `--ring` | `#9E5E0B` | `#F2A63C` | Focus ring |

**The rule that matters:** plain Saffron fails 4.5:1 on Paper. Saffron as *text or an
icon* in light mode must use `--brand-text`, never `--brand`. `--brand-text` exists for
exactly this reason. In dark mode the lifted Saffron clears the ratio and both tokens
converge.

### Semantic assignments

| Meaning | Treatment |
| --- | --- |
| Primary action | `--primary` (Ink / inverted Paper). Neutral, not Saffron — Saffron is reserved for the *one* accent moment per view. |
| Evidence: citation badge | `--brand`/15 ground, `--brand-text` numeral |
| Evidence: cited excerpt | `--tint` ground, `--brand` left rule |
| Evidence: source chip | `--tint` ground, `--brand-text` coordinate |
| Source ready | `--muted-foreground` text, no fill. Ready is the normal case and should be quiet. |
| Source processing | `--muted-foreground` + a pulsing dot |
| Source failed | `--destructive` |
| Refusal ("I don't know") | Neutral surface with a `--border` rule. **Never destructive.** It is a correct outcome. |

**Source kinds are never color-coded.** A PDF, an image, and a recording differ by icon
only. Color in this product means *provenance or action*; spending it on file types would
destroy that signal.

## 3. Typography

**Brand type is Helvetica Neue** — a system font, not a webfont, set as `--font-sans`. The
brand package specifies it; do not substitute a webfont without a brand decision. (Risk:
on Windows and Linux it falls back to Arial, so the product is measurably less refined
off macOS. Recorded in §10.)

**IBM Plex Mono** is loaded via `next/font` as `--font-mono` and is the type for
**coordinates**: page numbers, timestamps, counts, identifiers, keyboard hints. Prose is
never mono; a coordinate is never proportional. This distinction is one of the cheapest
sources of perceived precision in the product — use it consistently.

### Scale

| Role | Size / line-height | Weight |
| --- | --- | --- |
| Marketing H1 | 36–48px / 1.1, `tracking-[-0.045em]` | 700 |
| Marketing H2 | 30px / 1.2 | 700 |
| Page title | 18px / 1.4 | 600 |
| Section heading | 14px / 1.4 | 500 |
| Body / answer | 15px / 1.65 | 400 |
| UI default | 14px / 1.45 | 400 |
| Secondary | 13px / 1.45 | 400 |
| Coordinate (mono) | 12px | 500 |
| Micro | 11px | 500 |

Two deliberate deviations from the current build:

1. **The answer gets its own size.** 15px/1.65 rather than the 14px UI default. Answers
   are read, not scanned, and this is the one place in the app where reading comfort
   outranks density.
2. **Tabular numerals** (`font-variant-numeric: tabular-nums`) on all counts, sizes,
   percentages, and timestamps, so numbers stop jittering as they update during upload and
   processing.

## 4. Space, radius, elevation

**4px base grid.** Spacing steps: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Inside a row use
8–12; between groups use 24–32; section padding 48–64 on marketing, 24 in-app.

**Radius** from `--radius: 0.625rem`, scaled by the existing `--radius-*` ramp. Controls
use `lg`; panels and cards use `xl`; the chat composer and message bubbles use `2xl`;
pills use the `4xl` step.

**Elevation is borders, not shadows.** The product has almost none today and that is
correct Swiss practice — keep it. Shadows are permitted only on genuinely floating layers
(popover, dropdown, sheet, toast). The `drop-shadow-xl` currently applied to the flat
hero SVG is the one violation and should be removed.

## 5. Component specifications

Existing primitives (`src/components/ui/`, Base UI + shadcn) are sound and are not
respecified here. These are the product-specific components — the ones that make Retriva
look like Retriva.

### 5.1 Citation badge · `components/chat/Citation.tsx`

Inline, immediately after the claim it supports.

- Visual: 16px circle, `bg-brand/15`, `text-brand-text`, mono numeral, `align-text-top`.
- **Hit area ≥ 44×44** via padding or a `::after` overlay — the visual stays 16px. Not
  optional; it is a tap target inside flowing text.
- States: hover `bg-brand/25`; `focus-visible` ring; `aria-expanded` when its evidence is
  the one currently open in the panel.
- Enters with a 150ms fade as its claim finishes streaming. No motion under
  `prefers-reduced-motion`.
- Accessible name: "Evidence 1: Architecture-final.pdf, page 12" — not the bare number.

### 5.2 Source chip — **new**

The unit of the evidence rail, and the same component used in marketing evidence rows.

```
┌──────────────────────────────────────┐
│ [icon] Architecture-final.pdf  p. 12 │
└──────────────────────────────────────┘
   kind    name (truncates)   coordinate
```

- Ground `--tint`, hairline `--brand`/30, radius `lg`, height 28px.
- Name truncates from the middle (`Architecture-…-final.pdf`) — the extension and the tail
  carry the identity.
- Coordinate in mono, `--brand-text`. Absent for text sources.
- Kind icons: `FileText` (document) · `Image` (image) · `Video` (recording). One icon per
  kind, never a color. The recording icon is implemented and will start appearing when
  video ships — [Status: video](./product-positioning.md#video-status).
- Non-interactive variant for the public widget (see
  [ux-principles.md](./ux-principles.md) §V.1).

### 5.3 Evidence rail — **new**

A wrapping row of source chips directly under an answer, separated from the prose by
12px. Renders whenever `message.citations` is non-empty — including on history, where
citations are already loaded by `listMessages`. Wraps rather than scrolls; five chips
across two lines is legible, a horizontal scroller hides evidence.

### 5.4 Evidence panel · `components/chat/EvidenceDrawer.tsx`

Right-anchored sheet, `sm:max-w-lg`. Already built and structurally correct. Required
additions:

- Header: kind icon + source name + coordinate, with **"Evidence 2 of 5"** and
  previous/next controls, so a user can walk the whole set without closing.
- The excerpt keeps the `--tint` ground and `--brand` left rule — this is the visual
  anchor tying the panel back to the badge that opened it.
- Per kind: image inline (`max-h-80`, contained) · video seeked to the cited second with a
  "Play from 23:41" control (built; live when video ships) · PDF with "Open at page 12" ·
  **text sources get a `text`
  kind** showing the excerpt and its section path with no asset link (see
  [ux-principles.md](./ux-principles.md) §V.3).
- Unavailable source: the snapshotted excerpt plus a plain explanation. This state is a
  feature, not an error — neutral styling, no destructive color.
- Focus returns to the badge that opened the panel on close.

### 5.5 Source row · `components/knowledge/DocumentRow.tsx`

One row per source. One status, in one place.

```
[icon]  Architecture-final.pdf                    Ready · 34 passages      ⋯
[icon]  Team-meeting.mp4         ● Listening to recording…                 ⋯
[icon]  Broken.pdf               Couldn't process · Try again · Details    ⋯
```

- Kind icon, not a generic file glyph.
- Status is sentence-case text, not a shouting badge. In-progress carries a pulsing
  `--muted-foreground` dot; failed uses `--destructive` text.
- Secondary line: size and, when ready, passage count.
- Row actions are `opacity-0 group-hover:opacity-100 **focus-visible:opacity-100**` — the
  focus variant is mandatory.
- Status cell is a polite live region so transitions are announced.

### 5.6 Upload zone · `components/knowledge/UploadDropzone.tsx`

- Dashed `--border`; on drag-over, `--brand` border and `--tint` ground — the accent
  confirms the drop target.
- Copy states accepted kinds in product language: "Documents and images" today,
  "Documents, images, and recordings" once video ships — [Status: video](./product-positioning.md#video-status).
- Real percentage during upload only; indeterminate with an honest label after.
- Needs an accessible name and `aria-describedby` for accepted formats; Space must
  `preventDefault()`.

### 5.7 Suggested question · **new**

Left-aligned, full-width, `--border` hairline, radius `lg`, 14px, hover `--accent`. Three
to four in a vertical stack. Deliberately quiet: they are an offer, not a call to action,
and they must not out-shout the composer.

### 5.8 Empty state · `components/shell/EmptyState.tsx`

Current component is fine. Its *usage* is the problem — see
[product-language.md](./product-language.md) §8. Three parts always: title (what this is),
description (why it matters), action (what to do).

### 5.9 Refusal message — **new**

A distinct assistant-message variant: neutral surface, `--border` rule, a quiet "no
matching evidence" icon. **Never `--destructive`, never muted-grey apology text.** It
reads as a considered answer, because it is one.

## 6. Motion

| Moment | Motion | Duration / easing |
| --- | --- | --- |
| Answer streaming | RAF-paced character release (already built — keep as is) | backlog-proportional |
| Message enters | fade + 4px rise | 300ms `ease-out` |
| Citation appears | fade | 150ms |
| Evidence panel | slide from right | 250ms `ease-out` |
| Source becomes ready | status crossfade + settle | 200ms |
| Stage change | crossfade | 150ms |
| Hover / focus | color only | 150ms |

Nothing else animates. All of the above collapse to instant final state under
`prefers-reduced-motion`, including the `scrollIntoView` in `MessageList` (currently
unguarded).

## 7. Responsive

Breakpoints: 375 · 768 · 1024 · 1440.

- **< 768**: both sidebars become sheets (already implemented). The evidence panel becomes
  a bottom sheet at ~85vh rather than a side sheet. The evidence rail scrolls
  horizontally only below 640px, where wrapping would dominate the answer.
- **768–1024**: hide the knowledge-base rail on the Ask route
  ([ux-principles.md](./ux-principles.md) Part II).
- **≥ 1280**: the answer column caps at ~72ch. It must not stretch to the viewport —
  long-line answers are the fastest way to make a reading interface feel unconsidered.

## 8. Iconography

Lucide only, 16px in UI and 20px in headers, 1.5px stroke. Never emoji. One icon per
concept across the whole product:

`FileText` document · `Image` image · `Video` recording · `Quote` evidence ·
`Plus` add · `Search` retrieval state · `AlertCircle` failure · `Share2` share.

## 9. Accessibility floor

Non-negotiable, every screen:

- 4.5:1 body text, 3:1 UI and focus indicators
- Visible `focus-visible` on every interactive element, including those revealed on hover
- 44×44 minimum hit area — citation badges especially
- Semantic HTML; ARIA only where semantics genuinely fall short
- Live regions scoped to the thing that changed, never to a whole list
- `prefers-reduced-motion` honoured everywhere
- No information conveyed by color alone — every color-coded state carries text or an icon

## 10. Open questions

1. **Helvetica Neue off macOS.** It is a system font, so Windows and Linux fall back to
   Arial and the product looks materially different for most non-Mac users. Either accept
   it as a brand decision, or make the case to the brand owner for a licensed webfont with
   the same Swiss character. **Not a change to make unilaterally.**
2. **Dark mode as default.** Dark is fully specified and is the register this product's
   audience prefers in a work tool. Currently light-first. Worth a decision, not a
   silent flip.
3. **Answer measure.** 72ch is proposed; confirm against real answers with evidence rails,
   which may read better slightly narrower.

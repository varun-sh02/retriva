import { SourceChip } from "@/components/chat/SourceChip";
import { LogoMark } from "@/components/brand/Logo";

const EVIDENCE = [
  { documentName: "Architecture-v1.pdf", contentType: "pdf", pageNumber: 4, startTimestamp: null },
  {
    documentName: "Architecture-final.pdf",
    contentType: "pdf",
    pageNumber: 12,
    startTimestamp: null,
  },
  {
    documentName: "Architecture-diagram.png",
    contentType: "image",
    pageNumber: null,
    startTimestamp: null,
  },
  { documentName: "Team-meeting.mp4", contentType: "video", pageNumber: null, startTimestamp: 1421 },
  { documentName: "Product-notes.md", contentType: "markdown", pageNumber: null, startTimestamp: null },
];

/**
 * The cross-source argument, made by showing rather than claiming: one answer
 * standing on five differently-shaped sources. Five is the real ceiling
 * (RAG_CONFIG.finalContextChunks), so this is the product at full stretch and
 * not an exaggeration.
 *
 * Static by design — it is illustrative, and the "Example" label is required
 * so a mock is never mistaken for live output (docs/ux-principles.md §2).
 */
export function CrossSourceAnswer() {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card">
      <figcaption className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-medium">Platform knowledge</span>
        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
          Example
        </span>
      </figcaption>

      <div className="flex flex-col gap-4 p-4">
        <p className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
          What changed between the original and final architecture, and why?
        </p>

        <div className="flex items-start gap-2.5">
          <LogoMark size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] leading-[1.65]">
              The final design replaced the message queue with direct synchronous writes
              <Marker n={1} />
              <Marker n={2} />, and moved the read path behind a cache
              <Marker n={3} />. The change was made after the team measured queue lag at peak and
              decided the added operational surface wasn&apos;t paying for itself
              <Marker n={4} />
              <Marker n={5} />.
            </p>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {EVIDENCE.map((source) => (
                <li key={source.documentName} className="min-w-0">
                  <SourceChip source={source} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </figure>
  );
}

function Marker({ n }: { n: number }) {
  return (
    <span className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand/15 px-1 align-text-top font-mono text-[0.65rem] leading-none font-medium text-brand-text tabular-nums">
      {n}
    </span>
  );
}

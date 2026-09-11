"use client";

import { Children, cloneElement, isValidElement, type ReactNode, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { ChatCitation } from "@/hooks/useChatStream";
import { CitationBadge } from "./Citation";

/**
 * One citation, tolerant of the punctuation drift the model produces
 * ("[SOURCE_1]", "(SOURCE 1)", "source_1") — deliberately the same shape as
 * the server's pattern in src/lib/chat/citations.ts, because what streams to
 * the browser is RAW model output. The server's cleaned text is only what
 * gets persisted, so the client has to be equally tolerant on the live turn
 * and equally strict about which labels it will honour.
 */
const CITATION = String.raw`[[(]?\s*SOURCE[_\s]?\d+\s*(?:[\])])?`;

/**
 * A citation plus any run of further citations joined to it by commas. The
 * comma is only consumed when another citation follows, which is what keeps
 * ordinary prose intact: in "…experience [SOURCE_1], with strong proficiency"
 * the comma belongs to the sentence and must survive, while
 * "…Visa [SOURCE_1], [SOURCE_2]." collapses to two adjacent badges.
 *
 * The leading whitespace is absorbed so a badge sits tight against the word
 * it follows, the way a real footnote marker does.
 */
const CITATION_RUN = new RegExp(String.raw`\s*(${CITATION}(?:\s*,\s*${CITATION})*)`, "gi");

const SOURCE_NUMBER = /SOURCE[_\s]?(\d+)/gi;

/**
 * A half-arrived citation at the very end of the streamed text. Without this
 * the reader watches "[", "[S", "[SOU" appear and then vanish on every single
 * citation. Requires either an opening bracket or the complete word SOURCE,
 * so a sentence that genuinely ends in "S" is never eaten.
 */
const TRAILING_PARTIAL =
  /(?:[[(][\s(]*S(?:O(?:U(?:R(?:C(?:E(?:[_\s]?\d*)?)?)?)?)?)?|\bSOURCE(?:[_\s]?\d*)?)$/i;

/** Code is quoted material — a literal "[SOURCE_1]" inside it is not a citation. */
const OPAQUE_TAGS = new Set(["code", "pre"]);

type RenderBadge = (sourceId: string, key: string) => ReactNode;

function splitTextWithCitations(text: string, renderBadge: RenderBadge, keyPrefix: string): ReactNode {
  CITATION_RUN.lastIndex = 0;
  const matches = [...text.matchAll(CITATION_RUN)];
  if (matches.length === 0) return text;

  const out: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, runIndex) => {
    const start = match.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));

    const run = match[1] ?? "";
    SOURCE_NUMBER.lastIndex = 0;
    for (const [badgeIndex, id] of [...run.matchAll(SOURCE_NUMBER)].entries()) {
      out.push(renderBadge(`SOURCE_${id[1]}`, `${keyPrefix}-${runIndex}-${badgeIndex}`));
    }

    cursor = start + match[0].length;
  });

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/**
 * Walks the rendered markdown children and replaces citation tokens in place.
 *
 * This is the whole reason inline citations work now. The previous approach
 * split the *source text* on citation tokens and rendered each fragment in
 * its own <ReactMarkdown>; since ReactMarkdown emits block-level <p>, every
 * citation broke the line and stranded the badges and their punctuation on
 * separate rows — so citations were removed from the UI entirely. Injecting
 * into the children of an already-parsed block keeps everything inside the
 * one <p> it belongs to, which is what a footnote marker requires.
 */
function injectCitations(children: ReactNode, renderBadge: RenderBadge, keyPrefix: string): ReactNode {
  if (typeof children === "string") {
    return splitTextWithCitations(children, renderBadge, keyPrefix);
  }

  if (Array.isArray(children)) {
    return Children.map(children, (child, index) =>
      injectCitations(child, renderBadge, `${keyPrefix}-${index}`),
    );
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    if (typeof children.type === "string" && OPAQUE_TAGS.has(children.type)) return children;
    const inner = children.props.children;
    if (inner === undefined) return children;
    return cloneElement(children, {
      children: injectCitations(inner, renderBadge, `${keyPrefix}-c`),
    });
  }

  return children;
}

export function AssistantMessage({
  content,
  citations,
  retrievedSourceIds,
  streaming = false,
  activeChunkId,
  onOpenCitation,
}: {
  content: string;
  citations: ChatCitation[];
  /**
   * Labels the server issued this turn, known from the `sources` event before
   * generation starts. During streaming the full citation (and therefore the
   * chunk to open) isn't known yet, but the label is — so the badge can be
   * drawn in its final position and simply become clickable when the citations
   * land, instead of the text reflowing at the end of every answer.
   */
  retrievedSourceIds?: Set<string>;
  streaming?: boolean;
  activeChunkId?: string | null;
  onOpenCitation?: (citation: ChatCitation) => void;
}) {
  const bySourceId = useMemo(
    () => new Map(citations.map((citation) => [citation.sourceId, citation])),
    [citations],
  );

  const components = useMemo<Components>(() => {
    const renderBadge: RenderBadge = (sourceId, key) => {
      const citation = bySourceId.get(sourceId);
      // A label the server never issued is dropped, exactly as the server
      // drops it from the persisted text (docs/security.md T6). The model
      // does not get to invent a source.
      if (!citation && !retrievedSourceIds?.has(sourceId)) return null;
      return (
        <CitationBadge
          key={key}
          sourceId={sourceId}
          citation={citation}
          active={!!citation && citation.chunkId === activeChunkId}
          onOpen={onOpenCitation}
        />
      );
    };

    const inject = (children: ReactNode, key: string) => injectCitations(children, renderBadge, key);

    return {
      p: ({ children }) => <p>{inject(children, "p")}</p>,
      li: ({ children }) => <li>{inject(children, "li")}</li>,
      h1: ({ children }) => <h1>{inject(children, "h1")}</h1>,
      h2: ({ children }) => <h2>{inject(children, "h2")}</h2>,
      h3: ({ children }) => <h3>{inject(children, "h3")}</h3>,
      h4: ({ children }) => <h4>{inject(children, "h4")}</h4>,
      h5: ({ children }) => <h5>{inject(children, "h5")}</h5>,
      h6: ({ children }) => <h6>{inject(children, "h6")}</h6>,
    };
  }, [bySourceId, retrievedSourceIds, activeChunkId, onOpenCitation]);

  const text = streaming ? content.replace(TRAILING_PARTIAL, "") : content;

  // The `prose` plugin is not installed, so these styles are not decoration —
  // without them Tailwind's preflight leaves markdown lists with no markers
  // and headings at body size. The answer also gets its own type size
  // (15px/1.65 rather than the 14px UI default) because it is read, not
  // scanned (docs/design-system.md §3).
  return (
    <div
      className="max-w-[72ch] text-[0.9375rem] leading-[1.65] [&_a]:text-brand-text [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}

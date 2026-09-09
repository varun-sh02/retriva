"use client";

import ReactMarkdown from "react-markdown";
import type { ChatCitation } from "@/hooks/useChatStream";
import { CitationBadge } from "./Citation";

// Rendering-only — tolerant of the same punctuation drift the server's
// citations.ts strips, but with no security role: a token that doesn't
// resolve to a real citation just falls back to plain bracketed text (see
// CitationBadge), it never fabricates provenance.
const CITATION_TOKEN = /[[(]?\s*SOURCE[_\s]?(\d+)\s*[\])]?/gi;

function splitOnCitations(text: string): { text: string; sourceId?: string }[] {
  const parts: { text: string; sourceId?: string }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: text.slice(lastIndex, index) });
    parts.push({ text: match[0], sourceId: `SOURCE_${match[1]}` });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });

  return parts;
}

export function AssistantMessage({
  content,
  citations,
  onOpenCitation,
}: {
  content: string;
  citations: ChatCitation[];
  onOpenCitation: (citation: ChatCitation) => void;
}) {
  const citationBySourceId = new Map(citations.map((c) => [c.sourceId, c]));
  const parts = splitOnCitations(content);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1">
      {parts.map((part, index) =>
        part.sourceId ? (
          <CitationBadge
            key={index}
            sourceId={part.sourceId}
            citation={citationBySourceId.get(part.sourceId)}
            onOpen={onOpenCitation}
          />
        ) : (
          <ReactMarkdown key={index}>{part.text}</ReactMarkdown>
        ),
      )}
    </div>
  );
}

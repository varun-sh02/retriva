"use client";

import ReactMarkdown from "react-markdown";

/**
 * Matches a citation and any run of further citations joined to it by commas
 * ("[SOURCE_1], [SOURCE_2], [SOURCE_3]"), plus the whitespace in front.
 *
 * The trailing comma is only consumed when another citation follows, which is
 * what keeps ordinary prose intact: in "…experience [SOURCE_1], with strong
 * proficiency…" the comma belongs to the sentence, not to the citation run,
 * and must survive. Sentence-ending punctuation is never consumed, so
 * "…Visa [SOURCE_1], [SOURCE_2]." tidies to "…Visa."
 */
const CITATION = String.raw`[[(]?\s*SOURCE[_\s]?\d+(?:\s*[\])])?`;
const CITATION_RUN = new RegExp(String.raw`\s*${CITATION}(?:\s*,\s*${CITATION})*`, "gi");

export function stripCitations(text: string): string {
  return text.replace(CITATION_RUN, (match, ...rest) => {
    // The run also swallowed the whitespace in front of it. Put a single
    // space back when it was the only thing separating two words, so an
    // unbracketed "years SOURCE_2 and" cannot collapse into "yearsand".
    const offset = rest[rest.length - 2] as number;
    const full = rest[rest.length - 1] as string;
    const before = full[offset - 1];
    const after = full[offset + match.length];
    // Only between two words — never before punctuation, which would strand
    // a space in front of the sentence's own comma or full stop.
    const joinedWords =
      /^\s/.test(match) && !!before && !!after && /\S/.test(before) && /[^\s.,;:!?)\]}]/.test(after);
    return joinedWords ? " " : "";
  });
}

/**
 * Renders the answer as a single markdown document.
 *
 * It used to split the text on citation tokens and render each fragment in its
 * own <ReactMarkdown>, interleaving numbered badges. Because ReactMarkdown
 * emits block-level <p> elements, every citation broke the line — leaving the
 * badges, and the stray commas and periods around them, stranded on separate
 * rows. Citations are still extracted and stored server-side; they are simply
 * not drawn inline.
 */
export function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1">
      <ReactMarkdown>{stripCitations(content)}</ReactMarkdown>
    </div>
  );
}

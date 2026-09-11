import type { DocumentSummary } from "@/lib/documents/list-documents";

/**
 * Opening questions for a knowledge base that has sources but no messages yet
 * (docs/ux-principles.md §III.4).
 *
 * Template-driven from the sources that are actually ready — no model call, no
 * new endpoint, no cost, and honest: every name in a suggestion is a source
 * that exists and can genuinely be asked about. They double as capability
 * disclosure, since a user who has never considered asking about a recording
 * learns they can at the exact moment it is useful.
 *
 * A model-generated variant is a deliberate later enhancement with its own
 * design, not a silent addition (docs/ux-principles.md §V.4).
 */

const MAX_SUGGESTIONS = 4;

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

export function suggestedQuestions(documents: DocumentSummary[]): string[] {
  const ready = documents.filter((doc) => doc.status === "READY");
  if (ready.length === 0) return [];

  const recordings = ready.filter((doc) => doc.contentType === "video");
  const images = ready.filter((doc) => doc.contentType === "image");
  const readable = ready.filter((doc) => doc.contentType !== "video" && doc.contentType !== "image");

  const suggestions: string[] = [];

  // Ordered so the most distinctive capability a user would not think to try
  // comes first. Asking a recording what was decided is the product's
  // "I didn't know I could do that" moment; summarising a PDF is not.
  if (recordings[0]) {
    suggestions.push(`What was decided in ${stripExtension(recordings[0].name)}?`);
  }

  const [firstReadable, secondReadable] = readable;
  if (firstReadable && secondReadable) {
    suggestions.push(
      `What's different between ${stripExtension(firstReadable.name)} and ${stripExtension(secondReadable.name)}?`,
    );
  }

  if (images[0]) {
    suggestions.push(`What does ${stripExtension(images[0].name)} show?`);
  }

  const newest = firstReadable ?? ready[0];
  if (newest) {
    suggestions.push(`What are the main points in ${stripExtension(newest.name)}?`);
  }

  if (ready.length >= 3) {
    suggestions.push("What do these sources disagree about?");
  }

  return [...new Set(suggestions)].slice(0, MAX_SUGGESTIONS);
}

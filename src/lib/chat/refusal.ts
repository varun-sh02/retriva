/**
 * The exact words Retriva uses when the knowledge base supports no part of a
 * question. Deliberately *not* in prompt.ts, which is server-only: the chat UI
 * has to recognise this string to render the refusal as a composed, deliberate
 * state rather than as an error (docs/ux-principles.md §4).
 *
 * One definition, two consumers — the system prompt asserts it and the client
 * matches on it, so the two can never drift apart. Changing this string
 * changes model behaviour and is asserted by the eval suite.
 */
export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "I couldn't find enough evidence in this knowledge base to answer that confidently.";

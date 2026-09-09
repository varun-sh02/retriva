import { z } from "zod";

/**
 * Upper bound on a single chat message.
 *
 * Deliberately generous: pasting a whole job description, a vendor
 * capability list, or a requirements excerpt and asking how the knowledge
 * base measures up is a first-class query shape, not an edge case. The cap
 * exists to bound embedding and prompt cost, not to enforce a "questions are
 * short" assumption.
 *
 * This is the ONLY message-length limit in the request path — normalizeQuery
 * defers to it rather than silently truncating to a second, smaller number.
 */
export const MAX_MESSAGE_LENGTH = 8000;

export const chatRequestSchema = z.object({
  knowledgeBaseId: z.uuid("knowledgeBaseId must be a valid UUID"),
  conversationId: z.uuid("conversationId must be a valid UUID").optional(),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(
      MAX_MESSAGE_LENGTH,
      `Message is too long — ${MAX_MESSAGE_LENGTH.toLocaleString()} characters maximum.`,
    ),
});

import { badRequest } from "@/lib/http/api-error";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";

/**
 * Collapses whitespace and rejects an empty message. Length is NOT enforced
 * here: chatRequestSchema already rejects anything over MAX_MESSAGE_LENGTH
 * before this runs. This function used to silently `.slice()` to a smaller
 * limit of its own, which was both unreachable and a contradiction — one
 * layer truncating while the other refused.
 */
export function normalizeQuery(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    throw badRequest("Message cannot be empty");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(
      `Message is too long — ${MAX_MESSAGE_LENGTH.toLocaleString()} characters maximum.`,
    );
  }
  return trimmed;
}

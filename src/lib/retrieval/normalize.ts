import { badRequest } from "@/lib/http/api-error";

const MAX_QUERY_LENGTH = 2000;

export function normalizeQuery(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    throw badRequest("Message cannot be empty");
  }
  return trimmed.slice(0, MAX_QUERY_LENGTH);
}

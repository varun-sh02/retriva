import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 52428800; // 50 MB — matches the Storage bucket and documents.size_bytes CHECK

// Shape/presence only. The MIME allowlist (-> 415) and the size ceiling
// (-> 413) are dedicated status codes per docs/api-contracts.md §1, not
// generic 400s, so those are checked explicitly in the route rather than
// folded into this schema.
export const uploadUrlRequestSchema = z.object({
  knowledgeBaseId: z.uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(1),
});

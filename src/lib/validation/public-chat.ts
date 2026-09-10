import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "./chat";

/**
 * Note what is absent: no knowledgeBaseId, no workspaceId. A public caller
 * names the knowledge base only indirectly, via a share token the server
 * resolves itself (src/lib/auth/public-share.ts).
 */
export const publicChatRequestSchema = z.object({
  shareToken: z.string().min(32).max(128),
  visitorId: z.string().min(8).max(64),
  conversationId: z.uuid("conversationId must be a valid UUID").optional(),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(
      MAX_MESSAGE_LENGTH,
      `Message is too long — ${MAX_MESSAGE_LENGTH.toLocaleString()} characters maximum.`,
    ),
});

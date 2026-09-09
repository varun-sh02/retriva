import { z } from "zod";

export const chatRequestSchema = z.object({
  knowledgeBaseId: z.uuid(),
  conversationId: z.uuid().optional(),
  message: z.string().min(1).max(2000),
});

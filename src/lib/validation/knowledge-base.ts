import { z } from "zod";

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const updateKnowledgeBaseSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one of name or description is required",
  });

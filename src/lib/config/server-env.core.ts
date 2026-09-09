// No `server-only` import here on purpose: this module is also imported by
// standalone Node scripts (scripts/preflight.ts, future migration/seed
// scripts) that run outside the Next.js bundler, where `server-only`
// unconditionally throws. The application itself never imports this file
// directly — it imports `./server-env`, which re-exports this with the
// `server-only` guard applied.
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  GEMINI_FALLBACK_MODEL: z.string().min(1).optional(),
  GEMINI_EMBEDDING_MODEL: z.string().min(1),

  QDRANT_URL: z.url(),
  QDRANT_API_KEY: z.string().min(1),
  QDRANT_COLLECTION: z.string().min(1),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
    QDRANT_URL: process.env.QDRANT_URL,
    QDRANT_API_KEY: process.env.QDRANT_API_KEY,
    QDRANT_COLLECTION: process.env.QDRANT_COLLECTION,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();

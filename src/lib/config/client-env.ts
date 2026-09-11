import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  // Present in .env.local, deliberately absent from the Vercel project so
  // that production always falls through to Supabase magic-link auth. See
  // src/app/(auth)/sign-in/page.tsx.
  NEXT_PUBLIC_DEV_AUTH_BYPASS: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

function loadClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEV_AUTH_BYPASS: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment configuration:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}

export const clientEnv = loadClientEnv();

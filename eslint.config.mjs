import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Client components and hooks must never import privileged server-only
    // modules (docs/security.md checklist) — `server-only` itself already
    // makes this a hard build failure, but this catches the mistake at
    // lint time, before a build.
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/gemini/*", "@/lib/qdrant/*", "@/lib/db/service", "@/lib/config/server-env*"],
              message:
                "Server-only modules (secrets, Gemini, Qdrant) must not be imported from components or hooks.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

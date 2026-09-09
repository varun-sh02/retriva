# Retriva evals

Deterministic checks for the properties that must never regress silently:
tenant isolation and citation integrity (docs/evaluation.md §4, §6).

Run: `npx tsx evals/citations.eval.ts` / `npx tsx evals/isolation.eval.ts`

These are not unit tests with mocks — they exercise the real dev server,
real Supabase, real Qdrant, real Gemini, the same way the manual test
scripts used throughout the build did. That is deliberate: the properties
being checked (does a citation resolve to a genuine chunk, does workspace A
ever see workspace B's vectors) can only be falsified by the real stack.

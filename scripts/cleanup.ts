/**
 * Sweeps orphaned UPLOADING rows (>1h old — the user abandoned the upload)
 * and stale processing_lock rows (>6min — a killed function left it held),
 * per docs/implementation-plan.md Phase 14 / ADR-007.
 *
 * Uses the secret-key client deliberately: this is an offline maintenance
 * script (like migrations), not a request handler serving a client-supplied
 * ID, so the service-role restriction in docs/security.md T5 doesn't apply.
 *
 * Intended to run on a schedule (e.g. Vercel Cron hitting a protected route
 * that calls the same logic, or this script directly in CI/cron). Safe to
 * run repeatedly — every action here is idempotent.
 *
 * Run with: npx tsx scripts/cleanup.ts
 */
import { existsSync } from "node:fs";

const ORPHANED_UPLOAD_THRESHOLD_MS = 60 * 60 * 1000;
const STALE_LOCK_THRESHOLD_MS = 6 * 60 * 1000;

async function main() {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const clientEnvModule = await import("../src/lib/config/client-env");
  const serverEnvModule = await import("../src/lib/config/server-env.core");

  const admin = createClient(
    clientEnvModule.clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvModule.serverEnv.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const orphanedThreshold = new Date(Date.now() - ORPHANED_UPLOAD_THRESHOLD_MS).toISOString();
  const { data: orphaned, error: orphanedError } = await admin
    .from("documents")
    .update({ status: "FAILED", error_message: "Upload was never confirmed." })
    .eq("status", "UPLOADING")
    .lt("created_at", orphanedThreshold)
    .select("id");
  if (orphanedError) throw orphanedError;
  console.log(`✔ marked ${orphaned?.length ?? 0} orphaned UPLOADING document(s) as FAILED`);

  const staleLockThreshold = new Date(Date.now() - STALE_LOCK_THRESHOLD_MS).toISOString();
  const { data: unlocked, error: unlockedError } = await admin
    .from("documents")
    .update({ processing_lock: null })
    .eq("status", "PROCESSING")
    .lt("processing_lock", staleLockThreshold)
    .select("id");
  if (unlockedError) throw unlockedError;
  console.log(`✔ released ${unlocked?.length ?? 0} stale processing lock(s)`);
}

main().catch((error) => {
  console.error("Cleanup sweep failed:", error);
  process.exit(1);
});

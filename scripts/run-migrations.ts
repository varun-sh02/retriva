/**
 * Applies supabase/migrations/*.sql to the database in filename order,
 * tracking what's already applied in a schema_migrations table so re-runs
 * are idempotent (only new files execute).
 *
 * Run with: npx tsx scripts/run-migrations.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "supabase", "migrations");

async function main() {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("[YOUR-PASSWORD]")) {
    console.error(
      "DATABASE_URL is missing or still has the [YOUR-PASSWORD] placeholder. " +
        "Set it in .env.local (Supabase Dashboard -> Project Settings -> Database -> Connection string).",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows: appliedRows } = await client.query<{ filename: string }>(
      "select filename from public.schema_migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ranCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`↷ skip  ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

      console.log(`▶ apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into public.schema_migrations (filename) values ($1)", [
          file,
        ]);
        await client.query("commit");
        console.log(`✔ done  ${file}`);
        ranCount += 1;
      } catch (error) {
        await client.query("rollback");
        console.error(`✘ failed ${file}`);
        throw error;
      }
    }

    console.log(
      ranCount === 0
        ? "\nNo new migrations to apply."
        : `\nApplied ${ranCount} migration(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration run failed:", error);
  process.exit(1);
});

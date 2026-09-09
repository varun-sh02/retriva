/**
 * Seeds the "Project Atlas" demo corpus (docs/implementation-plan.md spec
 * §32) into a real user's workspace via the actual HTTP API — the same
 * upload -> confirm -> process path a real user goes through, not a direct
 * database write.
 *
 * Requires the dev server running at localhost:3000.
 * Run with: npx tsx scripts/seed-demo.ts you@example.com
 *
 * Video is intentionally omitted from this seed: producing a real
 * decodable video file requires a video encoder this project doesn't
 * bundle (see README "Known limitations"). Add a real .mp4 through the UI
 * yourself if you want the video-citation part of the demo story.
 */
import { existsSync } from "node:fs";

const BASE = "http://localhost:3000";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-demo.ts <your-email>");
    process.exit(1);
  }

  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");
  const { clientEnv } = await import("../src/lib/config/client-env");
  const { serverEnv } = await import("../src/lib/config/server-env.core");
  const sharp = (await import("sharp")).default;

  const admin = createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Resolving a session for ${email}...`);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const response = await fetch(linkData.properties.action_link, { redirect: "manual" });
  const location = response.headers.get("location");
  if (!location) throw new Error("Magic link did not redirect as expected.");

  const params = new URLSearchParams(new URL(location).hash.slice(1));
  const captured: { name: string; value: string }[] = [];
  const client = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (c) => {
          captured.push(...c);
        },
      },
    },
  );
  const { error: sessionError } = await client.auth.setSession({
    access_token: params.get("access_token") ?? "",
    refresh_token: params.get("refresh_token") ?? "",
  });
  if (sessionError) throw sessionError;

  const cookie = captured[0];
  if (!cookie) throw new Error("Session exchange produced no cookie.");
  const cookieHeader = `${cookie.name}=${cookie.value}`;

  async function api(path: string, options: RequestInit = {}) {
    const resp = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...options.headers, Cookie: cookieHeader },
    });
    const body = await resp.json().catch(() => null);
    return { status: resp.status, body };
  }

  console.log("Creating the Project Atlas knowledge base...");
  const kbResp = await api("/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Project Atlas",
      description: "Demo knowledge base — requirements, two architecture revisions, and a diagram.",
    }),
  });
  if (kbResp.status !== 201) {
    console.error("Could not create the demo knowledge base:", kbResp.body);
    process.exit(1);
  }
  const knowledgeBaseId = kbResp.body.id;
  console.log(`  -> KB id: ${knowledgeBaseId}`);

  async function uploadAndProcess(filename: string, mimeType: string, bytes: Buffer) {
    const urlResp = await api("/api/documents/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgeBaseId, filename, mimeType, sizeBytes: bytes.length }),
    });
    if (urlResp.status !== 201) {
      console.error(`  ✘ ${filename}: upload-url failed`, urlResp.body);
      return;
    }

    await fetch(urlResp.body.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: new Uint8Array(bytes),
    });

    const confirmResp = await api(`/api/documents/${urlResp.body.documentId}/confirm`, { method: "POST" });
    if (confirmResp.status !== 200) {
      console.error(`  ✘ ${filename}: confirm failed`, confirmResp.body);
      return;
    }

    for (let i = 0; i < 30; i++) {
      const processResp = await api(`/api/documents/${urlResp.body.documentId}/process`, { method: "POST" });
      if (processResp.body?.done) {
        console.log(`  ${processResp.body.status === "READY" ? "✔" : "✘"} ${filename} -> ${processResp.body.status}`);
        return;
      }
    }
    console.error(`  ✘ ${filename}: did not finish processing within 30 steps`);
  }

  const requirements = `# Requirements

## Database

The system must support relational queries and strong consistency for financial audit trails. Every transaction must be traceable end-to-end.

## Scale

Expected load is under 10,000 requests per day initially, growing to 100,000 within the first year.

## Unresolved

Real-time collaboration requirements have not been finalized and are tracked separately.
`;

  const architectureV1 = `# Architecture v1 (Original Proposal)

## Datastore

The original proposal used MongoDB for flexibility during early development, since the schema was expected to change frequently in the first few months.

## Caching

No dedicated caching layer was planned in this version.
`;

  const architectureFinal = `# Architecture Final

## Datastore Decision

After further review, the team switched from MongoDB to PostgreSQL. PostgreSQL was chosen because it provides strong relational consistency, which is required for the financial audit trail requirement in requirements.md, and the team already operates PostgreSQL in production for other services.

## Caching

Redis was added as a cache layer in front of PostgreSQL. Redis is never a source of truth — all writes go to PostgreSQL first.

## Frontend

The frontend is built with Next.js, communicating with the API layer over REST.
`;

  const productNotes = `# Product Notes

Project Atlas is the internal codename for the new customer records platform.

Key stakeholders: Engineering, Finance (audit trail owner), Support.

Target launch: end of the current quarter.
`;

  const diagramSvg = `<svg width="500" height="260" xmlns="http://www.w3.org/2000/svg">
<rect width="500" height="260" fill="white"/>
<rect x="20" y="20" width="140" height="50" fill="#2563eb"/>
<text x="90" y="50" font-size="14" fill="white" text-anchor="middle">Next.js Frontend</text>
<rect x="200" y="20" width="100" height="50" fill="#7c3aed"/>
<text x="250" y="50" font-size="14" fill="white" text-anchor="middle">API</text>
<rect x="200" y="120" width="100" height="50" fill="#16a34a"/>
<text x="250" y="150" font-size="14" fill="white" text-anchor="middle">PostgreSQL</text>
<rect x="340" y="120" width="100" height="50" fill="#dc2626"/>
<text x="390" y="150" font-size="13" fill="white" text-anchor="middle">Redis Cache</text>
<line x1="160" y1="45" x2="200" y2="45" stroke="black" stroke-width="2"/>
<line x1="250" y1="70" x2="250" y2="120" stroke="black" stroke-width="2"/>
<line x1="300" y1="145" x2="340" y2="145" stroke="black" stroke-width="2"/>
</svg>`;
  const diagramPng = await sharp(Buffer.from(diagramSvg)).png().toBuffer();

  console.log("Uploading demo documents...");
  await uploadAndProcess("requirements.md", "text/markdown", Buffer.from(requirements));
  await uploadAndProcess("architecture-v1.md", "text/markdown", Buffer.from(architectureV1));
  await uploadAndProcess("architecture-final.md", "text/markdown", Buffer.from(architectureFinal));
  await uploadAndProcess("product-notes.md", "text/markdown", Buffer.from(productNotes));
  await uploadAndProcess("architecture-diagram.png", "image/png", diagramPng);

  console.log(
    "\nDone. Sign in as the same email and open \"Project Atlas\" to try questions like:\n" +
      '  "What changed between the original and final architecture?"\n' +
      '  "Why was PostgreSQL chosen?"\n' +
      '  "What does the architecture diagram show?"\n' +
      '  "Are there any unresolved requirements?"',
  );
}

main().catch((error) => {
  console.error("Demo seed failed:", error);
  process.exit(1);
});

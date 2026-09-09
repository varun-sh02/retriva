// Shared helpers for evals/*.eval.ts — real HTTP against the dev server,
// real Supabase admin API for session/user setup, no mocks.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const BASE = "http://localhost:3000";

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function makeSession(admin, prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;

  const resp = await fetch(data.properties.action_link, { redirect: "manual" });
  const hash = new URL(resp.headers.get("location")).hash.slice(1);
  const params = new URLSearchParams(hash);

  const captured = [];
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll() { return []; }, setAll(c) { captured.push(...c); } } },
  );
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  });
  if (sessionError) throw sessionError;

  const cookie = captured[0];
  return { userId: sessionData.user.id, cookieHeader: `${cookie.name}=${cookie.value}` };
}

export async function api(cookieHeader, path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...options.headers, Cookie: cookieHeader },
  });
  const text = await resp.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: resp.status, body };
}

export async function uploadAndProcess(cookieHeader, knowledgeBaseId, filename, mimeType, bytes) {
  const urlResp = await api(cookieHeader, "/api/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knowledgeBaseId, filename, mimeType, sizeBytes: bytes.length }),
  });
  if (urlResp.status !== 201) {
    throw new Error(`upload-url failed: ${JSON.stringify(urlResp.body)}`);
  }

  await fetch(urlResp.body.signedUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });

  const confirmResp = await api(cookieHeader, `/api/documents/${urlResp.body.documentId}/confirm`, {
    method: "POST",
  });
  if (confirmResp.status !== 200) {
    throw new Error(`confirm failed: ${JSON.stringify(confirmResp.body)}`);
  }

  for (let i = 0; i < 30; i++) {
    const resp = await api(cookieHeader, `/api/documents/${urlResp.body.documentId}/process`, {
      method: "POST",
    });
    if (resp.body.done) {
      return { documentId: urlResp.body.documentId, final: resp.body };
    }
  }
  throw new Error(`document "${filename}" did not finish processing within 30 steps`);
}

export async function streamChat(cookieHeader, knowledgeBaseId, message, conversationId) {
  const resp = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ knowledgeBaseId, conversationId, message }),
  });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  const events = [];
  for (const frame of raw.split("\n\n").filter((f) => f.trim())) {
    const eventMatch = frame.match(/^event: (.+)$/m);
    const dataMatch = frame.match(/^data: (.+)$/m);
    if (eventMatch && dataMatch) {
      events.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
    }
  }

  const answer = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  const citations = events.find((e) => e.event === "citations")?.data.citations ?? [];
  const conversationIdOut = events.find((e) => e.event === "meta")?.data.conversationId;

  return { answer, citations, conversationId: conversationIdOut, events };
}

export function report(results) {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

export function makeChecker(results) {
  return function check(name, pass, detail) {
    results.push({ name, pass });
    console.log(`${pass ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`);
  };
}

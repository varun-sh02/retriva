import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Sidebar } from "@/components/shell/Sidebar";
import { requireSession } from "@/lib/auth/session";
import { listKnowledgeBases } from "@/lib/knowledge/list-knowledge-bases";

// requireSession() throwing here would mean an unauthenticated request
// reached this layout — src/proxy.ts redirects those to /sign-in before
// they ever get here, so this should never actually throw in practice.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBases = await listKnowledgeBases(supabase, workspaceId);

  return (
    <AppShell sidebar={<Sidebar knowledgeBases={knowledgeBases} />} knowledgeBases={knowledgeBases}>
      {children}
    </AppShell>
  );
}

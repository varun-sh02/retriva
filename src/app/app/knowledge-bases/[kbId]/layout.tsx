import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { KnowledgeBaseNav } from "@/components/knowledge/KnowledgeBaseNav";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { getKnowledgeBaseCounts } from "@/lib/knowledge/list-knowledge-bases";
import { ApiError } from "@/lib/http/api-error";

/**
 * Describes what this knowledge base actually is and whether it can answer
 * yet — the two things a knowledge base has to communicate to feel like more
 * than a folder (docs/ux-principles.md Part II).
 */
function readiness({
  documentCount,
  readyCount,
  processingCount,
  failedCount,
}: {
  documentCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
}): string {
  if (documentCount === 0) return "No sources yet";

  const parts = [`${readyCount} ready`];
  if (processingCount > 0) parts.push(`${processingCount} still being read`);
  if (failedCount > 0) parts.push(`${failedCount} couldn't be processed`);
  return parts.join(" · ");
}

export default async function KnowledgeBaseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { workspaceId, supabase } = await requireSession();

  let knowledgeBase;
  try {
    knowledgeBase = await requireKnowledgeBase(supabase, workspaceId, kbId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const counts = await getKnowledgeBaseCounts(supabase, knowledgeBase.id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-0.5 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{knowledgeBase.name}</h1>
        {knowledgeBase.description && (
          <p className="text-sm text-muted-foreground">{knowledgeBase.description}</p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {counts.documentCount} {counts.documentCount === 1 ? "source" : "sources"} ·{" "}
          {readiness(counts)}
        </p>
      </div>
      <div className="border-b">
        <KnowledgeBaseNav knowledgeBaseId={knowledgeBase.id} />
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

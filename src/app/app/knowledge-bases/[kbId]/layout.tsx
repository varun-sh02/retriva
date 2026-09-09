import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { KnowledgeBaseNav } from "@/components/knowledge/KnowledgeBaseNav";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/api-error";

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">{knowledgeBase.name}</h1>
        {knowledgeBase.description && (
          <p className="text-sm text-muted-foreground">{knowledgeBase.description}</p>
        )}
      </div>
      <div className="border-b">
        <KnowledgeBaseNav knowledgeBaseId={knowledgeBase.id} />
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeBaseSummary = {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  updatedAt: string;
};

type StatsRow = {
  knowledge_base_id: string;
  document_count: number;
  ready_count: number;
  processing_count: number;
  failed_count: number;
};

/**
 * Direct RLS-scoped read for Server Components (docs/architecture.md §10 —
 * reads happen in Server Components, not through the API).
 */
export async function listKnowledgeBases(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<KnowledgeBaseSummary[]> {
  const { data, error } = await supabase
    .from("knowledge_bases")
    .select("id, name, description, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const knowledgeBases = data ?? [];
  if (knowledgeBases.length === 0) {
    return [];
  }

  // knowledge_base_stats is security_invoker (supabase/migrations/0004_documents.sql),
  // so this still only returns rows for knowledge bases the caller's RLS
  // allows through the underlying join — the .in() filter here is a query
  // optimization, not the security boundary.
  const { data: statsRows, error: statsError } = await supabase
    .from("knowledge_base_stats")
    .select("knowledge_base_id, document_count, ready_count, processing_count, failed_count")
    .in(
      "knowledge_base_id",
      knowledgeBases.map((kb) => kb.id),
    );

  if (statsError) {
    throw statsError;
  }

  const statsById = new Map<string, StatsRow>((statsRows ?? []).map((row) => [row.knowledge_base_id, row]));

  return knowledgeBases.map((kb) => {
    const stats = statsById.get(kb.id);
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description,
      documentCount: stats?.document_count ?? 0,
      readyCount: stats?.ready_count ?? 0,
      processingCount: stats?.processing_count ?? 0,
      failedCount: stats?.failed_count ?? 0,
      updatedAt: kb.updated_at,
    };
  });
}

export type KnowledgeBaseCounts = {
  documentCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
};

/** Same security_invoker note as listKnowledgeBases above. */
export async function getKnowledgeBaseCounts(
  supabase: SupabaseClient,
  knowledgeBaseId: string,
): Promise<KnowledgeBaseCounts> {
  const { data, error } = await supabase
    .from("knowledge_base_stats")
    .select("document_count, ready_count, processing_count, failed_count")
    .eq("knowledge_base_id", knowledgeBaseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    documentCount: data?.document_count ?? 0,
    readyCount: data?.ready_count ?? 0,
    processingCount: data?.processing_count ?? 0,
    failedCount: data?.failed_count ?? 0,
  };
}

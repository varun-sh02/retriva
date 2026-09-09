import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentSummary = {
  id: string;
  name: string;
  mimeType: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  stage: string | null;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
};

export async function listDocuments(
  supabase: SupabaseClient,
  knowledgeBaseId: string,
): Promise<DocumentSummary[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, name, mime_type, content_type, size_bytes, status, stage, error_message, chunk_count, created_at",
    )
    .eq("knowledge_base_id", knowledgeBaseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    mimeType: doc.mime_type,
    contentType: doc.content_type,
    sizeBytes: doc.size_bytes,
    status: doc.status,
    stage: doc.stage,
    errorMessage: doc.error_message,
    chunkCount: doc.chunk_count,
    createdAt: doc.created_at,
  }));
}

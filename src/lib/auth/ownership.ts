import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/http/api-error";

export type KnowledgeBaseRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Resolves a knowledge base and verifies it belongs to the caller's
 * workspace. Returns 404 (never 403) for a non-owned id, per
 * docs/api-contracts.md §1 — a 403 would confirm the resource exists.
 *
 * The `workspace_id` filter here is explicit, server-side ownership
 * verification independent of RLS (docs/security.md T1) — RLS alone is not
 * treated as the only line of defense.
 *
 * Memoized per request for the same reason as requireSession: the knowledge
 * base layout and the page beneath it both verify the same id, and the answer
 * cannot change between them. Cache hits depend on the `supabase` argument
 * being the same reference, which it is because requireSession is itself
 * memoized and hands back one client per request.
 */
export const requireKnowledgeBase = cache(async function requireKnowledgeBase(
  supabase: SupabaseClient,
  workspaceId: string,
  id: string,
): Promise<KnowledgeBaseRow> {
  const { data, error } = await supabase
    .from("knowledge_bases")
    .select("id, workspace_id, name, description, created_at, updated_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw notFound("Knowledge base not found");
  }

  return data;
});

export type DocumentRow = {
  id: string;
  knowledge_base_id: string;
  workspace_id: string;
  name: string;
  mime_type: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  checksum: string | null;
  status: string;
  stage: string | null;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

/** Same ownership contract as requireKnowledgeBase, for documents. */
export async function requireDocument(
  supabase: SupabaseClient,
  workspaceId: string,
  id: string,
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, knowledge_base_id, workspace_id, name, mime_type, content_type, size_bytes, storage_path, checksum, status, stage, error_message, chunk_count, created_at, updated_at",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw notFound("Document not found");
  }

  return data;
}

export type ConversationRow = {
  id: string;
  knowledge_base_id: string;
  workspace_id: string;
  title: string | null;
  summary: string | null;
  summarized_through: number;
  created_at: string;
  updated_at: string;
};

/**
 * Same ownership contract as requireKnowledgeBase/requireDocument, plus a
 * check that the conversation actually belongs to the requested knowledge
 * base — a conversation from KB1 used with KB2 is a 404, not a silent
 * reassignment (docs/api-contracts.md §4).
 */
export async function requireConversation(
  supabase: SupabaseClient,
  workspaceId: string,
  knowledgeBaseId: string,
  id: string,
): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, knowledge_base_id, workspace_id, title, summary, summarized_through, created_at, updated_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("knowledge_base_id", knowledgeBaseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw notFound("Conversation not found");
  }

  return data;
}

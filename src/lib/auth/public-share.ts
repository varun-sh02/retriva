import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { notFound } from "@/lib/http/api-error";

export type PublicShare = {
  workspaceId: string;
  knowledgeBaseId: string;
  name: string;
  greeting: string | null;
  description: string | null;
  avatarUrl: string | null;
  suggestedPrompts: string[];
};

/**
 * 32 bytes of CSPRNG entropy, base64url. The token is the only credential
 * guarding a public knowledge base, so it has to be unguessable on its own —
 * there is no second factor and no rate limit that would make a short token
 * safe.
 */
export function mintShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Resolves a share token to the knowledge base it points at.
 *
 * This is the single place where a public request turns an opaque string into
 * real ids, and it is deliberately the ONLY way it can happen: no public
 * endpoint accepts a workspace or knowledge base id from the caller. Whatever
 * this returns was read out of the row the token itself identifies, so a
 * visitor cannot steer a request at a different tenant no matter what they
 * send.
 *
 * It uses the service client because an anonymous caller has no session for
 * RLS to key on, and every query built from the result is explicitly filtered
 * by the workspace and knowledge base resolved here — the same explicit
 * server-side scoping the authenticated path uses (docs/security.md T1).
 *
 * A disabled or unknown token is a 404, never a 403: distinguishing the two
 * would confirm that a given token exists.
 */
export async function resolvePublicShare(token: string): Promise<PublicShare> {
  if (!token || token.length < 32 || token.length > 128) {
    throw notFound("This chat is not available");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("knowledge_bases")
    .select(
      "id, workspace_id, name, public_greeting, public_enabled, public_description, public_avatar_path, public_suggested_prompts",
    )
    .eq("public_share_token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.public_enabled) {
    throw notFound("This chat is not available");
  }

  const avatarPath = data.public_avatar_path as string | null;
  const avatarUrl = avatarPath ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl : null;

  return {
    workspaceId: data.workspace_id as string,
    knowledgeBaseId: data.id as string,
    name: data.name as string,
    greeting: (data.public_greeting as string | null) ?? null,
    description: (data.public_description as string | null) ?? null,
    avatarUrl,
    suggestedPrompts: (data.public_suggested_prompts as string[] | null) ?? [],
  };
}

/**
 * Continues a visitor's own conversation, or starts a new one.
 *
 * `visitorId` is an opaque value the widget keeps in the browser. It is not
 * an identity claim and grants nothing on its own — its only job is to stop
 * one visitor resuming another's thread, since every widget visitor to the
 * same knowledge base is otherwise indistinguishable and a conversation id
 * would be sufficient to read someone else's messages.
 *
 * A conversation id that does not match on all of knowledge base, workspace,
 * and visitor is treated as absent and a fresh conversation is started, so a
 * probe learns nothing from the response.
 */
export async function resolveVisitorConversation(
  supabase: SupabaseClient,
  params: {
    share: PublicShare;
    conversationId?: string;
    visitorId: string;
    title: string;
  },
): Promise<string> {
  if (params.conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", params.conversationId)
      .eq("knowledge_base_id", params.share.knowledgeBaseId)
      .eq("workspace_id", params.share.workspaceId)
      .eq("visitor_id", params.visitorId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id as string;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      knowledge_base_id: params.share.knowledgeBaseId,
      workspace_id: params.share.workspaceId,
      visitor_id: params.visitorId,
      title: params.title.slice(0, 80),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

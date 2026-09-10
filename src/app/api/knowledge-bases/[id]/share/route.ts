import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { mintShareToken } from "@/lib/auth/public-share";
import { requireSession } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { z } from "zod";

const shareUpdateSchema = z.object({
  enabled: z.boolean(),
  greeting: z.string().max(300).nullish(),
  /** Invalidates the current link and issues a new one. */
  rotate: z.boolean().optional(),
});

/**
 * Turns public sharing on or off for one knowledge base.
 *
 * Disabling keeps the token row intact so re-enabling restores the same
 * link — convenient, and safe because resolvePublicShare checks
 * `public_enabled` rather than the token's mere existence. Rotating is the
 * destructive option, and the only way to actually invalidate a link that
 * has escaped.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();
    const { id } = await context.params;
    await requireKnowledgeBase(supabase, workspaceId, id);

    const body = await request.json().catch(() => null);
    const parsed = shareUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid share settings", parsed.error.flatten());
    }

    const { data: current, error: readError } = await supabase
      .from("knowledge_bases")
      .select("public_share_token")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();
    if (readError) throw readError;

    const needsToken = parsed.data.enabled && !current.public_share_token;
    const token =
      parsed.data.rotate || needsToken
        ? mintShareToken()
        : (current.public_share_token as string | null);

    const { data, error } = await supabase
      .from("knowledge_bases")
      .update({
        public_enabled: parsed.data.enabled,
        public_share_token: token,
        ...(parsed.data.greeting !== undefined ? { public_greeting: parsed.data.greeting } : {}),
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("public_enabled, public_share_token, public_greeting")
      .single();
    if (error) throw error;

    return Response.json({
      enabled: data.public_enabled,
      shareToken: data.public_enabled ? data.public_share_token : null,
      greeting: data.public_greeting,
    });
  });
}

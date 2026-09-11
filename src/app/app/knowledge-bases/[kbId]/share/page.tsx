import { ShareSettings } from "@/components/knowledge/ShareSettings";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/config/app-url";

export default async function KnowledgeBaseSharePage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { workspaceId, supabase } = await requireSession();

  // Layout.tsx (a parent segment) already calls requireKnowledgeBase and
  // would 404 before this page renders on a non-owned id — this call
  // re-verifies independently rather than trusting that upstream check,
  // consistent with every other page/route in the app.
  const knowledgeBase = await requireKnowledgeBase(supabase, workspaceId, kbId);

  // requireKnowledgeBase intentionally selects a fixed column list, so the
  // sharing columns are read here rather than widening its shared row type.
  const { data: share } = await supabase
    .from("knowledge_bases")
    .select(
      "public_enabled, public_share_token, public_greeting, public_description, public_avatar_path, public_suggested_prompts",
    )
    .eq("id", knowledgeBase.id)
    .eq("workspace_id", workspaceId)
    .single();

  const avatarUrl = share?.public_avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(share.public_avatar_path).data.publicUrl
    : null;

  // Resolved from the request, not from a build-time env var, so the snippet
  // names this deployment's real origin (src/lib/config/app-url.ts).
  const appOrigin = await requestOrigin();

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <ShareSettings
        knowledgeBaseId={knowledgeBase.id}
        appOrigin={appOrigin}
        initial={{
          enabled: share?.public_enabled ?? false,
          shareToken: share?.public_enabled ? (share.public_share_token ?? null) : null,
          greeting: share?.public_greeting ?? null,
          description: share?.public_description ?? null,
          suggestedPrompts: (share?.public_suggested_prompts as string[] | null) ?? [],
          avatarUrl,
        }}
      />
    </div>
  );
}

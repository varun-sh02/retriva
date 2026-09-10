import { DocumentList } from "@/components/knowledge/DocumentList";
import { ShareSettings } from "@/components/knowledge/ShareSettings";
import { UploadDropzone } from "@/components/knowledge/UploadDropzone";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents/list-documents";

export default async function KnowledgeBaseDocumentsPage({
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
  const documents = await listDocuments(supabase, knowledgeBase.id);

  // requireKnowledgeBase intentionally selects a fixed column list, so the
  // sharing columns are read here rather than widening its shared row type.
  const { data: share } = await supabase
    .from("knowledge_bases")
    .select("public_enabled, public_share_token")
    .eq("id", knowledgeBase.id)
    .eq("workspace_id", workspaceId)
    .single();

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        <UploadDropzone knowledgeBaseId={knowledgeBase.id} />
        <DocumentList documents={documents} />
        <ShareSettings
          knowledgeBaseId={knowledgeBase.id}
          initial={{
            enabled: share?.public_enabled ?? false,
            shareToken: share?.public_enabled ? (share.public_share_token ?? null) : null,
          }}
        />
      </div>
    </div>
  );
}

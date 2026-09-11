import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/EmptyState";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/CreateKnowledgeBaseDialog";
import { KnowledgeBaseOverview } from "@/components/knowledge/KnowledgeBaseOverview";
import { requireSession } from "@/lib/auth/session";
import { listKnowledgeBases } from "@/lib/knowledge/list-knowledge-bases";

export default async function AppHomePage() {
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBases = await listKnowledgeBases(supabase, workspaceId);

  if (knowledgeBases.length === 0) {
    return (
      <EmptyState
        title="Welcome to Retriva"
        description="A knowledge base is one body of material you ask questions about — a project, a client, a product area. Add documents, images, and recordings, and every answer will point back to where it came from."
        action={<CreateKnowledgeBaseDialog trigger={<Button>Create knowledge base</Button>} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Your knowledge bases</h1>
          <p className="text-sm text-muted-foreground">
            Open one to ask across everything in it.
          </p>
        </div>
        <CreateKnowledgeBaseDialog
          trigger={
            <Button variant="outline" size="sm">
              New knowledge base
            </Button>
          }
        />
      </div>

      <KnowledgeBaseOverview knowledgeBases={knowledgeBases} />
    </div>
  );
}

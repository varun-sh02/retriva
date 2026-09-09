import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/EmptyState";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/CreateKnowledgeBaseDialog";
import { requireSession } from "@/lib/auth/session";
import { listKnowledgeBases } from "@/lib/knowledge/list-knowledge-bases";

export default async function AppHomePage() {
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBases = await listKnowledgeBases(supabase, workspaceId);

  if (knowledgeBases.length === 0) {
    return (
      <EmptyState
        title="Welcome to Retriva"
        description="Your knowledge, finally connected. Create a knowledge base and add documents, images, or videos. Then ask questions across everything you've uploaded."
        action={
          <CreateKnowledgeBaseDialog
            trigger={<Button>Create knowledge base</Button>}
          />
        }
      />
    );
  }

  return (
    <EmptyState
      title="Select a knowledge base"
      description="Choose a knowledge base from the sidebar, or create a new one."
    />
  );
}

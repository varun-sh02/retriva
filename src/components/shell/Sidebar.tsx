import { LogOut } from "lucide-react";
import type { KnowledgeBaseSummary } from "@/lib/knowledge/list-knowledge-bases";
import { Button } from "@/components/ui/button";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/CreateKnowledgeBaseDialog";
import { KnowledgeBaseList } from "@/components/knowledge/KnowledgeBaseList";

export function Sidebar({ knowledgeBases }: { knowledgeBases: KnowledgeBaseSummary[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-medium text-muted-foreground">Knowledge Bases</span>
        <CreateKnowledgeBaseDialog />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <KnowledgeBaseList knowledgeBases={knowledgeBases} />
      </div>

      <form action="/auth/sign-out" method="post" className="border-t p-2">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </form>
    </div>
  );
}

import Link from "next/link";
import type { KnowledgeBaseSummary } from "@/lib/knowledge/list-knowledge-bases";
import { KnowledgeBaseListItem } from "./KnowledgeBaseListItem";

export function KnowledgeBaseList({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBaseSummary[];
}) {
  if (knowledgeBases.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        No knowledge bases yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 py-1">
      {knowledgeBases.map((kb) => (
        <li key={kb.id} className="group flex items-center">
          <Link
            href={`/app/knowledge-bases/${kb.id}`}
            className="flex-1 truncate rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            {kb.name}
          </Link>
          <KnowledgeBaseListItem knowledgeBase={kb} />
        </li>
      ))}
    </ul>
  );
}

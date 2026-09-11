import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { KnowledgeBaseSummary } from "@/lib/knowledge/list-knowledge-bases";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function readiness(kb: KnowledgeBaseSummary): string {
  if (kb.documentCount === 0) return "No sources yet";
  const parts = [`${kb.readyCount} ready`];
  if (kb.processingCount > 0) parts.push(`${kb.processingCount} being read`);
  if (kb.failedCount > 0) parts.push(`${kb.failedCount} failed`);
  return parts.join(" · ");
}

/**
 * The app home (docs/ux-principles.md Part II).
 *
 * A scannable list, not a metrics dashboard: this screen's only job is to get
 * the user into a knowledge base. Every field here is already returned by
 * listKnowledgeBases, so this costs no extra query.
 */
export function KnowledgeBaseOverview({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBaseSummary[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {knowledgeBases.map((kb) => (
        <li key={kb.id}>
          <Link
            href={`/app/knowledge-bases/${kb.id}`}
            className="group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{kb.name}</p>
              {kb.description && (
                <p className="truncate text-sm text-muted-foreground">{kb.description}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {kb.documentCount} {kb.documentCount === 1 ? "source" : "sources"} ·{" "}
                {readiness(kb)} · {relativeTime(kb.updatedAt)}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
              Ask
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

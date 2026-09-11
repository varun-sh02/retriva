"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Ask · Sources · Share (docs/ux-principles.md Part II).
 *
 * Ask is first and lives at the knowledge base root, because asking is what
 * the user came for. "Sources" replaces "Documents" — a knowledge base also
 * holds images and recordings — and "Share" names the action rather than the
 * artifact it produces (docs/product-language.md §1).
 */
export function KnowledgeBaseNav({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const pathname = usePathname();
  const basePath = `/app/knowledge-bases/${knowledgeBaseId}`;

  const tabs = [
    {
      href: basePath,
      label: "Ask",
      active: pathname === basePath || pathname.startsWith(`${basePath}/chat`),
    },
    {
      href: `${basePath}/sources`,
      label: "Sources",
      active: pathname.startsWith(`${basePath}/sources`),
    },
    {
      href: `${basePath}/share`,
      label: "Share",
      active: pathname.startsWith(`${basePath}/share`),
    },
  ];

  return (
    <nav className="flex gap-4 px-6" aria-label="Knowledge base sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "border-b-2 py-2 text-sm font-medium transition-colors",
            tab.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

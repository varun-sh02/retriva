"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function KnowledgeBaseNav({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const pathname = usePathname();
  const basePath = `/app/knowledge-bases/${knowledgeBaseId}`;
  const chatPath = `${basePath}/chat`;
  const widgetPath = `${basePath}/widget`;

  const tabs = [
    { href: basePath, label: "Documents", active: pathname === basePath },
    { href: chatPath, label: "Chat", active: pathname.startsWith(chatPath) },
    { href: widgetPath, label: "Widget", active: pathname.startsWith(widgetPath) },
  ];

  return (
    <nav className="flex gap-4 px-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
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

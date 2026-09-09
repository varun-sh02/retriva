"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function KnowledgeBaseNav({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const pathname = usePathname();
  const basePath = `/app/knowledge-bases/${knowledgeBaseId}`;
  const chatPath = `${basePath}/chat`;
  const isChat = pathname.startsWith(chatPath);

  const tabs = [
    { href: basePath, label: "Documents", active: !isChat },
    { href: chatPath, label: "Chat", active: isChat },
  ];

  return (
    <nav className="flex gap-4 px-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "border-b-2 py-2 text-sm font-medium",
            tab.active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

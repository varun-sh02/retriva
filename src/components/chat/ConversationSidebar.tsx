"use client";

import { History, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ConversationSummary } from "@/lib/chat/list-messages";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationLinks({
  knowledgeBaseId,
  conversations,
  activeConversationId,
  onNavigate,
}: {
  knowledgeBaseId: string;
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onNavigate?: () => void;
}) {
  const basePath = `/app/knowledge-bases/${knowledgeBaseId}/chat`;

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <Link href={`${basePath}/new`} onClick={onNavigate}>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <Plus className="size-4" />
            New chat
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No chats yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`${basePath}/${conversation.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex flex-col gap-0.5 truncate rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    conversation.id === activeConversationId && "bg-accent",
                  )}
                >
                  <span className="truncate">{conversation.title || "New chat"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatUpdatedAt(conversation.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ConversationSidebar({
  knowledgeBaseId,
  conversations,
  activeConversationId,
}: {
  knowledgeBaseId: string;
  conversations: ConversationSummary[];
  activeConversationId?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <ConversationLinks
          knowledgeBaseId={knowledgeBaseId}
          conversations={conversations}
          activeConversationId={activeConversationId}
        />
      </aside>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 size-8 md:hidden"
        aria-label="Chat history"
        onClick={() => setMobileOpen(true)}
      >
        <History className="size-4" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Chat history</SheetTitle>
          </SheetHeader>
          <ConversationLinks
            knowledgeBaseId={knowledgeBaseId}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

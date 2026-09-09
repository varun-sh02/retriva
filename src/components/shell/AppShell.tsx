"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommandMenu } from "./CommandMenu";

export function AppShell({
  sidebar,
  knowledgeBases,
  children,
}: {
  sidebar: ReactNode;
  knowledgeBases: { id: string; name: string }[];
  children: ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 md:hidden"
          aria-label="Open knowledge bases menu"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
        <span className="font-semibold tracking-tight">Retriva</span>
        <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">⌘K</kbd> to switch
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">{sidebar}</aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Knowledge bases</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">{sidebar}</div>
        </SheetContent>
      </Sheet>

      <CommandMenu knowledgeBases={knowledgeBases} />
    </div>
  );
}

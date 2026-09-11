"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CommandMenu } from "./CommandMenu";

/**
 * Rendering the ⌘ glyph unconditionally told Windows and Linux users to press
 * a key they don't have (docs/ux-principles.md Part IV, #9).
 *
 * useSyncExternalStore rather than an effect: the platform is a value read
 * from outside React that simply differs between the server snapshot and the
 * client one, which is exactly what it exists for. An effect writing state
 * would be a cascading render for a value that never subsequently changes —
 * hence the no-op subscribe.
 */
const NEVER_CHANGES = () => () => {};

function useShortcutKey(): string {
  const isApple = useSyncExternalStore(
    NEVER_CHANGES,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  return isApple ? "⌘" : "Ctrl";
}

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
  const shortcutKey = useShortcutKey();

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
        <Logo />
        <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">{shortcutKey}K</kbd> to
          switch
        </span>
        <ThemeToggle />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r md:flex" aria-label="Knowledge bases">
          {sidebar}
        </aside>
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

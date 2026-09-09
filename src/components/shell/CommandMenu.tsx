"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type KnowledgeBaseOption = { id: string; name: string };

export function CommandMenu({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBaseOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(
    () =>
      knowledgeBases.filter((kb) => kb.name.toLowerCase().includes(query.trim().toLowerCase())),
    [knowledgeBases, query],
  );

  // Global ⌘K / Ctrl+K toggle — the one piece of this that can't live
  // inside the Dialog itself, since the menu isn't open yet when the user
  // presses the shortcut.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function select(kb: KnowledgeBaseOption) {
    handleOpenChange(false);
    router.push(`/app/knowledge-bases/${kb.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Switch knowledge base</DialogTitle>
        <Input
          autoFocus
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Jump to a knowledge base…"
          className="rounded-none border-0 border-b focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && filtered[activeIndex]) {
              select(filtered[activeIndex]);
            }
          }}
        />
        <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No knowledge bases match.
            </li>
          )}
          {filtered.map((kb, index) => (
            <li key={kb.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(kb)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                {kb.name}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type KnowledgeBaseOption = { id: string; name: string };

export function CommandMenu({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBaseOption[];
}) {
  const router = useRouter();
  const listId = useId();
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

  const activeOptionId = filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Switch knowledge base</DialogTitle>
        {/*
          A combobox that owns a listbox, rather than a bare input next to one.
          Selection is tracked with aria-activedescendant so focus stays in the
          input while the highlight moves — the pattern a screen reader expects
          from a command palette (docs/ux-principles.md Part IV, #5).
        */}
        <Input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-label="Jump to a knowledge base"
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
              event.preventDefault();
              select(filtered[activeIndex]);
            }
          }}
        />
        {/*
          role="listbox" must contain role="option" directly — the previous <ul>/<li>
          wrappers broke that required relationship. A plain div of option divs
          keeps the semantics valid; keyboard handling lives on the input above,
          so these need no tabindex of their own.
        */}
        <div id={listId} role="listbox" aria-label="Knowledge bases" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No knowledge bases match.
            </p>
          ) : (
            filtered.map((kb, index) => (
              <div
                key={kb.id}
                id={`${listId}-${kb.id}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(kb)}
                className={`cursor-pointer truncate rounded-md px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                {kb.name}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

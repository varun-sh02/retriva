"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { KnowledgeBaseSummary } from "@/lib/knowledge/list-knowledge-bases";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenameKnowledgeBaseDialog({
  knowledgeBase,
  open,
  onOpenChange,
}: {
  knowledgeBase: KnowledgeBaseSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(knowledgeBase.name);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error?.message ?? "Failed to rename knowledge base.");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setName(knowledgeBase.name);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename knowledge base</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`kb-rename-${knowledgeBase.id}`}>Name</Label>
            <Input
              id={`kb-rename-${knowledgeBase.id}`}
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || name.trim().length === 0}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

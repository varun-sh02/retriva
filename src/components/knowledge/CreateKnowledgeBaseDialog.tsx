"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultTrigger = (
  <Button variant="ghost" size="icon" className="size-6" aria-label="New knowledge base">
    <Plus className="size-4" />
  </Button>
);

export function CreateKnowledgeBaseDialog({ trigger }: { trigger?: ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error?.message ?? "Failed to create knowledge base.");
        return;
      }

      setOpen(false);
      setName("");
      setDescription("");
      router.refresh();
      router.push(`/app/knowledge-bases/${body.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New knowledge base</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-name">Name</Label>
            <Input
              id="kb-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-description">Description (optional)</Label>
            <Input
              id="kb-description"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || name.trim().length === 0}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

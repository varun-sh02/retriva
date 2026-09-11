"use client";

import { Check, Copy, Plus, RefreshCw, X } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_PROMPTS = 4;
const MAX_GREETING_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PROMPT_LENGTH = 100;

type ShareState = {
  enabled: boolean;
  shareToken: string | null;
  greeting: string | null;
  description: string | null;
  suggestedPrompts: string[];
  avatarUrl: string | null;
};

/**
 * Owner-side controls for the public widget: opt in, customize the intro
 * card visitors see first (avatar, greeting, description, suggested-prompt
 * chips), copy the snippet, and rotate the link if it leaks. Every field here
 * is read fresh by /embed/[token] on each widget open (src/lib/auth/public-
 * share.ts), so a change takes effect on the embedder's site with no
 * re-embed needed. Sharing is off until switched on — a knowledge base is
 * never public by default.
 */
export function ShareSettings({
  knowledgeBaseId,
  initial,
}: {
  knowledgeBaseId: string;
  initial: ShareState;
}) {
  const [state, setState] = useState<ShareState>(initial);
  const [greeting, setGreeting] = useState(initial.greeting ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [prompts, setPrompts] = useState<string[]>(initial.suggestedPrompts);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function update(next: {
    enabled: boolean;
    rotate?: boolean;
    greeting?: string | null;
    description?: string | null;
    suggestedPrompts?: string[];
  }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not update sharing.");
        return;
      }
      setState((prev) => ({
        ...prev,
        enabled: body.enabled,
        shareToken: body.shareToken,
        greeting: body.greeting,
        description: body.description,
        suggestedPrompts: body.suggestedPrompts ?? [],
      }));
    } finally {
      setBusy(false);
    }
  }

  function saveCustomization() {
    void update({
      enabled: state.enabled,
      greeting: greeting.trim() || null,
      description: description.trim() || null,
      suggestedPrompts: prompts.map((p) => p.trim()).filter((p) => p.length > 0),
    });
  }

  async function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/share/avatar`, {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not upload image.");
        return;
      }
      setState((prev) => ({ ...prev, avatarUrl: body.avatarUrl }));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/share/avatar`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not remove image.");
        return;
      }
      setState((prev) => ({ ...prev, avatarUrl: null }));
    } finally {
      setAvatarBusy(false);
    }
  }

  // Resolved in the browser so the snippet always names the origin the owner
  // is actually looking at, rather than a build-time guess that would be
  // wrong on every preview deployment.
  const snippet =
    state.shareToken && typeof window !== "undefined"
      ? `<script src="${window.location.origin}/widget.js" data-retriva-token="${state.shareToken}"></script>`
      : null;

  async function copy() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — select the snippet and copy it manually.");
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="public-share" className="text-sm font-medium">
            Embed on your site
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Anyone with the link can ask questions about this knowledge base. They cannot see your
            documents or upload anything.
          </p>
        </div>
        <Switch
          id="public-share"
          checked={state.enabled}
          disabled={busy}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {state.enabled && snippet && (
        <div className="flex flex-col gap-2">
          <pre className="overflow-x-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
            {snippet}
          </pre>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copy} disabled={busy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy snippet"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => update({ enabled: true, rotate: true })}
              title="Invalidates the current link and issues a new one"
            >
              <RefreshCw className="size-3.5" />
              Rotate link
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Widget intro card</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown to visitors before they reach chat. Changes apply immediately — no re-embedding
            needed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-14">
            {state.avatarUrl && <AvatarImage src={state.avatarUrl} alt="Widget avatar" />}
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={avatarBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {state.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {state.avatarUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={avatarBusy}
                onClick={handleAvatarRemove}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="public-greeting">Greeting</Label>
            <span className="text-xs text-muted-foreground">
              {greeting.length}/{MAX_GREETING_LENGTH}
            </span>
          </div>
          <Input
            id="public-greeting"
            placeholder="Hi, I'm Varun 👋"
            maxLength={MAX_GREETING_LENGTH}
            value={greeting}
            onChange={(event) => setGreeting(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="public-description">Description</Label>
            <span className="text-xs text-muted-foreground">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
          <Textarea
            id="public-description"
            placeholder="I'm a software engineer with 5 years of experience in..."
            rows={3}
            maxLength={MAX_DESCRIPTION_LENGTH}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Quick guides</Label>
          <p className="text-xs text-muted-foreground">
            Short prompts shown as buttons on the intro card — clicking one opens chat. Up to{" "}
            {MAX_PROMPTS}.
          </p>
          {prompts.map((prompt, index) => (
            <div key={index} className="flex gap-2">
              <Input
                maxLength={MAX_PROMPT_LENGTH}
                value={prompt}
                placeholder="If you're a recruiter, try pasting a job description"
                onChange={(event) =>
                  setPrompts((prev) => prev.map((p, i) => (i === index ? event.target.value : p)))
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove"
                onClick={() => setPrompts((prev) => prev.filter((_, i) => i !== index))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {prompts.length < MAX_PROMPTS && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit gap-1.5"
              onClick={() => setPrompts((prev) => [...prev, ""])}
            >
              <Plus className="size-3.5" />
              Add guide
            </Button>
          )}
        </div>

        <Button type="button" size="sm" disabled={busy} onClick={saveCustomization} className="w-fit">
          Save
        </Button>
      </div>
    </section>
  );
}

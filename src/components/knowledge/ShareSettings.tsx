"use client";

import { Check, Copy, Plus, RefreshCw, X } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  appOrigin,
  initial,
}: {
  knowledgeBaseId: string;
  /**
   * The origin this page was actually requested from, resolved server-side
   * (src/lib/config/app-url.ts). Passed in rather than read from
   * `window.location` so the snippet is right in the server-rendered HTML —
   * the previous `typeof window !== "undefined"` guard rendered nothing on
   * the server and only filled in after hydration — and right on a custom
   * domain, on *.vercel.app, and on every preview deployment, none of which a
   * build-time NEXT_PUBLIC_APP_URL can tell apart.
   */
  appOrigin: string;
  initial: ShareState;
}) {
  const [state, setState] = useState<ShareState>(initial);
  const [greeting, setGreeting] = useState(initial.greeting ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [prompts, setPrompts] = useState<string[]>(initial.suggestedPrompts);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [copied, setCopied] = useState<"snippet" | "link" | null>(null);
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

  const snippet = state.shareToken
    ? `<script src="${appOrigin}/widget.js" data-retriva-token="${state.shareToken}"></script>`
    : null;

  // The same chat as a plain page, for sharing in a message or a doc where a
  // script tag is no use.
  const shareLink = state.shareToken
    ? `${appOrigin}/embed/${encodeURIComponent(state.shareToken)}`
    : null;

  async function copyText(value: string, which: "snippet" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Copy failed — select the text and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                <Label htmlFor="public-share">Embed on your site</Label>
              </CardTitle>
              <CardDescription className="mt-1">
                Anyone with the link can ask questions about this knowledge base. They cannot see
                your documents or upload anything.
              </CardDescription>
            </div>
            <Switch
              id="public-share"
              checked={state.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => update({ enabled })}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {state.enabled && snippet && shareLink && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Direct link</Label>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded border bg-muted px-2 py-1.5 font-mono text-[11px]">
                    {shareLink}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void copyText(shareLink, "link")}
                  >
                    {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === "link" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <Label className="text-xs text-muted-foreground">Embed snippet</Label>
              <pre className="overflow-x-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
                {snippet}
              </pre>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyText(snippet, "snippet")}
                  disabled={busy}
                >
                  {copied === "snippet" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied === "snippet" ? "Copied" : "Copy snippet"}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Widget intro card</CardTitle>
          <CardDescription>
            Shown to visitors before they reach chat. Changes apply immediately — no re-embedding
            needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
}

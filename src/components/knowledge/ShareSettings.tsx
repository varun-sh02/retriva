"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ShareState = { enabled: boolean; shareToken: string | null };

/**
 * Owner-side controls for the public widget: opt in, copy the snippet, and
 * rotate the link if it leaks. Sharing is off until switched on here — a
 * knowledge base is never public by default.
 */
export function ShareSettings({
  knowledgeBaseId,
  initial,
}: {
  knowledgeBaseId: string;
  initial: ShareState;
}) {
  const [state, setState] = useState<ShareState>(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: { enabled: boolean; rotate?: boolean }) {
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
      setState({ enabled: body.enabled, shareToken: body.shareToken });
    } finally {
      setBusy(false);
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
    </section>
  );
}

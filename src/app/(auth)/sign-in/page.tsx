"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { clientEnv } from "@/lib/config/client-env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

type Status = "idle" | "sending" | "sent" | "error";

// Local-only bypass: NEXT_PUBLIC_DEV_AUTH_BYPASS is set in .env.local and is
// deliberately not set on Vercel, so production always uses the magic-link
// flow below and never this branch.
const DEV_AUTH_BYPASS = clientEnv.NEXT_PUBLIC_DEV_AUTH_BYPASS;

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createSupabaseBrowserClient();

    if (DEV_AUTH_BYPASS) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setStatus("error");
        setError(signInError.message);
        return;
      }

      router.push("/app");
      router.refresh();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo height={32} />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {DEV_AUTH_BYPASS
              ? "Local dev: sign in with email + password."
              : status === "sent"
                ? "Check your email for a sign-in link."
                : "Sign in with a magic link — no password needed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status !== "sent" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={status === "sending"}
                />
              </div>
              {DEV_AUTH_BYPASS && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={status === "sending"}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={status === "sending"}>
                {status === "sending"
                  ? "Signing in…"
                  : DEV_AUTH_BYPASS
                    ? "Sign in"
                    : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

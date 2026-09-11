import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PublicChat } from "@/components/chat/PublicChat";
import { ApiError } from "@/lib/http/api-error";
import { resolvePublicShare } from "@/lib/auth/public-share";

export const dynamic = "force-dynamic";

/**
 * React.cache dedupes the lookup across generateMetadata and the page body,
 * which both need the share — two renders of the same request, one query.
 */
const loadShare = cache(resolvePublicShare);

/**
 * This page is both the widget's iframe target and a link the owner can send
 * to someone directly, so it gets a real title rather than the app's generic
 * one. Still never indexable: a share link is unguessable and should stay
 * that way.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const robots = { index: false, follow: false };

  try {
    const share = await loadShare(token);
    return {
      title: share.name,
      description: share.description ?? `Ask questions about ${share.name}.`,
      robots,
    };
  } catch {
    // A disabled or unknown token must not be distinguishable from the title
    // either — the page below renders the ordinary 404.
    return { title: "Retriva", robots };
  }
}

/**
 * The page the widget iframe loads. It lives on Retriva's own origin, which
 * is what lets the chat request below be a same-origin fetch — no CORS
 * surface, and no cross-origin credentials to reason about.
 */
export default async function EmbedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let share;
  try {
    share = await loadShare(token);
  } catch (error) {
    // A disabled or unknown token renders the ordinary 404 — never a message
    // that would distinguish "no such link" from "link turned off".
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <PublicChat
      shareToken={token}
      name={share.name}
      greeting={share.greeting}
      description={share.description}
      avatarUrl={share.avatarUrl}
      suggestedPrompts={share.suggestedPrompts}
    />
  );
}

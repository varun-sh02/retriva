import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicChat } from "@/components/chat/PublicChat";
import { ApiError } from "@/lib/http/api-error";
import { resolvePublicShare } from "@/lib/auth/public-share";

export const dynamic = "force-dynamic";

/** Not indexable: a share link is unguessable, and should stay that way. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The page the widget iframe loads. It lives on Retriva's own origin, which
 * is what lets the chat request below be a same-origin fetch — no CORS
 * surface, and no cross-origin credentials to reason about.
 */
export default async function EmbedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let share;
  try {
    share = await resolvePublicShare(token);
  } catch (error) {
    // A disabled or unknown token renders the ordinary 404 — never a message
    // that would distinguish "no such link" from "link turned off".
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return <PublicChat shareToken={token} name={share.name} greeting={share.greeting} />;
}

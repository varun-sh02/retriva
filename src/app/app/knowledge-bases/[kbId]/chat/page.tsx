import { redirect } from "next/navigation";

/**
 * Ask moved to the knowledge base root (docs/ux-principles.md Part II). This
 * redirect keeps existing links and bookmarks working; /chat/new and
 * /chat/[conversationId] are unaffected and remain the real chat routes.
 */
export default async function LegacyChatPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  redirect(`/app/knowledge-bases/${kbId}`);
}

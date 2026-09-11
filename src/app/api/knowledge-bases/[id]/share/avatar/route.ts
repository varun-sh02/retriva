import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { badRequest, payloadTooLarge, unsupportedMediaType } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { detectMimeType } from "@/lib/storage/mime";
import { buildAvatarStoragePath } from "@/lib/storage/paths";

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

/** Widget-facing avatar shown on the public chat's intro card (PublicChat). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();
    const { id } = await context.params;
    await requireKnowledgeBase(supabase, workspaceId, id);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw badRequest("Missing file");
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw payloadTooLarge("Images must be 2 MB or smaller.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await detectMimeType(buffer, file.type);
    if (!detected.ok || detected.contentType !== "image") {
      throw unsupportedMediaType("Please upload a PNG, JPEG, or WebP image.");
    }

    const { data: current, error: readError } = await supabase
      .from("knowledge_bases")
      .select("public_avatar_path")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();
    if (readError) throw readError;

    const path = buildAvatarStoragePath({ workspaceId, knowledgeBaseId: id });

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: detected.mimeType });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("knowledge_bases")
      .update({ public_avatar_path: path })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (updateError) throw updateError;

    const previousPath = current.public_avatar_path as string | null;
    if (previousPath) {
      // Best-effort: a leftover orphaned object costs storage, not
      // correctness — the KB row already points at the new one.
      await supabase.storage.from("avatars").remove([previousPath]);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    return Response.json({ avatarUrl: publicUrl });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();
    const { id } = await context.params;
    await requireKnowledgeBase(supabase, workspaceId, id);

    const { data: current, error: readError } = await supabase
      .from("knowledge_bases")
      .select("public_avatar_path")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();
    if (readError) throw readError;

    const { error: updateError } = await supabase
      .from("knowledge_bases")
      .update({ public_avatar_path: null })
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    if (updateError) throw updateError;

    const previousPath = current.public_avatar_path as string | null;
    if (previousPath) {
      await supabase.storage.from("avatars").remove([previousPath]);
    }

    return Response.json({ avatarUrl: null });
  });
}

import "server-only";

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Builds the storage object path from server-resolved IDs only — the
 * original filename is display metadata and never appears in a path
 * (docs/security.md T4: no path traversal via a client-supplied filename).
 * Matches the storage.foldername(name) segment order the RLS policies in
 * supabase/migrations/0005_storage.sql expect: [1]=ws, [2]=workspace_id,
 * [3]=kb, [4]=knowledge_base_id, [5]=document_id.
 */
export function buildOriginalStoragePath(params: {
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string;
  mimeType: string;
}): string {
  const extension = EXTENSION_BY_MIME[params.mimeType];
  if (!extension) {
    throw new Error(`No extension mapping for mime type "${params.mimeType}"`);
  }

  return `ws/${params.workspaceId}/kb/${params.knowledgeBaseId}/${params.documentId}/original.${extension}`;
}

/**
 * One path per upload (not a fixed "avatar" name) so a re-upload never
 * fights the previous object's cached response at the same public URL — the
 * caller deletes the old object after the new one is written. Matches the
 * same [2]=workspace_id segment convention the "avatars" bucket RLS policies
 * (0012_widget_customization.sql) expect.
 */
export function buildAvatarStoragePath(params: {
  workspaceId: string;
  knowledgeBaseId: string;
}): string {
  return `ws/${params.workspaceId}/kb/${params.knowledgeBaseId}/avatar-${crypto.randomUUID()}`;
}

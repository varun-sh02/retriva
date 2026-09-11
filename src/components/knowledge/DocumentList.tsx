import type { DocumentSummary } from "@/lib/documents/list-documents";
import { DocumentRow } from "./DocumentRow";

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    // Teaches rather than reports (docs/ux-principles.md §5): what this is,
    // why it matters, what to do — and the "what to do" is the dropzone
    // directly above, so this state points at it instead of repeating a CTA.
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
        <h2 className="font-medium">Nothing here yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add documents, images, or recordings above and Retriva will make them answerable — with
          every answer pointing back to where it came from.
        </p>
      </div>
    );
  }

  return (
    <ul className="rounded-lg border">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} document={doc} />
      ))}
    </ul>
  );
}

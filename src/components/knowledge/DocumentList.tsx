import type { DocumentSummary } from "@/lib/documents/list-documents";
import { DocumentRow } from "./DocumentRow";

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <ul className="rounded-lg border">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} document={doc} />
      ))}
    </ul>
  );
}

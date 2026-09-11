import { FileText } from "lucide-react";
import type { DocumentSummary } from "@/lib/documents/list-documents";
import { EmptyState } from "@/components/shell/EmptyState";
import { DocumentRow } from "./DocumentRow";

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Drag a file into the dropzone above to start building this knowledge base."
      />
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

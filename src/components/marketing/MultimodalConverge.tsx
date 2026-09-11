import { ArrowDown, FileText, Image as ImageIcon, Video } from "lucide-react";
import type { ComponentType } from "react";
import { LogoMark } from "@/components/brand/Logo";

const KINDS: { label: string; detail: string; icon: ComponentType<{ className?: string }> }[] = [
  { label: "Documents", detail: "PDF, DOCX, TXT, Markdown", icon: FileText },
  { label: "Images", detail: "Diagrams, screenshots, photos", icon: ImageIcon },
  { label: "Recordings", detail: "Meetings, reviews, calls", icon: Video },
];

/**
 * Four kinds converging into one answer. The convergence is the argument —
 * a format checklist would say the same words and make the opposite point.
 */
export function MultimodalConverge() {
  return (
    <div className="flex flex-col items-center gap-4">
      <ul className="grid w-full gap-3 sm:grid-cols-3">
        {KINDS.map(({ label, detail, icon: Icon }) => (
          <li key={label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <Icon className="size-4 text-brand-text" aria-hidden="true" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
          </li>
        ))}
      </ul>

      <ArrowDown className="size-4 text-muted-foreground" aria-hidden="true" />

      <div className="flex items-center gap-2 rounded-xl border bg-tint px-4 py-3">
        <LogoMark size={18} />
        <span className="text-sm font-medium text-tint-foreground">One answer, one set of evidence</span>
      </div>
    </div>
  );
}

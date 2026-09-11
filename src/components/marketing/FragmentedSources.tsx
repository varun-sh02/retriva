import { FileText, Image as ImageIcon, Video } from "lucide-react";
import type { ComponentType } from "react";

const SOURCES: { name: string; icon: ComponentType<{ className?: string }>; tilt: string }[] = [
  { name: "Requirements.pdf", icon: FileText, tilt: "-rotate-2" },
  { name: "Architecture-v1.pdf", icon: FileText, tilt: "rotate-1" },
  { name: "Architecture-final.pdf", icon: FileText, tilt: "-rotate-1" },
  { name: "Architecture-diagram.png", icon: ImageIcon, tilt: "rotate-2" },
  { name: "Team-meeting.mp4", icon: Video, tilt: "-rotate-1" },
  { name: "Product-notes.md", icon: FileText, tilt: "rotate-1" },
];

/**
 * The problem, shown rather than described: six real objects, scattered.
 * The slight rotations are the whole idea — these are things that were filed
 * separately by separate people at separate times, and nothing connects them.
 */
export function FragmentedSources() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-3">
      {SOURCES.map(({ name, icon: Icon, tilt }) => (
        <li
          key={name}
          className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm ${tilt}`}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono text-xs">{name}</span>
        </li>
      ))}
    </ul>
  );
}

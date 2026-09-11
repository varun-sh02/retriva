/**
 * Shared formatting for evidence coordinates — the page numbers, timestamps
 * and source names that appear on citation badges, evidence chips and the
 * evidence panel. One implementation so the same chunk never renders as
 * "23:41" in one place and "0:23:41" in another (docs/product-language.md §6).
 */

export type SourceKind = "document" | "image" | "recording";

/**
 * Maps a chunk's content_type (src/lib/storage/mime.ts ContentType) to the
 * three user-facing kinds. A PDF/DOCX/TXT/MD are all "document" to a reader —
 * the distinction that matters is document vs image vs recording
 * (docs/product-language.md §1).
 */
export function sourceKind(contentType: string): SourceKind {
  if (contentType === "image") return "image";
  if (contentType === "video") return "recording";
  return "document";
}

/** m:ss under an hour, h:mm:ss above it (docs/product-language.md §6). */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
  return `${h > 0 ? `${h}:` : ""}${mm}:${s.toString().padStart(2, "0")}`;
}

/** En dash, no spaces — "23:41–24:15". */
export function formatTimeRange(start: number, end: number | null): string {
  return end === null || end <= start
    ? formatTimestamp(start)
    : `${formatTimestamp(start)}–${formatTimestamp(end)}`;
}

/**
 * The compact coordinate shown on a chip: "p. 12", "23:41", or a section
 * heading for text sources that have one. Null when the source has no
 * meaningful location (a short text file is its own location).
 */
export function shortCoordinate(location: {
  pageNumber: number | null;
  startTimestamp: number | null;
  sectionPath?: string | null;
}): string | null {
  if (location.pageNumber !== null) return `p. ${location.pageNumber}`;
  if (location.startTimestamp !== null) return formatTimestamp(location.startTimestamp);
  if (location.sectionPath) return location.sectionPath;
  return null;
}

/** The fuller form used in the evidence panel header. */
export function longCoordinate(location: {
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  sectionPath?: string | null;
}): string | null {
  if (location.pageNumber !== null) return `Page ${location.pageNumber}`;
  if (location.startTimestamp !== null)
    return formatTimeRange(location.startTimestamp, location.endTimestamp);
  if (location.sectionPath) return location.sectionPath;
  return null;
}

/**
 * Truncates from the middle so the extension and the tail survive —
 * "Architecture-v1-final.pdf" and "Architecture-v2-final.pdf" stay
 * distinguishable, which a trailing ellipsis would destroy.
 */
export function truncateMiddle(name: string, max = 34): string {
  if (name.length <= max) return name;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${name.slice(0, head)}…${name.slice(name.length - tail)}`;
}

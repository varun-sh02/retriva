import "server-only";
import type { RawVideoSegment } from "./video";

export type ValidatedSegment = {
  startSeconds: number;
  endSeconds: number;
  title: string | null;
  transcript: string;
  visualContext: string | null;
};

const MAX_GAP_SECONDS = 5;
const MAX_INVALID_FRACTION = 0.3;

/**
 * Bounds every segment against the container's real duration (never the
 * model's claim), sorts by start, trims overlaps, and drops — never
 * repairs — anything invalid (docs/multimodal-ingestion.md §5). A citation
 * that plays from the wrong moment destroys trust in every other citation
 * on screen, so a clamp-and-keep "fix" is explicitly not an option here.
 */
export function validateSegments(
  segments: RawVideoSegment[],
  durationSeconds: number,
): { valid: ValidatedSegment[]; droppedCount: number; failed: boolean } {
  const candidates = segments
    .map((s) => ({
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      title: s.title ?? null,
      transcript: s.transcript ?? "",
      visualContext: s.visualContext ?? null,
    }))
    .filter(
      (s): s is ValidatedSegment =>
        typeof s.startSeconds === "number" &&
        typeof s.endSeconds === "number" &&
        s.startSeconds >= 0 &&
        s.endSeconds > s.startSeconds &&
        s.endSeconds <= durationSeconds &&
        s.transcript.trim().length > 0,
    )
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const droppedCount = segments.length - candidates.length;

  // Trim overlaps: a later segment's start is pushed to the previous
  // segment's end rather than dropping it outright, since the content
  // itself (transcript) is still valid evidence — only the exact boundary
  // was imprecise.
  const trimmed: ValidatedSegment[] = [];
  for (const segment of candidates) {
    const previous = trimmed[trimmed.length - 1];
    if (previous && segment.startSeconds < previous.endSeconds) {
      const adjustedStart = previous.endSeconds;
      if (adjustedStart >= segment.endSeconds) {
        // Fully swallowed by the previous segment — drop, don't keep a
        // zero/negative-length segment.
        continue;
      }
      trimmed.push({ ...segment, startSeconds: adjustedStart });
    } else {
      trimmed.push(segment);
    }
  }

  const totalFraction = segments.length === 0 ? 0 : droppedCount / segments.length;
  const failed = totalFraction > MAX_INVALID_FRACTION;

  return { valid: trimmed, droppedCount, failed };
}

/** For observability only — logged, not enforced as a hard failure. */
export function findGaps(segments: ValidatedSegment[]): { afterIndex: number; gapSeconds: number }[] {
  const gaps: { afterIndex: number; gapSeconds: number }[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = segments[i + 1]!.startSeconds - segments[i]!.endSeconds;
    if (gap > MAX_GAP_SECONDS) {
      gaps.push({ afterIndex: i, gapSeconds: gap });
    }
  }
  return gaps;
}

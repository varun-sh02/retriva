import "server-only";

/**
 * Reads real video duration from the container's `moov/mvhd` box — no
 * ffmpeg (explicitly out of scope, docs/technical-decisions.md ADR-015).
 * MP4 and QuickTime/.mov share the same ISO base media box structure, so
 * one parser covers both accepted video MIME types. Timestamp validation
 * (docs/multimodal-ingestion.md §5) depends on this being the real
 * container duration, not a value the model claims.
 */
export function getVideoDurationSeconds(buffer: Buffer): number {
  const mvhd = findBox(buffer, 0, buffer.length, ["moov", "mvhd"]);
  if (!mvhd) {
    throw new Error("Could not find an mvhd box — is this a valid MP4/MOV file?");
  }

  const version = mvhd.readUInt8(0);

  if (version === 1) {
    // version(1) + flags(3) + creation(8) + modification(8) = offset 20
    const timescale = mvhd.readUInt32BE(20);
    const duration = mvhd.readBigUInt64BE(24);
    return Number(duration) / timescale;
  }

  // version(1) + flags(3) + creation(4) + modification(4) = offset 12
  const timescale = mvhd.readUInt32BE(12);
  const duration = mvhd.readUInt32BE(16);
  return duration / timescale;
}

/** Walks nested ISO base media boxes to find e.g. ["moov", "mvhd"], returning that box's payload. */
function findBox(buffer: Buffer, start: number, end: number, path: string[]): Buffer | null {
  let offset = start;

  while (offset < end - 8) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);

    // A size of 0 means "extends to end of file" (rare, but real);
    // a size of 1 means a 64-bit size follows at offset+8.
    let boxSize = size;
    let payloadStart = offset + 8;
    if (size === 1) {
      boxSize = Number(buffer.readBigUInt64BE(offset + 8));
      payloadStart = offset + 16;
    } else if (size === 0) {
      boxSize = end - offset;
    }

    if (boxSize < 8 || offset + boxSize > end) break;

    if (type === path[0]) {
      if (path.length === 1) {
        return buffer.subarray(payloadStart, offset + boxSize);
      }
      const nested = findBox(buffer, payloadStart, offset + boxSize, path.slice(1));
      if (nested) return nested;
    }

    offset += boxSize;
  }

  return null;
}

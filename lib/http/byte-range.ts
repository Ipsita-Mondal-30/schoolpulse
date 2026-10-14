/**
 * Single-range HTTP Range parsing for media playback (seeking, iOS Safari).
 * Open-ended ranges are capped so each partial response stays small.
 */

export const MAX_OPEN_RANGE_BYTES = 4 * 1024 * 1024;

export type ByteRange = { start: number; end: number };

/**
 * Returns the inclusive byte range to serve, `null` when no/ignorable Range header
 * (serve the full body), or `'unsatisfiable'` for a 416 response.
 */
export function parseByteRange(
  header: string | null | undefined,
  size: number,
  maxOpenRange = MAX_OPEN_RANGE_BYTES,
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;
  const m = header.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (!rawStart && !rawEnd) return null;
  if (size <= 0) return 'unsatisfiable';

  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (suffix <= 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  if (start >= size) return 'unsatisfiable';
  const requestedEnd = rawEnd ? Number(rawEnd) : start + maxOpenRange - 1;
  if (rawEnd && requestedEnd < start) return 'unsatisfiable';
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export function chunkedStream(bytes: Uint8Array, chunkSize = 256 * 1024): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
      }
      controller.close();
    },
  });
}

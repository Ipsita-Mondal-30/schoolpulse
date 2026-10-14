import { describe, expect, it } from 'vitest';
import {
  MAX_VIDEO_ATTEMPTS,
  STALE_VIDEO_JOB_MS,
  VIDEO_STATUS,
  shouldProcessVideoInline,
  stuckVideoAction,
  videoAttemptsExhausted,
} from '@/lib/ai/homework-video';
import { chunkedStream, MAX_OPEN_RANGE_BYTES, parseByteRange } from '@/lib/http/byte-range';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const now = new Date('2026-10-14T10:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('stuck video job recovery', () => {
  it('leaves fresh in-flight jobs alone', () => {
    expect(
      stuckVideoAction({ status: VIDEO_STATUS.GENERATING, updatedAt: ago(5 * 60_000), attempts: 1 }, now),
    ).toBeNull();
  });

  it('re-queues stale PLANNING/GENERATING jobs with attempts left', () => {
    for (const status of [VIDEO_STATUS.PLANNING, VIDEO_STATUS.GENERATING]) {
      expect(stuckVideoAction({ status, updatedAt: ago(STALE_VIDEO_JOB_MS + 1), attempts: 1 }, now)).toBe(
        'requeue',
      );
    }
  });

  it('fails stale jobs that used every attempt', () => {
    expect(
      stuckVideoAction(
        { status: VIDEO_STATUS.GENERATING, updatedAt: ago(STALE_VIDEO_JOB_MS + 1), attempts: MAX_VIDEO_ATTEMPTS },
        now,
      ),
    ).toBe('fail');
  });

  it('ignores queued, ready and failed jobs', () => {
    for (const status of [VIDEO_STATUS.QUEUED, VIDEO_STATUS.READY, VIDEO_STATUS.FAILED]) {
      expect(stuckVideoAction({ status, updatedAt: ago(STALE_VIDEO_JOB_MS * 4), attempts: 0 }, now)).toBeNull();
    }
  });

  it('marks FAILED jobs terminal only once attempts are exhausted', () => {
    expect(videoAttemptsExhausted({ status: VIDEO_STATUS.FAILED, attempts: MAX_VIDEO_ATTEMPTS })).toBe(true);
    expect(videoAttemptsExhausted({ status: VIDEO_STATUS.FAILED, attempts: 1 })).toBe(false);
    expect(videoAttemptsExhausted({ status: VIDEO_STATUS.QUEUED, attempts: MAX_VIDEO_ATTEMPTS })).toBe(false);
  });
});

describe('inline video processing', () => {
  it('is off on Vercel unless forced, on elsewhere unless disabled', () => {
    expect(shouldProcessVideoInline({ VERCEL: '1' })).toBe(false);
    expect(shouldProcessVideoInline({ VERCEL: '1', VIDEO_PROCESS_INLINE: 'true' })).toBe(true);
    expect(shouldProcessVideoInline({})).toBe(true);
    expect(shouldProcessVideoInline({ VIDEO_PROCESS_INLINE: 'false' })).toBe(false);
  });

  it('sync worker drains the video queue after the sync', () => {
    const src = readFileSync(join(process.cwd(), 'scripts/sync-neverskip-browser.ts'), 'utf8');
    expect(src).toMatch(/processQueuedHomeworkVideos/);
    expect(src).toMatch(/NEVERSKIP_VIDEO_JOBS_PER_RUN/);
  });
});

describe('HTTP byte ranges', () => {
  const size = 10_000_000;

  it('serves the full body without a Range header', () => {
    expect(parseByteRange(null, size)).toBeNull();
    expect(parseByteRange('items=0-1', size)).toBeNull();
  });

  it('parses closed, open-ended and suffix ranges', () => {
    expect(parseByteRange('bytes=0-1', size)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange('bytes=100-', size)).toEqual({ start: 100, end: 100 + MAX_OPEN_RANGE_BYTES - 1 });
    expect(parseByteRange('bytes=-500', size)).toEqual({ start: size - 500, end: size - 1 });
    expect(parseByteRange('bytes=9999000-99999999', size)).toEqual({ start: 9_999_000, end: size - 1 });
  });

  it('rejects unsatisfiable ranges', () => {
    expect(parseByteRange(`bytes=${size}-`, size)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=50-10', size)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', size)).toBe('unsatisfiable');
  });

  it('streams bytes in chunks without loss', async () => {
    const bytes = new Uint8Array(700_000).map((_, i) => i % 251);
    const reader = chunkedStream(bytes, 256 * 1024).getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    expect(parts).toHaveLength(3);
    expect(Buffer.concat(parts).equals(Buffer.from(bytes))).toBe(true);
  });
});

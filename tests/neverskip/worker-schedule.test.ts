import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SYNC_INTERVAL_HOURS,
  FOUR_HOURS_MS,
  formatIntervalForLog,
  resolveSyncIntervalMs,
  WORKER_EXIT_SESSION_EXPIRED,
} from '@/lib/neverskip/worker-schedule';
import fs from 'fs';
import path from 'path';

describe('NeverSkip worker schedule', () => {
  it('defaults to a 4-hour interval outside Vercel', () => {
    expect(DEFAULT_SYNC_INTERVAL_HOURS).toBe(4);
    expect(FOUR_HOURS_MS).toBe(4 * 60 * 60 * 1000);
    expect(resolveSyncIntervalMs({})).toBe(FOUR_HOURS_MS);
  });

  it('reads NEVERSKIP_SYNC_INTERVAL_HOURS', () => {
    expect(resolveSyncIntervalMs({ NEVERSKIP_SYNC_INTERVAL_HOURS: '4' })).toBe(
      FOUR_HOURS_MS,
    );
    expect(resolveSyncIntervalMs({ NEVERSKIP_SYNC_INTERVAL_HOURS: '2' })).toBe(
      2 * 60 * 60 * 1000,
    );
  });

  it('prefers NEVERSKIP_SYNC_INTERVAL_MS over hours', () => {
    expect(
      resolveSyncIntervalMs({
        NEVERSKIP_SYNC_INTERVAL_MS: '60000',
        NEVERSKIP_SYNC_INTERVAL_HOURS: '4',
      }),
    ).toBe(60_000);
  });

  it('rejects non-positive interval values', () => {
    expect(() => resolveSyncIntervalMs({ NEVERSKIP_SYNC_INTERVAL_MS: '0' })).toThrow(
      /positive/,
    );
    expect(() =>
      resolveSyncIntervalMs({ NEVERSKIP_SYNC_INTERVAL_HOURS: '-1' }),
    ).toThrow(/positive/);
  });

  it('formats intervals for operator logs', () => {
    expect(formatIntervalForLog(FOUR_HOURS_MS)).toBe(`4h (${FOUR_HOURS_MS}ms)`);
  });

  it('uses a distinct exit code for session expiry', () => {
    expect(WORKER_EXIT_SESSION_EXPIRED).toBe(2);
  });
});

describe('Vercel Hobby cron removal', () => {
  it('does not ship vercel.json (Hobby rejects sub-daily crons)', () => {
    const vercelJson = path.join(process.cwd(), 'vercel.json');
    expect(fs.existsSync(vercelJson)).toBe(false);
  });
});

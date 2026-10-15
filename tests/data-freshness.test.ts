import { describe, expect, it } from 'vitest';
import {
  buildDataFreshness,
  dataFreshnessMessage,
  isDataFreshnessWarning,
} from '@/lib/data-freshness';

const NOW = new Date('2026-10-15T02:30:00.000Z'); // 08:00 IST 15 Oct

describe('buildDataFreshness', () => {
  it('reports auth_expired with the last data date when the newest run needed login (Oct 2026 state)', () => {
    const f = buildDataFreshness(
      [
        { status: 'AUTHENTICATION_REQUIRED', finishedAt: '2026-10-15T00:00:10.000Z' },
        { status: 'PARTIAL', finishedAt: '2026-10-03T10:22:00.000Z' },
      ],
      NOW,
    );
    expect(f).toEqual({ state: 'auth_expired', lastDataAt: '2026-10-03T10:22:00.000Z' });
    expect(isDataFreshnessWarning(f)).toBe(true);
    expect(dataFreshnessMessage(f)?.title).toBe('School data last updated 3 Oct');
    expect(dataFreshnessMessage(f)?.description).toMatch(/login has expired/);
  });

  it('is fresh when data was written within 12 hours, even if a later run failed for other reasons', () => {
    const f = buildDataFreshness(
      [
        { status: 'FAILED', finishedAt: '2026-10-15T02:00:00.000Z' },
        { status: 'COMPLETE', finishedAt: '2026-10-14T22:00:00.000Z' },
      ],
      NOW,
    );
    expect(f.state).toBe('fresh');
    expect(dataFreshnessMessage(f)).toBeNull();
  });

  it('is stale when the last data write is older than 12 hours', () => {
    const f = buildDataFreshness([{ status: 'COMPLETE', finishedAt: '2026-10-14T10:00:00.000Z' }], NOW);
    expect(f.state).toBe('stale');
    expect(dataFreshnessMessage(f)?.description).toMatch(/not received new data/);
  });

  it('is never_synced with no runs or no data-writing run', () => {
    expect(buildDataFreshness([], NOW).state).toBe('never_synced');
    expect(buildDataFreshness([{ status: 'FAILED', finishedAt: '2026-10-15T00:00:00.000Z' }], NOW).state).toBe(
      'never_synced',
    );
  });

  it('does not warn for unknown (DB unavailable)', () => {
    expect(isDataFreshnessWarning({ state: 'unknown', lastDataAt: null })).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidate = vi.fn(async () => ({ redisConfigured: false, deleted: 0, version: 'v' }));
vi.mock('@/lib/cache/schoolpulse', () => ({ invalidateSchoolPulseCaches: invalidate }));

import { syncNeverSkipData } from '@/lib/neverskip/sync';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { exitCodeForSyncStatus } from '@/lib/neverskip/sync-health';
import { recordAuthenticationFailure } from '@/lib/neverskip/auth-failure';

function silence() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('sync status → cache invalidation + exit codes', () => {
  beforeEach(() => {
    invalidate.mockClear();
    silence();
  });

  it('FAILED sync does not invalidate caches and exits 1', async () => {
    const store = new InMemoryNeverSkipStore();
    const summary = await syncNeverSkipData({
      homework: [],
      notices: [],
      store,
      homeworkFetchErrors: ['homework endpoint returned 500'],
    });
    expect(summary.syncStatus).toBe('FAILED');
    expect(invalidate).not.toHaveBeenCalled();
    expect(exitCodeForSyncStatus(summary.syncStatus!)).toBe(1);
  });

  it('PARTIAL sync invalidates caches, records auth + db status, exits 2', async () => {
    const store = new InMemoryNeverSkipStore();
    const summary = await syncNeverSkipData({
      homework: [],
      notices: [],
      store,
      noticePage0Only: true,
      extraReport: { plannerStatus: 'UNCHANGED' },
    });
    expect(summary.syncStatus).toBe('PARTIAL');
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(exitCodeForSyncStatus(summary.syncStatus!)).toBe(2);
    const report = JSON.parse(String(store.getSyncRuns()[0].reportJson));
    expect(report.authenticationStatus).toBe('AUTHENTICATED');
    expect(report.databaseWriteStatus).toBe('OK');
    expect(report.plannerStatus).toBe('UNCHANGED');
  });

  it('auth expiry records AUTHENTICATION_REQUIRED, touches no data or cache, exits 3', async () => {
    const store = new InMemoryNeverSkipStore();
    const code = await recordAuthenticationFailure(store, {
      startedAt: new Date(),
      message: 'NeverSkip session expired',
      lastLoginAt: '2026-10-01T00:00:00Z',
    });
    expect(code).toBe(3);
    const runs = store.getSyncRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('AUTHENTICATION_REQUIRED');
    expect(JSON.parse(String(runs[0].reportJson)).authenticationStatus).toBe('SESSION_EXPIRED');
    expect(await store.listHomework()).toHaveLength(0);
    expect(await store.listNotices()).toHaveLength(0);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('missing profile is AUTHENTICATION_REQUIRED; DB failure exits 1', async () => {
    const store = new InMemoryNeverSkipStore();
    await recordAuthenticationFailure(store, {
      startedAt: new Date(),
      message: 'NeverSkip session profile missing',
      lastLoginAt: null,
    });
    expect(JSON.parse(String(store.getSyncRuns()[0].reportJson)).authenticationStatus).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    const broken = { recordSyncRun: async () => { throw new Error('db down'); } };
    expect(await recordAuthenticationFailure(broken, { startedAt: new Date(), message: 'x', lastLoginAt: null })).toBe(1);
  });

  it('flags syncRunRecordFailed when the SyncRun write throws (worker exits 1)', async () => {
    const store = new InMemoryNeverSkipStore();
    store.recordSyncRun = async () => {
      throw new Error('db down');
    };
    const summary = await syncNeverSkipData({ homework: [], notices: [], store });
    expect(summary.syncRunRecordFailed).toBe(true);
  });
});

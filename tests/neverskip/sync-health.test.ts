import { describe, expect, it } from 'vitest';
import {
  buildSyncHealth,
  exitCodeForSyncStatus,
  mapSyncStatus,
  type SyncRunRow,
} from '@/lib/neverskip/sync-health';

const NOW = new Date('2026-10-03T12:00:00Z');

function run(status: string, hoursAgo: number, report: Record<string, unknown> = {}, error = ''): SyncRunRow {
  const finishedAt = new Date(NOW.getTime() - hoursAgo * 3600_000);
  return {
    status,
    startedAt: new Date(finishedAt.getTime() - 60_000),
    finishedAt,
    homeworkExpected: null,
    homeworkFetched: null,
    noticeFetched: null,
    jolFetched: null,
    errorSummary: error || null,
    reportJson: JSON.stringify({ syncStatus: status, ...report }),
  };
}

describe('sync health status mapping', () => {
  it('maps stored statuses to health statuses', () => {
    expect(mapSyncStatus(run('COMPLETE', 1))).toBe('SYNC_SUCCESS');
    expect(mapSyncStatus(run('PARTIAL', 1))).toBe('SYNC_PARTIAL');
    expect(mapSyncStatus(run('FAILED', 1))).toBe('SYNC_FAILED');
    expect(mapSyncStatus(run('INCOMPLETE', 1))).toBe('SYNC_FAILED');
    expect(
      mapSyncStatus(run('AUTHENTICATION_REQUIRED', 1, { authenticationStatus: 'SESSION_EXPIRED' })),
    ).toBe('SESSION_EXPIRED');
    expect(
      mapSyncStatus(run('AUTHENTICATION_REQUIRED', 1, { authenticationStatus: 'AUTHENTICATION_REQUIRED' })),
    ).toBe('AUTHENTICATION_REQUIRED');
    expect(mapSyncStatus(null)).toBe('NEVER_RUN');
  });

  it('uses exit codes 0/2/1/3', () => {
    expect(exitCodeForSyncStatus('COMPLETE')).toBe(0);
    expect(exitCodeForSyncStatus('PARTIAL')).toBe(2);
    expect(exitCodeForSyncStatus('FAILED')).toBe(1);
    expect(exitCodeForSyncStatus('INCOMPLETE')).toBe(1);
    expect(exitCodeForSyncStatus('AUTHENTICATION_REQUIRED')).toBe(3);
  });
});

describe('buildSyncHealth', () => {
  it('counts only COMPLETE as success; PARTIAL is a data write', () => {
    const h = buildSyncHealth([run('PARTIAL', 1), run('COMPLETE', 10)], NOW);
    expect(h.lastSuccessAt).toBe(run('COMPLETE', 10).finishedAt.toISOString());
    expect(h.lastDataWriteAt).toBe(run('PARTIAL', 1).finishedAt.toISOString());
    expect(h.issues).toContain('STALE_6H');
    expect(h.healthy).toBe(false);
  });

  it('flags auth expiry, failure fields and repeated failures', () => {
    const h = buildSyncHealth(
      [
        run('AUTHENTICATION_REQUIRED', 1, { authenticationStatus: 'SESSION_EXPIRED' }, 'NeverSkip session expired'),
        run('AUTHENTICATION_REQUIRED', 5, { authenticationStatus: 'SESSION_EXPIRED' }),
        run('COMPLETE', 9),
      ],
      NOW,
    );
    expect(h.status).toBe('SESSION_EXPIRED');
    expect(h.authStatus).toBe('SESSION_EXPIRED');
    expect(h.lastFailureAt).toBe(run('AUTHENTICATION_REQUIRED', 1).finishedAt.toISOString());
    expect(h.failureReason).toBe('NeverSkip session expired');
    expect(h.issues).toEqual(expect.arrayContaining(['AUTH_EXPIRED', 'STALE_6H', 'REPEATED_FAILURE']));
  });

  it('surfaces PAGE0_ONLY notices and PARTIAL homework as incomplete critical data', () => {
    const h = buildSyncHealth(
      [
        run('PARTIAL', 1, {
          homeworkSourceTotal: 137,
          sources: {
            homework: { status: 'PARTIAL', fetched: 133 },
            notices: { status: 'PAGE0_ONLY', fetched: 10 },
            jol: { status: 'COMPLETE', fetched: 137 },
          },
        }),
        run('COMPLETE', 2),
      ],
      NOW,
    );
    expect(h.homework?.status).toBe('PARTIAL');
    expect(h.homework?.sourceCount).toBe(137);
    expect(h.homework?.uniqueCount).toBe(133);
    expect(h.notices?.status).toBe('PAGE0_ONLY');
    expect(h.issues).toEqual(['INCOMPLETE_CRITICAL']);
  });

  it('flags failed planner extraction', () => {
    const h = buildSyncHealth([run('COMPLETE', 1, { plannerStatus: 'FAILED' })], NOW);
    expect(h.plannerStatus).toBe('FAILED');
    expect(h.issues).toEqual(['INCOMPLETE_CRITICAL']);
  });

  it('is healthy after a recent COMPLETE run', () => {
    const h = buildSyncHealth(
      [run('COMPLETE', 1, { authenticationStatus: 'AUTHENTICATED', databaseWriteStatus: 'OK' })],
      NOW,
    );
    expect(h.status).toBe('SYNC_SUCCESS');
    expect(h.authStatus).toBe('AUTHENTICATED');
    expect(h.healthy).toBe(true);
  });
});
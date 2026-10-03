import { nsError } from './log';
import type { NeverSkipStore } from './store';

/**
 * Record a NeverSkip authentication failure as a SyncRun. Touches no data and
 * never invalidates caches. Returns the worker exit code (3, or 1 if the DB write failed).
 */
export async function recordAuthenticationFailure(
  store: Pick<NeverSkipStore, 'recordSyncRun'>,
  opts: { startedAt: Date; message: string; lastLoginAt: string | null },
): Promise<number> {
  const authenticationStatus = /profile missing/i.test(opts.message)
    ? 'AUTHENTICATION_REQUIRED'
    : 'SESSION_EXPIRED';
  try {
    await store.recordSyncRun({
      status: 'AUTHENTICATION_REQUIRED',
      startedAt: opts.startedAt,
      finishedAt: new Date(),
      errorSummary: opts.message.slice(0, 400),
      reportJson: JSON.stringify({
        syncStatus: 'AUTHENTICATION_REQUIRED',
        authenticationStatus,
        databaseWriteStatus: 'NOT_ATTEMPTED',
        lastLoginAt: opts.lastLoginAt,
      }),
    });
    return 3;
  } catch (err) {
    nsError(`Failed to record authentication failure: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

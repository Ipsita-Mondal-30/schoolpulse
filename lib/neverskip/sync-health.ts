/**
 * Admin-only NeverSkip sync health derived from SyncRun rows.
 * Never send this object to parent-facing pages.
 */

import type { PrismaClient } from '@prisma/client';

export const STALE_SUCCESS_MS = 6 * 60 * 60 * 1000;

export type SyncHealthStatus =
  | 'SYNC_SUCCESS'
  | 'SYNC_PARTIAL'
  | 'SYNC_FAILED'
  | 'SESSION_EXPIRED'
  | 'AUTHENTICATION_REQUIRED'
  | 'NEVER_RUN';

export type AuthHealthStatus = 'AUTHENTICATED' | 'SESSION_EXPIRED' | 'AUTHENTICATION_REQUIRED' | 'UNKNOWN';

export type SyncHealthIssue =
  | 'AUTH_EXPIRED'
  | 'STALE_6H'
  | 'REPEATED_FAILURE'
  | 'INCOMPLETE_CRITICAL';

export type SyncRunRow = {
  status: string;
  startedAt: Date;
  finishedAt: Date;
  homeworkExpected: number | null;
  homeworkFetched: number | null;
  noticeFetched: number | null;
  jolFetched: number | null;
  errorSummary: string | null;
  reportJson: string | null;
};

export type SourceHealth = {
  status: string;
  sourceCount: number | null;
  uniqueCount: number | null;
  storedCount: number | null;
  latestSourceDate: string | null;
  error: string | null;
};

export type SyncHealth = {
  status: SyncHealthStatus;
  authStatus: AuthHealthStatus;
  databaseWriteStatus: string;
  lastAttemptAt: string | null;
  /** Last COMPLETE run — PARTIAL never counts as success. */
  lastSuccessAt: string | null;
  /** Last COMPLETE or PARTIAL run (rows were written). */
  lastDataWriteAt: string | null;
  lastFailureAt: string | null;
  failureReason: string | null;
  homework: SourceHealth | null;
  notices: SourceHealth | null;
  jol: SourceHealth | null;
  plannerStatus: string | null;
  issues: SyncHealthIssue[];
  healthy: boolean;
};

const FAILURE_STATUSES = new Set(['FAILED', 'AUTHENTICATION_REQUIRED', 'INCOMPLETE']);

function parseReport(reportJson: string | null | undefined): Record<string, unknown> {
  if (!reportJson?.trim()) return {};
  try {
    const parsed = JSON.parse(reportJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return v == null || v === '' ? null : String(v);
}

function sourceHealth(raw: unknown, sourceCount: number | null): SourceHealth | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    status: str(o.status) ?? 'UNKNOWN',
    sourceCount,
    uniqueCount: num(o.fetched),
    storedCount: num(o.stored),
    latestSourceDate: str(o.newestDate),
    error: str(o.error),
  };
}

export function authStatusForRun(run: Pick<SyncRunRow, 'status' | 'reportJson'> | null): AuthHealthStatus {
  if (!run) return 'UNKNOWN';
  const report = parseReport(run.reportJson);
  const fromReport = str(report.authenticationStatus);
  if (fromReport === 'AUTHENTICATED' || fromReport === 'SESSION_EXPIRED' || fromReport === 'AUTHENTICATION_REQUIRED') {
    return fromReport;
  }
  if (run.status === 'AUTHENTICATION_REQUIRED') return 'AUTHENTICATION_REQUIRED';
  if (run.status === 'COMPLETE' || run.status === 'PARTIAL') return 'AUTHENTICATED';
  return 'UNKNOWN';
}

export function mapSyncStatus(run: Pick<SyncRunRow, 'status' | 'reportJson'> | null): SyncHealthStatus {
  if (!run) return 'NEVER_RUN';
  switch (run.status) {
    case 'COMPLETE':
      return 'SYNC_SUCCESS';
    case 'PARTIAL':
      return 'SYNC_PARTIAL';
    case 'AUTHENTICATION_REQUIRED':
      return authStatusForRun(run) === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'AUTHENTICATION_REQUIRED';
    default:
      return 'SYNC_FAILED';
  }
}

/** Worker process exit code for a sync outcome. */
export function exitCodeForSyncStatus(status: string): number {
  if (status === 'COMPLETE') return 0;
  if (status === 'PARTIAL') return 2;
  if (status === 'AUTHENTICATION_REQUIRED') return 3;
  return 1;
}

function isCriticalIncomplete(health: Pick<SyncHealth, 'homework' | 'notices' | 'jol' | 'plannerStatus'>): boolean {
  const hw = health.homework?.status;
  const nt = health.notices?.status;
  const jol = health.jol?.status;
  return (
    hw === 'PARTIAL' ||
    hw === 'FAILED' ||
    nt === 'PAGE0_ONLY' ||
    nt === 'PARTIAL' ||
    nt === 'FAILED' ||
    jol === 'PARTIAL' ||
    jol === 'FAILED' ||
    health.plannerStatus === 'FAILED'
  );
}

/**
 * @param runs most-recent-first SyncRun rows (at least the last few attempts).
 */
export function buildSyncHealth(runs: SyncRunRow[], now: Date = new Date()): SyncHealth {
  const last = runs[0] ?? null;
  const lastSuccess = runs.find((r) => r.status === 'COMPLETE') ?? null;
  const lastWrite = runs.find((r) => r.status === 'COMPLETE' || r.status === 'PARTIAL') ?? null;
  const lastFailure = runs.find((r) => FAILURE_STATUSES.has(r.status)) ?? null;
  const lastDataRun = lastWrite ?? last;
  const report = parseReport(lastDataRun?.reportJson);
  const sources =
    report.sources && typeof report.sources === 'object' && !Array.isArray(report.sources)
      ? (report.sources as Record<string, unknown>)
      : {};
  const lastReport = parseReport(last?.reportJson);

  const health: SyncHealth = {
    status: mapSyncStatus(last),
    authStatus: authStatusForRun(last),
    databaseWriteStatus:
      str(lastReport.databaseWriteStatus) ??
      (last?.status === 'AUTHENTICATION_REQUIRED' ? 'NOT_ATTEMPTED' : last ? 'OK' : 'UNKNOWN'),
    lastAttemptAt: last?.finishedAt.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.finishedAt.toISOString() ?? null,
    lastDataWriteAt: lastWrite?.finishedAt.toISOString() ?? null,
    lastFailureAt: lastFailure?.finishedAt.toISOString() ?? null,
    failureReason: lastFailure?.errorSummary?.slice(0, 400) || null,
    homework: sourceHealth(sources.homework, num(report.homeworkSourceTotal) ?? lastDataRun?.homeworkExpected ?? null),
    notices: sourceHealth(sources.notices, num(report.noticeSourceTotal)),
    jol: sourceHealth(sources.jol, num(report.jolSourceTotal)),
    plannerStatus: str(lastReport.plannerStatus) ?? str(report.plannerStatus),
    issues: [],
    healthy: true,
  };

  const issues: SyncHealthIssue[] = [];
  if (health.status === 'SESSION_EXPIRED' || health.status === 'AUTHENTICATION_REQUIRED') {
    issues.push('AUTH_EXPIRED');
  }
  const successAge = lastSuccess ? now.getTime() - lastSuccess.finishedAt.getTime() : Infinity;
  if (runs.length > 0 && successAge > STALE_SUCCESS_MS) issues.push('STALE_6H');
  if (runs.length >= 2 && FAILURE_STATUSES.has(runs[0].status) && FAILURE_STATUSES.has(runs[1].status)) {
    issues.push('REPEATED_FAILURE');
  }
  if (isCriticalIncomplete(health)) issues.push('INCOMPLETE_CRITICAL');

  health.issues = issues;
  health.healthy = issues.length === 0;
  return health;
}

/** Health endpoint returns 503: auth expired, no COMPLETE run in 6h, or planner extraction failed. */
export function isHealthEndpointUnhealthy(health: Pick<SyncHealth, 'issues' | 'plannerStatus'>): boolean {
  return (
    health.issues.includes('AUTH_EXPIRED') ||
    health.issues.includes('STALE_6H') ||
    health.plannerStatus === 'FAILED'
  );
}

export async function loadSyncHealth(prisma: PrismaClient, now: Date = new Date()): Promise<SyncHealth> {
  const [recent, lastComplete, lastWrite] = await Promise.all([
    prisma.syncRun.findMany({ orderBy: { finishedAt: 'desc' }, take: 10 }),
    prisma.syncRun.findFirst({ where: { status: 'COMPLETE' }, orderBy: { finishedAt: 'desc' } }),
    prisma.syncRun.findFirst({
      where: { status: { in: ['COMPLETE', 'PARTIAL'] } },
      orderBy: { finishedAt: 'desc' },
    }),
  ]);
  const rows: SyncRunRow[] = [...recent];
  for (const extra of [lastComplete, lastWrite]) {
    if (extra && !rows.some((r) => r.finishedAt.getTime() === extra.finishedAt.getTime() && r.status === extra.status)) {
      rows.push(extra);
    }
  }
  rows.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
  return buildSyncHealth(rows, now);
}

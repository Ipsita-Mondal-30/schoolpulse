/** Pure helpers for scripts/verify-sync.ts (read-only operator report; never prints values). */

export type EnvRole = 'worker' | 'app';

export const REQUIRED_ENV: Record<EnvRole, string[]> = {
  worker: ['DATABASE_URL', 'NEVERSKIP_PROFILE_DIR', 'SYNCED_CHILD_SECTION'],
  app: ['DATABASE_URL', 'AUTH_SECRET', 'ADMIN_HEALTH_TOKEN'],
};

// REDIS_URL is optional: without it cache ops are no-ops and app caches expire within CACHE_TTL_SECONDS.
export const OPTIONAL_ENV: Record<EnvRole, string[]> = {
  worker: [
    'REDIS_URL',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'SUPABASE_ALERT_FUNCTION_URL',
    'SUPABASE_ALERT_FUNCTION_KEY',
    'ALERT_EMAIL_TO',
    'NEVERSKIP_VIDEO_JOBS_PER_RUN',
    'NEVERSKIP_HEADLESS',
  ],
  app: ['REDIS_URL', 'GOOGLE_GENERATIVE_AI_API_KEY', 'NEVERSKIP_STUDENT_ID', 'VIDEO_PROCESS_INLINE', 'CRON_SECRET'],
};

export function envPresence(
  names: string[],
  env: Record<string, string | undefined>,
): { name: string; present: boolean }[] {
  return names.map((name) => ({ name, present: Boolean(env[name]?.trim()) }));
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return null;
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

type SourceStatus = { status?: string; fetched?: number; stored?: number; newestDate?: string; error?: string };

/** One line per stream from SyncRun.reportJson (`sources` + top-level status fields). */
export function summarizeSyncReport(reportJson: string | null | undefined): string[] {
  let report: Record<string, unknown>;
  try {
    report = JSON.parse(reportJson || '{}') as Record<string, unknown>;
  } catch {
    return ['(reportJson unreadable)'];
  }
  const lines: string[] = [];
  const top = ['authenticationStatus', 'databaseWriteStatus', 'plannerStatus', 'jolTimetableStatus']
    .filter((k) => report[k] != null)
    .map((k) => `${k}=${String(report[k])}`);
  if (top.length) lines.push(top.join(' '));
  const sources = (report.sources ?? {}) as Record<string, SourceStatus>;
  for (const [name, s] of Object.entries(sources)) {
    const parts = [`${name}: ${s.status ?? '?'}`];
    if (s.fetched != null) parts.push(`fetched=${s.fetched}`);
    if (s.stored != null) parts.push(`stored=${s.stored}`);
    if (s.newestDate) parts.push(`newest=${s.newestDate}`);
    if (s.error) parts.push(`error=${String(s.error).slice(0, 120)}`);
    lines.push(parts.join(' '));
  }
  if (report.noticePage0Only === true) lines.push('notices: only page 0 could be fetched');
  return lines;
}

/** `bumpDataVersion` writes `${Date.now()}:${reason}`. */
export function describeDataVersion(version: string | null): string {
  if (!version) return '(none)';
  const ms = Number(version.split(':')[0]);
  return Number.isFinite(ms) && ms > 0 ? `${new Date(ms).toISOString()} (${version.split(':')[1] ?? ''})` : version;
}

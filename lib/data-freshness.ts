/**
 * Parent-safe sync freshness: a state and the last time school data was written.
 * Never carries error text, profile paths or other admin-only sync details.
 */

export type DataFreshnessState = 'fresh' | 'stale' | 'auth_expired' | 'never_synced' | 'unknown';

export interface DataFreshness {
  state: DataFreshnessState;
  /** finishedAt of the newest COMPLETE or PARTIAL run (ISO), i.e. when school data last reached SchoolPulse. */
  lastDataAt: string | null;
}

/** Worker runs every 4h; allow two missed runs before warning parents. */
export const DATA_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

const DATA_STATUSES = new Set(['COMPLETE', 'PARTIAL']);

export function buildDataFreshness(
  runs: Array<{ status: string; finishedAt: Date | string }>,
  now: Date = new Date(),
): DataFreshness {
  const sorted = runs
    .map((r) => ({ status: r.status, at: new Date(r.finishedAt) }))
    .filter((r) => !Number.isNaN(r.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const latest = sorted[0];
  const lastData = sorted.find((r) => DATA_STATUSES.has(r.status));
  const lastDataAt = lastData ? lastData.at.toISOString() : null;

  if (!latest) return { state: 'never_synced', lastDataAt: null };
  const dataIsOld = !lastData || now.getTime() - lastData.at.getTime() > DATA_STALE_AFTER_MS;
  // A failed login only matters to parents once the data it would have refreshed is old.
  if (latest.status === 'AUTHENTICATION_REQUIRED' && dataIsOld) return { state: 'auth_expired', lastDataAt };
  if (!lastData) return { state: 'never_synced', lastDataAt: null };
  if (dataIsOld) return { state: 'stale', lastDataAt };
  return { state: 'fresh', lastDataAt };
}

export function isDataFreshnessWarning(freshness: DataFreshness | undefined | null): boolean {
  return Boolean(
    freshness &&
      (freshness.state === 'stale' ||
        freshness.state === 'auth_expired' ||
        freshness.state === 'never_synced'),
  );
}

function formatIndiaDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

/** Parent-facing copy; null when no warning is needed. */
export function dataFreshnessMessage(
  freshness: DataFreshness | undefined | null,
): { title: string; description: string } | null {
  if (!freshness || !isDataFreshnessWarning(freshness)) return null;
  if (freshness.state === 'never_synced' || !freshness.lastDataAt) {
    return {
      title: 'School data has not synced yet',
      description: 'Homework and notices will appear once SchoolPulse connects to the school portal.',
    };
  }
  const since = formatIndiaDate(freshness.lastDataAt);
  if (freshness.state === 'auth_expired') {
    return {
      title: `School data last updated ${since}`,
      description:
        'The school portal login has expired, so notices and homework published after this date are not shown yet.',
    };
  }
  return {
    title: `School data last updated ${since}`,
    description: 'SchoolPulse has not received new data from the school since then, so recent items may be missing.',
  };
}

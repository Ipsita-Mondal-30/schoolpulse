/** Default production NeverSkip sync cadence (hours). */
export const DEFAULT_SYNC_INTERVAL_HOURS = 4;

/** Four hours in milliseconds — used by the external worker (not Vercel Cron). */
export const FOUR_HOURS_MS = DEFAULT_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;

export type SyncIntervalEnv = {
  NEVERSKIP_SYNC_INTERVAL_MS?: string;
  NEVERSKIP_SYNC_INTERVAL_HOURS?: string;
};

/**
 * Resolve the worker sync interval from environment variables.
 *
 * Precedence:
 * 1. NEVERSKIP_SYNC_INTERVAL_MS (positive integer milliseconds)
 * 2. NEVERSKIP_SYNC_INTERVAL_HOURS (positive number; default 4)
 *
 * This scheduler runs on a dedicated Playwright worker host.
 * Do not configure sub-daily schedules in vercel.json — Vercel Hobby
 * only allows at most one cron run per day.
 */
export function resolveSyncIntervalMs(
  env: SyncIntervalEnv | NodeJS.ProcessEnv = process.env,
): number {
  const msRaw = env.NEVERSKIP_SYNC_INTERVAL_MS?.trim();
  if (msRaw) {
    const ms = Number(msRaw);
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new Error(
        `NEVERSKIP_SYNC_INTERVAL_MS must be a positive number (got ${JSON.stringify(msRaw)})`,
      );
    }
    return Math.floor(ms);
  }

  const hoursRaw = env.NEVERSKIP_SYNC_INTERVAL_HOURS?.trim();
  if (hoursRaw) {
    const hours = Number(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error(
        `NEVERSKIP_SYNC_INTERVAL_HOURS must be a positive number (got ${JSON.stringify(hoursRaw)})`,
      );
    }
    return Math.floor(hours * 60 * 60 * 1000);
  }

  return FOUR_HOURS_MS;
}

export function formatIntervalForLog(intervalMs: number): string {
  const hours = intervalMs / (60 * 60 * 1000);
  if (Number.isInteger(hours)) {
    return `${hours}h (${intervalMs}ms)`;
  }
  return `${hours.toFixed(2)}h (${intervalMs}ms)`;
}

/** Exit code when the persisted NeverSkip session is missing or expired. */
export const WORKER_EXIT_SESSION_EXPIRED = 2;

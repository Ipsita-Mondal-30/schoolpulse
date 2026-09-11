#!/usr/bin/env tsx
/**
 * External NeverSkip sync worker (runs outside Vercel).
 *
 * Usage: npm run worker:neverskip
 *
 * Architecture:
 *   - Vercel Hobby hosts the Next.js SchoolPulse UI only
 *   - Neon PostgreSQL stores ImportedHomework / ImportedNotice
 *   - This process runs Playwright on a persistent host every 4 hours
 *   - Session/profile lives under NEVERSKIP_PROFILE_DIR (gitignored)
 *
 * Do NOT run this inside a Vercel serverless function.
 * Do NOT put a sub-daily schedule in vercel.json (Hobby rejects it).
 *
 * First time on the worker host:
 *   npm run neverskip:login
 * Then start the worker (headless sync every 4 hours by default).
 */
import { config } from 'dotenv';
config();

import {
  collectNeverSkipData,
  NeverSkipSessionExpiredError,
} from '../lib/neverskip/browser';
import { PrismaNeverSkipStore } from '../lib/neverskip/prisma-store';
import { collectedToSyncInput, syncNeverSkipData } from '../lib/neverskip/sync';
import { nsError, nsLog, nsWarn } from '../lib/neverskip/log';
import {
  formatIntervalForLog,
  resolveSyncIntervalMs,
  WORKER_EXIT_SESSION_EXPIRED,
} from '../lib/neverskip/worker-schedule';

async function runBrowserSync(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';

  const collected = await collectNeverSkipData({
    headless,
    requireAuthenticatedSession: true,
  });

  const store = new PrismaNeverSkipStore();
  const summary = await syncNeverSkipData({
    ...collectedToSyncInput(collected),
    store,
    label: 'worker sync',
  });

  nsLog('Worker sync completed');
  nsLog(
    `Summary: homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} homeworkInserted=${summary.homeworkInserted} homeworkSkipped=${summary.homeworkSkipped} noticesFetched=${summary.noticesFetched} noticesInserted=${summary.noticesInserted} noticesSkipped=${summary.noticesSkipped}`,
  );

  if (summary.errors.length > 0 || summary.homeworkFetchIncomplete || summary.noticeFetchIncomplete) {
    throw new Error(
      `Worker sync completed with errors: ${summary.errors.join('; ') || 'incomplete source data'}`,
    );
  }
}

async function main(): Promise<void> {
  const intervalMs = resolveSyncIntervalMs();
  const runOnStart = process.env.NEVERSKIP_WORKER_RUN_ON_START !== 'false';

  nsLog('NeverSkip external worker starting');
  nsLog('Playwright browser sync runs on this host — not on Vercel');
  nsLog(`Sync interval: ${formatIntervalForLog(intervalMs)}`);
  nsLog(`Run on start: ${runOnStart}`);

  let inFlight = false;

  const tick = async (): Promise<'continue' | 'stop-session'> => {
    if (inFlight) {
      nsWarn('Previous NeverSkip sync still running; skipping this tick');
      return 'continue';
    }
    inFlight = true;
    try {
      nsLog('Scheduled NeverSkip sync tick');
      await runBrowserSync();
      return 'continue';
    } catch (err) {
      if (err instanceof NeverSkipSessionExpiredError) {
        nsError('NeverSkip session expired');
        nsError('Manual re-authentication required');
        nsLog('On the worker host run: npm run neverskip:login');
        nsLog('Then restart: npm run worker:neverskip');
        return 'stop-session';
      }
      nsError(err instanceof Error ? err.message : String(err));
      nsWarn('Transient sync failure — will retry on the next interval');
      return 'continue';
    } finally {
      inFlight = false;
    }
  };

  if (runOnStart) {
    const first = await tick();
    if (first === 'stop-session') {
      process.exit(WORKER_EXIT_SESSION_EXPIRED);
    }
  }

  setInterval(() => {
    void tick().then((result) => {
      if (result === 'stop-session') {
        process.exit(WORKER_EXIT_SESSION_EXPIRED);
      }
    });
  }, intervalMs);

  nsLog('Worker idle — waiting for next sync interval');
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    process.exit(WORKER_EXIT_SESSION_EXPIRED);
  }
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

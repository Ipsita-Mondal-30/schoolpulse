#!/usr/bin/env tsx
/**
 * Local NeverSkip sync via Playwright authenticated browser session.
 * Usage: npm run sync:neverskip:browser
 *
 * Requires DATABASE_URL. Does NOT require NEVERSKIP_TOKEN.
 *
 * First time (headed login, CAPTCHA OK):
 *   npm run neverskip:login
 *
 * Later (headless, reuses .playwright-profile / NEVERSKIP_PROFILE_DIR):
 *   npm run sync:neverskip:browser
 *
 * Browser collector is for local / dedicated worker use — not Vercel serverless.
 * Never commits the Playwright profile (see .gitignore).
 */
import { config } from 'dotenv';
config();

import {
  collectNeverSkipData,
  NeverSkipSessionExpiredError,
} from '../lib/neverskip/browser';
import { PrismaNeverSkipStore } from '../lib/neverskip/prisma-store';
import { collectedToSyncInput, syncNeverSkipData } from '../lib/neverskip/sync';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  // Default headless once a persisted session exists. Set NEVERSKIP_HEADLESS=false to watch.
  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';

  const collected = await collectNeverSkipData({
    headless,
    requireAuthenticatedSession: true,
  });

  const store = new PrismaNeverSkipStore();
  const summary = await syncNeverSkipData({
    ...collectedToSyncInput(collected),
    store,
    label: 'browser sync',
  });

  if (summary.errors.length > 0 || summary.homeworkFetchIncomplete || summary.noticeFetchIncomplete) {
    nsError('SYNC STATUS: INCOMPLETE');
    nsLog(
      `Summary: homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} homeworkInserted=${summary.homeworkInserted} homeworkSkipped=${summary.homeworkSkipped} noticesFetched=${summary.noticesFetched} noticesInserted=${summary.noticesInserted} noticesSkipped=${summary.noticesSkipped}`,
    );
    process.exitCode = 1;
  } else {
    nsLog('SYNC STATUS: COMPLETE');
    nsLog(
      `Summary: homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} homeworkInserted=${summary.homeworkInserted} homeworkSkipped=${summary.homeworkSkipped} noticesFetched=${summary.noticesFetched} noticesInserted=${summary.noticesInserted} noticesSkipped=${summary.noticesSkipped}`,
    );
  }
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    // logSessionExpired already printed SYNC STATUS: SESSION_EXPIRED
    process.exit(1);
  }
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

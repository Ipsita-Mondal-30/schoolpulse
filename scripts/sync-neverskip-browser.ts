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
import { syncJolWorksheetTimetableFromSchoolDocument } from '../lib/neverskip/jol-timetable-sync';
import { normalizeContentLibraryItem } from '../lib/neverskip/jol';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
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
    label: 'browser sync',
  });

  const downloadCandidates = (collected.jolItems ?? [])
    .map((raw) => normalizeContentLibraryItem(raw))
    .filter(Boolean)
    .map((item) => ({
      sourceId: item!.sourceId,
      title: item!.title,
      subjectName: item!.subjectName,
      resourceType: item!.resourceType,
      downloadUrl: item!.downloadUrl,
    }));

  const jolTt = await syncJolWorksheetTimetableFromSchoolDocument({
    downloadCandidates,
    fetchBytes: async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      } catch {
        return null;
      }
    },
  });
  summary.jolTimetableStatus = jolTt.status;
  summary.jolTimetableDayCount = jolTt.dayCount;
  if (summary.sourceStatuses) {
    summary.sourceStatuses.jolTimetable = {
      status: jolTt.status,
      fetched: jolTt.dayCount,
      stored: jolTt.dayCount,
      error: jolTt.errors[0],
    };
  }
  nsLog(`JOL worksheet timetable sync: ${jolTt.status} days=${jolTt.dayCount ?? 0}`);

  const authFailed = false;
  const hardFail =
    summary.syncStatus === 'FAILED' ||
    (summary.homeworkFetched === 0 &&
      summary.noticesFetched === 0 &&
      (summary.jolFetched ?? 0) === 0 &&
      summary.errors.length > 0);

  if (hardFail) {
    nsError('SYNC STATUS: FAILED');
    nsLog(
      `Summary: status=${summary.syncStatus} homework=${summary.homeworkFetched} notices=${summary.noticesFetched} jol=${summary.jolFetched ?? 0} jolTt=${jolTt.status}`,
    );
    process.exitCode = 1;
  } else if (summary.syncStatus === 'PARTIAL' || jolTt.status === 'SKIPPED_NO_SOURCE') {
    nsLog(`SYNC STATUS: PARTIAL (overall=${summary.syncStatus} jolTt=${jolTt.status})`);
    nsLog(
      `Summary: homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} noticesFetched=${summary.noticesFetched} jolFetched=${summary.jolFetched ?? 0} scheduleFetched=${summary.scheduleFetched ?? 0} jolTt=${jolTt.status}`,
    );
    // Partial with upserts is success for cron — exit 0 so other ops stay healthy.
    process.exitCode = 0;
  } else {
    nsLog('SYNC STATUS: COMPLETE');
    nsLog(
      `Summary: homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} homeworkInserted=${summary.homeworkInserted} noticesFetched=${summary.noticesFetched} jolFetched=${summary.jolFetched ?? 0} scheduleFetched=${summary.scheduleFetched ?? 0} jolTt=${jolTt.status}`,
    );
  }

  if (authFailed) process.exitCode = 1;
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    process.exit(1);
  }
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

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
 * Exit codes: 0 COMPLETE, 2 PARTIAL, 1 FAILED / DB error, 3 authentication required.
 *
 * Browser collector is for local / dedicated worker use — not Vercel serverless.
 * Never commits the Playwright profile (see .gitignore).
 */
import { config } from 'dotenv';
config();

import {
  collectNeverSkipData,
  NeverSkipSessionExpiredError,
  readNeverSkipLoginTimestamp,
} from '../lib/neverskip/browser';
import { PrismaNeverSkipStore } from '../lib/neverskip/prisma-store';
import { collectedToSyncInput, syncNeverSkipData } from '../lib/neverskip/sync';
import { syncJolWorksheetTimetableFromSchoolDocument } from '../lib/neverskip/jol-timetable-sync';
import { normalizeContentLibraryItem } from '../lib/neverskip/jol';
import { nsError, nsLog, nsWarn } from '../lib/neverskip/log';
import { exitCodeForSyncStatus } from '../lib/neverskip/sync-health';
import { recordAuthenticationFailure } from '../lib/neverskip/auth-failure';
import { runSyncAlertCheck } from '../lib/alerts/sync-alerts';

async function alertCheck(): Promise<void> {
  try {
    await runSyncAlertCheck();
  } catch (err) {
    nsWarn(`Alert check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  const startedAt = new Date();

  let collected: Awaited<ReturnType<typeof collectNeverSkipData>>;
  try {
    collected = await collectNeverSkipData({
      headless,
      requireAuthenticatedSession: true,
    });
  } catch (err) {
    if (err instanceof NeverSkipSessionExpiredError) {
      nsError('SYNC STATUS: AUTHENTICATION_REQUIRED — run `npm run neverskip:login` on the worker');
      const code = await recordAuthenticationFailure(new PrismaNeverSkipStore(), {
        startedAt,
        message: err.message,
        lastLoginAt: readNeverSkipLoginTimestamp(),
      });
      await alertCheck();
      return code;
    }
    throw err;
  }

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
  }).catch((err) => ({
    status: 'FAILED' as const,
    dayCount: undefined,
    errors: [err instanceof Error ? err.message : String(err)],
  }));
  nsLog(`JOL worksheet timetable sync: ${jolTt.status} days=${jolTt.dayCount ?? 0}`);

  const store = new PrismaNeverSkipStore();
  const summary = await syncNeverSkipData({
    ...collectedToSyncInput(collected),
    store,
    label: 'browser sync',
    extraReport: {
      jolTimetableStatus: jolTt.status,
      jolTimetableDayCount: jolTt.dayCount ?? null,
      plannerStatus: jolTt.status === 'FAILED' ? 'FAILED' : jolTt.status,
      plannerError: jolTt.errors[0] ?? null,
    },
  });
  summary.jolTimetableStatus = jolTt.status;
  summary.jolTimetableDayCount = jolTt.dayCount;

  const status = summary.syncStatus || 'PARTIAL';
  nsLog(
    `Summary: status=${status} homeworkPages=${summary.homeworkPagesFetched ?? '?'} homeworkFetched=${summary.homeworkFetched} noticesFetched=${summary.noticesFetched} jolFetched=${summary.jolFetched ?? 0} scheduleFetched=${summary.scheduleFetched ?? 0} jolTt=${jolTt.status}`,
  );

  await alertCheck();

  if (summary.syncRunRecordFailed) {
    nsError('SYNC STATUS: FAILED — SyncRun could not be written to the database');
    return 1;
  }
  return exitCodeForSyncStatus(status);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    nsError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });

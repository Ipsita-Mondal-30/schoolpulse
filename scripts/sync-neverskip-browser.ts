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
 * After the sync, drains up to NEVERSKIP_VIDEO_JOBS_PER_RUN (default 2) queued AI
 * homework videos; video failures never change the exit code.
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
import {
  enqueueVideosForNewHomework,
  processQueuedHomeworkVideos,
  VIDEO_STATUS,
} from '../lib/ai/homework-video';
import { resolveConfiguredSection } from '../lib/synced-child';

async function alertCheck(): Promise<void> {
  try {
    await runSyncAlertCheck();
  } catch (err) {
    nsWarn(`Alert check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Drain parent-requested AI homework video jobs (Veo needs minutes; Vercel cannot).
 * Bounded per run and never changes the sync exit code.
 */
async function processVideoQueue(): Promise<void> {
  const limit = Number(process.env.NEVERSKIP_VIDEO_JOBS_PER_RUN ?? 2);
  if (!Number.isFinite(limit) || limit <= 0) {
    nsLog('Video queue: disabled (NEVERSKIP_VIDEO_JOBS_PER_RUN=0)');
    return;
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    nsWarn('Video queue: skipped — GOOGLE_GENERATIVE_AI_API_KEY not set on the worker');
    return;
  }
  try {
    if (process.env.NEVERSKIP_AUTO_ENQUEUE_VIDEOS === 'true') {
      const enq = await enqueueVideosForNewHomework({ limit });
      nsLog(`Video queue: auto-enqueued=${enq.enqueued} skipped=${enq.skipped}`);
    }
    const drained = await processQueuedHomeworkVideos({ limit: Math.floor(limit) });
    const ready = drained.results.filter((r) => r.status === VIDEO_STATUS.READY).length;
    nsLog(
      `Video queue: recoveredStale=${drained.recovered.requeued} failedStale=${drained.recovered.failed} processed=${drained.processed} ready=${ready} notReady=${drained.processed - ready}`,
    );
  } catch (err) {
    nsWarn(`Video queue step failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<number> {
  const code = await syncMain();
  if (code !== 1) await processVideoQueue();
  return code;
}

async function syncMain(): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }
  if (!resolveConfiguredSection()) {
    nsWarn(
      'SYNCED_CHILD_SECTION not set — homework without class/section targeting stays visible to all Class 1 sections',
    );
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

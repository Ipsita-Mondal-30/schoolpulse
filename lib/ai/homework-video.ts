/**
 * Orchestrate homework → Gemini lesson → one Veo clip → local storage → HomeworkVideo row.
 *
 * HTTP handlers must enqueue and return quickly (Vercel timeouts).
 * Long Veo work runs via processHomeworkVideoJob (after() locally / Oracle worker).
 */

import { getPrisma } from '@/lib/prisma';
import {
  INSUFFICIENT_SOURCE,
  assessHomeworkVideoEligibility,
  buildVeoPromptFromLesson,
  generateHomeworkLessonPlan,
  type HomeworkLessonPlan,
} from '@/lib/ai/homework-lesson';
import { formatVeoError, generateAndDownloadVeoVideo, getVeoModelId } from '@/lib/ai/veo';
import { getVideoStorage, homeworkVideoStorageKey } from '@/lib/ai/video-storage';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const VIDEO_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PLANNING: 'PLANNING',
  GENERATING: 'GENERATING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type VideoStatus = (typeof VIDEO_STATUS)[keyof typeof VIDEO_STATUS];

export const PARENT_VIDEO_ERROR =
  "AI video couldn't be generated yet. Please try again later.";

/** Parent-safe copy when provider quota/billing blocks Veo. */
export const PARENT_VIDEO_QUOTA_ERROR =
  'AI video is temporarily unavailable (provider quota). Please try again after quota resets or billing is enabled.';

export function parentMessageForVideoError(errorMessage: string | null): string {
  if (!errorMessage) return PARENT_VIDEO_ERROR;
  if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit|billing/i.test(errorMessage)) {
    return PARENT_VIDEO_QUOTA_ERROR;
  }
  return PARENT_VIDEO_ERROR;
}

const IN_PROGRESS: ReadonlySet<string> = new Set([
  VIDEO_STATUS.QUEUED,
  VIDEO_STATUS.PLANNING,
  VIDEO_STATUS.GENERATING,
]);

/** Claims per job before it stays FAILED (parent retries included). */
export const MAX_VIDEO_ATTEMPTS = 3;
/** Longer than Veo's 12-minute poll limit plus lesson planning. */
export const STALE_VIDEO_JOB_MS = 30 * 60_000;

const CLAIMED: ReadonlySet<string> = new Set([VIDEO_STATUS.PLANNING, VIDEO_STATUS.GENERATING]);

/**
 * Whether the HTTP route should start Veo in after(). Off on Vercel by default
 * (serverless kills it mid-run); VIDEO_PROCESS_INLINE=true|false overrides.
 */
export function shouldProcessVideoInline(env: Record<string, string | undefined>): boolean {
  if (env.VIDEO_PROCESS_INLINE === 'true') return true;
  if (env.VIDEO_PROCESS_INLINE === 'false') return false;
  return !env.VERCEL;
}

/** What to do with a job a crashed/killed worker left mid-flight. */
export function stuckVideoAction(
  row: { status: string; updatedAt: Date; attempts: number },
  now: Date,
): 'requeue' | 'fail' | null {
  if (!CLAIMED.has(row.status)) return null;
  if (now.getTime() - row.updatedAt.getTime() < STALE_VIDEO_JOB_MS) return null;
  return row.attempts < MAX_VIDEO_ATTEMPTS ? 'requeue' : 'fail';
}

export function videoAttemptsExhausted(row: { status: string; attempts: number }): boolean {
  return row.status === VIDEO_STATUS.FAILED && row.attempts >= MAX_VIDEO_ATTEMPTS;
}

/** Return stale PLANNING/GENERATING jobs to the queue, or fail them once attempts are used up. */
export async function recoverStuckHomeworkVideos(
  now = new Date(),
): Promise<{ requeued: number; failed: number }> {
  const prisma = getPrisma();
  const cutoff = new Date(now.getTime() - STALE_VIDEO_JOB_MS);
  const stale = {
    status: { in: [...CLAIMED] },
    updatedAt: { lt: cutoff },
  };
  const requeued = await prisma.homeworkVideo.updateMany({
    where: { ...stale, attempts: { lt: MAX_VIDEO_ATTEMPTS } },
    data: { status: VIDEO_STATUS.QUEUED, errorMessage: 'Recovered after worker timeout' },
  });
  const failed = await prisma.homeworkVideo.updateMany({
    where: { ...stale, attempts: { gte: MAX_VIDEO_ATTEMPTS } },
    data: { status: VIDEO_STATUS.FAILED, errorMessage: 'Timed out after maximum attempts' },
  });
  return { requeued: requeued.count, failed: failed.count };
}

export type HomeworkVideoPublic = {
  status: VideoStatus;
  videoUrl?: string;
  message?: string;
  title?: string;
  subject?: string;
};

function parentSafeStatus(row: {
  status: string;
  videoUrl: string | null;
  errorMessage: string | null;
  lessonJson: string;
}): HomeworkVideoPublic {
  const status = (row.status || VIDEO_STATUS.PENDING) as VideoStatus;
  let title: string | undefined;
  let subject: string | undefined;
  try {
    const lesson = JSON.parse(row.lessonJson) as Partial<HomeworkLessonPlan>;
    if (lesson && lesson.eligible) {
      title = lesson.title;
      subject = lesson.subject;
    }
  } catch {
    /* ignore */
  }

  if (status === VIDEO_STATUS.READY && row.videoUrl) {
    return { status, videoUrl: row.videoUrl, title, subject };
  }
  if (IN_PROGRESS.has(status) || status === VIDEO_STATUS.PENDING) {
    // Parent UI treats QUEUED/PENDING like GENERATING (in progress).
    const publicStatus =
      status === VIDEO_STATUS.QUEUED || status === VIDEO_STATUS.PENDING
        ? VIDEO_STATUS.GENERATING
        : status;
    return { status: publicStatus as VideoStatus, title, subject };
  }
  if (status === VIDEO_STATUS.FAILED) {
    return {
      status,
      message: parentMessageForVideoError(row.errorMessage),
      title,
      subject,
    };
  }
  return { status: VIDEO_STATUS.PENDING };
}

export async function getHomeworkVideoStatus(
  homeworkDbId: string,
): Promise<HomeworkVideoPublic | null> {
  const row = await getPrisma().homeworkVideo.findUnique({
    where: { homeworkId: homeworkDbId },
  });
  if (!row) return null;
  return parentSafeStatus(row);
}

/**
 * Create or resume a video job without waiting for Veo.
 * Idempotent: READY returns existing; in-progress returns current status.
 */
export async function enqueueHomeworkVideo(
  homeworkDbId: string,
): Promise<HomeworkVideoPublic> {
  const prisma = getPrisma();
  const homework = await prisma.importedHomework.findUnique({
    where: { id: homeworkDbId },
  });
  if (!homework) {
    return { status: VIDEO_STATUS.FAILED, message: PARENT_VIDEO_ERROR };
  }

  const existing = await prisma.homeworkVideo.findUnique({
    where: { homeworkId: homeworkDbId },
  });

  if (existing?.status === VIDEO_STATUS.READY && existing.videoUrl) {
    return parentSafeStatus(existing);
  }
  const stuck = existing ? stuckVideoAction(existing, new Date()) : null;
  if (stuck === 'fail') {
    const failed = await prisma.homeworkVideo.update({
      where: { id: existing!.id },
      data: { status: VIDEO_STATUS.FAILED, errorMessage: 'Timed out after maximum attempts' },
    });
    return parentSafeStatus(failed);
  }
  if (existing && IN_PROGRESS.has(existing.status) && stuck !== 'requeue') {
    return parentSafeStatus(existing);
  }
  if (existing && videoAttemptsExhausted(existing)) {
    return parentSafeStatus(existing);
  }

  if (existing) {
    const updated = await prisma.homeworkVideo.update({
      where: { id: existing.id },
      data: {
        status: VIDEO_STATUS.QUEUED,
        errorMessage: null,
        provider: 'veo',
      },
    });
    return parentSafeStatus(updated);
  }

  const created = await prisma.homeworkVideo.create({
    data: {
      homeworkId: homeworkDbId,
      status: VIDEO_STATUS.QUEUED,
      provider: 'veo',
    },
  });
  return parentSafeStatus(created);
}

/**
 * Full inline pipeline (scripts/tests). Prefer enqueue + process for HTTP.
 */
export async function generateHomeworkVideo(
  homeworkDbId: string,
): Promise<HomeworkVideoPublic> {
  const enqueued = await enqueueHomeworkVideo(homeworkDbId);
  if (enqueued.status === VIDEO_STATUS.READY) return enqueued;
  return processHomeworkVideoJob(homeworkDbId);
}

/**
 * Claim a queued job and run Gemini → Veo → storage → READY/FAILED.
 * Safe to call concurrently: only one claim wins via conditional update.
 */
export async function processHomeworkVideoJob(
  homeworkDbId: string,
): Promise<HomeworkVideoPublic> {
  const prisma = getPrisma();

  const existing = await prisma.homeworkVideo.findUnique({
    where: { homeworkId: homeworkDbId },
  });
  if (!existing) {
    return { status: VIDEO_STATUS.FAILED, message: PARENT_VIDEO_ERROR };
  }
  if (existing.status === VIDEO_STATUS.READY && existing.videoUrl) {
    return parentSafeStatus(existing);
  }
  if (
    existing.status === VIDEO_STATUS.PLANNING ||
    existing.status === VIDEO_STATUS.GENERATING
  ) {
    // Another worker already claimed this job.
    return parentSafeStatus(existing);
  }

  const claimed = await prisma.homeworkVideo.updateMany({
    where: {
      homeworkId: homeworkDbId,
      status: { in: [VIDEO_STATUS.QUEUED, VIDEO_STATUS.PENDING, VIDEO_STATUS.FAILED] },
      attempts: { lt: MAX_VIDEO_ATTEMPTS },
    },
    data: { status: VIDEO_STATUS.PLANNING, errorMessage: null, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    const again = await prisma.homeworkVideo.findUnique({
      where: { homeworkId: homeworkDbId },
    });
    return again ? parentSafeStatus(again) : { status: VIDEO_STATUS.FAILED, message: PARENT_VIDEO_ERROR };
  }

  const row = await prisma.homeworkVideo.findUniqueOrThrow({
    where: { homeworkId: homeworkDbId },
  });

  const homework = await prisma.importedHomework.findUnique({
    where: { id: homeworkDbId },
  });
  if (!homework) {
    await prisma.homeworkVideo.update({
      where: { id: row.id },
      data: { status: VIDEO_STATUS.FAILED, errorMessage: 'Homework missing' },
    });
    return { status: VIDEO_STATUS.FAILED, message: PARENT_VIDEO_ERROR };
  }

  try {
    const jol = await prisma.importedJolItem.findMany({
      take: 40,
      orderBy: { publishedDate: 'desc' },
    });
    const subjectNeedle = homework.subjectName.trim().toLowerCase();
    const titleNeedle = homework.title.trim().toLowerCase().slice(0, 24);
    const matchedJol = jol
      .filter((j) => {
        const sub = (j.subjectName || '').toLowerCase();
        const title = j.title.toLowerCase();
        return (
          (subjectNeedle && sub.includes(subjectNeedle)) ||
          (titleNeedle && title.includes(titleNeedle))
        );
      })
      .slice(0, 8);

    const lesson = await generateHomeworkLessonPlan({
      homeworkId: homework.id,
      subject: homework.subjectName,
      title: homework.title,
      details: homework.description,
      classLevel: 'Class I',
      libraryResources: matchedJol.map((j) => ({
        id: j.sourceId,
        title: j.title,
        date: j.publishedDate || j.activityDate,
        description: j.description || j.content,
        subject: j.subjectName || undefined,
      })),
    });

    if (!lesson.eligible) {
      await prisma.homeworkVideo.update({
        where: { id: row.id },
        data: {
          status: VIDEO_STATUS.FAILED,
          errorMessage: lesson.reason || INSUFFICIENT_SOURCE,
          lessonJson: JSON.stringify({ eligible: false, reason: lesson.reason }),
        },
      });
      return {
        status: VIDEO_STATUS.FAILED,
        message:
          lesson.reason === INSUFFICIENT_SOURCE
            ? 'There isn’t enough school material to make a lesson for this homework yet.'
            : PARENT_VIDEO_ERROR,
      };
    }

    await prisma.homeworkVideo.update({
      where: { id: row.id },
      data: {
        status: VIDEO_STATUS.GENERATING,
        lessonJson: JSON.stringify(lesson),
        provider: 'veo',
      },
    });

    const prompt = buildVeoPromptFromLesson(lesson);
    const tmpPath = join(tmpdir(), `sp-hw-video-${homeworkDbId}-${Date.now()}.mp4`);

    const veo = await generateAndDownloadVeoVideo({
      prompt,
      downloadPath: tmpPath,
      model: getVeoModelId(),
    });

    const bytes = readFileSync(tmpPath);
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }

    const storage = getVideoStorage();
    const key = homeworkVideoStorageKey(homeworkDbId);
    await storage.save(key, bytes);

    // Parent-facing path is our authenticated file route — not a provider URL.
    const videoUrl = `/api/homework/${homeworkDbId}/video/file`;

    const ready = await prisma.homeworkVideo.update({
      where: { id: row.id },
      data: {
        status: VIDEO_STATUS.READY,
        videoUrl,
        videoBytes: bytes,
        providerJobId: veo.operationName || null,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    return parentSafeStatus(ready);
  } catch (err) {
    const detail = formatVeoError(err);
    console.error('[SchoolPulse] homework video failed:', detail);
    const failed = await prisma.homeworkVideo.update({
      where: { id: row.id },
      data: {
        status: VIDEO_STATUS.FAILED,
        errorMessage: detail.slice(0, 500),
      },
    });
    return parentSafeStatus(failed);
  }
}

/**
 * Enqueue eligible homework that has no HomeworkVideo yet (idempotent).
 * Used after NeverSkip sync — does not start Veo inline.
 */
export async function enqueueVideosForNewHomework(options?: {
  limit?: number;
  homeworkIds?: string[];
}): Promise<{ enqueued: number; skipped: number }> {
  const prisma = getPrisma();
  const limit = options?.limit ?? 10;

  const rows = options?.homeworkIds?.length
    ? await prisma.importedHomework.findMany({
        where: { id: { in: options.homeworkIds } },
        include: { homeworkVideo: true },
      })
    : await prisma.importedHomework.findMany({
        where: { homeworkVideo: null },
        orderBy: { createdAt: 'desc' },
        take: limit * 3,
        include: { homeworkVideo: true },
      });

  let enqueued = 0;
  let skipped = 0;

  for (const hw of rows) {
    if (enqueued >= limit) break;
    if (hw.homeworkVideo) {
      skipped += 1;
      continue;
    }
    const extraction = assessHomeworkVideoEligibility({
      homework: {
        title: hw.title,
        description: hw.description,
        subject: hw.subjectName,
        date: hw.homeworkDate,
      },
    });
    if (!extraction.eligible) {
      skipped += 1;
      continue;
    }
    await enqueueHomeworkVideo(hw.id);
    enqueued += 1;
  }

  return { enqueued, skipped };
}

/**
 * Drain QUEUED/PENDING jobs (worker) after recovering stale claims.
 * Processes sequentially to respect Veo quota.
 */
export async function processQueuedHomeworkVideos(options?: {
  limit?: number;
}): Promise<{
  processed: number;
  results: HomeworkVideoPublic[];
  recovered: { requeued: number; failed: number };
}> {
  const prisma = getPrisma();
  const limit = options?.limit ?? 2;
  const recovered = await recoverStuckHomeworkVideos();
  const queued = await prisma.homeworkVideo.findMany({
    where: {
      status: { in: [VIDEO_STATUS.QUEUED, VIDEO_STATUS.PENDING] },
      attempts: { lt: MAX_VIDEO_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const results: HomeworkVideoPublic[] = [];
  for (const row of queued) {
    results.push(await processHomeworkVideoJob(row.homeworkId));
  }
  return { processed: results.length, results, recovered };
}

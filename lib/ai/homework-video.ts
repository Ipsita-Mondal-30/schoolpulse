/**
 * Orchestrate homework → Gemini lesson → one Veo clip → local storage → HomeworkVideo row.
 * Manual trigger only — never call from sync/cron/page load.
 */

import { getPrisma } from '@/lib/prisma';
import {
  INSUFFICIENT_SOURCE,
  buildVeoPromptFromLesson,
  generateHomeworkLessonPlan,
  type HomeworkLessonPlan,
} from '@/lib/ai/homework-lesson';
import { formatVeoError, generateAndDownloadVeoVideo, getVeoModelId } from '@/lib/ai/veo';
import { getVideoStorage } from '@/lib/ai/video-storage';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const VIDEO_STATUS = {
  PENDING: 'PENDING',
  PLANNING: 'PLANNING',
  GENERATING: 'GENERATING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type VideoStatus = (typeof VIDEO_STATUS)[keyof typeof VIDEO_STATUS];

export const PARENT_VIDEO_ERROR =
  "We couldn't create this lesson right now. Please try again later.";

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
  if (
    status === VIDEO_STATUS.GENERATING ||
    status === VIDEO_STATUS.PLANNING ||
    status === VIDEO_STATUS.PENDING
  ) {
    return { status, title, subject };
  }
  if (status === VIDEO_STATUS.FAILED) {
    return { status, message: PARENT_VIDEO_ERROR, title, subject };
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
 * Start or resume generation. Idempotent for READY / in-progress.
 */
export async function generateHomeworkVideo(
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
  if (
    existing &&
    (existing.status === VIDEO_STATUS.GENERATING || existing.status === VIDEO_STATUS.PLANNING)
  ) {
    return parentSafeStatus(existing);
  }

  const row =
    existing ??
    (await prisma.homeworkVideo.create({
      data: {
        homeworkId: homeworkDbId,
        status: VIDEO_STATUS.PENDING,
        provider: 'veo',
      },
    }));

  await prisma.homeworkVideo.update({
    where: { id: row.id },
    data: { status: VIDEO_STATUS.PLANNING, errorMessage: null },
  });

  try {
    // Match JOL library by subject keyword for grounding (lightweight).
    const jol = await prisma.importedJolItem.findMany({
      take: 40,
      orderBy: { publishedDate: 'desc' },
    });
    const subjectNeedle = homework.subjectName.trim().toLowerCase();
    const titleNeedle = homework.title.trim().toLowerCase().slice(0, 24);
    const matchedJol = jol.filter((j) => {
      const sub = (j.subjectName || '').toLowerCase();
      const title = j.title.toLowerCase();
      return (
        (subjectNeedle && sub.includes(subjectNeedle)) ||
        (titleNeedle && title.includes(titleNeedle))
      );
    }).slice(0, 8);

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
    const key = `homework/${homeworkDbId}.mp4`;
    await storage.save(key, bytes);

    // Parent-facing path is our authenticated file route — not a provider URL.
    const videoUrl = `/api/homework/${homeworkDbId}/video/file`;

    const ready = await prisma.homeworkVideo.update({
      where: { id: row.id },
      data: {
        status: VIDEO_STATUS.READY,
        videoUrl,
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

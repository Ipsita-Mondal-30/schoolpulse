'use server';

import { getPrisma } from '@/lib/prisma';
import {
  generateMicroLessonForHomework,
  isLegacyMicroLessonSlides,
} from '@/lib/recap/generate';
import { getTodaysRecap, toPlayerLesson, type MicroLessonForPlayer } from '@/lib/recap/today';

export async function loadTodaysRecapForUi(options?: {
  today?: string;
  section?: string;
}) {
  return getTodaysRecap(options);
}

export async function generateRecapForHomework(homeworkId: string) {
  const result = await generateMicroLessonForHomework(homeworkId);
  if (!result.ok) {
    return {
      ok: false as const,
      reason: result.reason,
      message:
        result.reason === 'ineligible'
          ? "SchoolPulse couldn't create a recap for this homework."
          : result.message || "Recap isn't available yet.",
    };
  }
  return {
    ok: true as const,
    lessonId: result.lesson.id,
    topic: result.lesson.topic,
    subject: result.lesson.subject,
    title: result.lesson.title,
    created: result.created,
  };
}

export async function getMicroLessonForUi(
  lessonId: string,
): Promise<MicroLessonForPlayer | null> {
  const prisma = getPrisma();
  let lesson = await prisma.microLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;

  // Upgrade legacy text-slide lessons to interactive scene schema once.
  if (isLegacyMicroLessonSlides(lesson.slides)) {
    const upgraded = await generateMicroLessonForHomework(lesson.homeworkId, {
      force: true,
    });
    if (upgraded.ok) {
      lesson = upgraded.lesson;
    }
  }

  return toPlayerLesson(lesson);
}

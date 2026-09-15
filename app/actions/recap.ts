'use server';

import { getPrisma } from '@/lib/prisma';
import { generateMicroLessonForHomework } from '@/lib/recap/generate';
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
  const lesson = await prisma.microLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;
  return toPlayerLesson(lesson);
}

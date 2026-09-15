/**
 * generateMicroLessonForHomework — server-side Today's Recap generation.
 * Does not touch NeverSkip sync or homework acknowledgement/completion.
 */

import type { MicroLesson } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import libraryData from '@/data/content-library.json';
import { defaultGenerateLessonAi, type GenerateLessonAiFn } from '@/lib/recap/ai';
import { validateMicroLessonPayload, type MicroLessonAiPayload } from '@/lib/recap/schema';
import {
  extractLearningTopic,
  INSUFFICIENT_TOPIC_REASON,
  type LibraryResourceDetail,
} from '@/lib/recap/topic-extraction';

const libraryResources = (libraryData.resources as LibraryResourceDetail[]).map((r) => ({
  id: r.id,
  title: r.title,
  date: r.date,
  description: r.description,
  subject: r.subject,
}));

export type GenerateMicroLessonResult =
  | { ok: true; lesson: MicroLesson; created: boolean }
  | { ok: false; reason: 'not_found' | 'ineligible' | 'unavailable' | 'invalid'; message: string };

export type GenerateMicroLessonDeps = {
  prisma?: ReturnType<typeof getPrisma>;
  generateAi?: GenerateLessonAiFn;
  libraryResources?: LibraryResourceDetail[];
};

function toSortableDate(raw?: string | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

export function parseLessonSlides(slidesJson: string): MicroLessonAiPayload['slides'] {
  const slides = JSON.parse(slidesJson) as unknown;
  if (!Array.isArray(slides)) throw new Error('Invalid slides JSON');
  return slides as MicroLessonAiPayload['slides'];
}

export function parseLessonQuiz(quizJson: string): MicroLessonAiPayload['quiz'] {
  const quiz = JSON.parse(quizJson) as unknown;
  if (!Array.isArray(quiz) || quiz.length < 3) throw new Error('Invalid quiz JSON');
  for (const item of quiz) {
    if (
      !item ||
      typeof item !== 'object' ||
      !Array.isArray((item as { options?: unknown }).options) ||
      (item as { options: unknown[] }).options.length !== 4 ||
      typeof (item as { answerIndex?: unknown }).answerIndex !== 'number'
    ) {
      throw new Error('Invalid quiz item');
    }
  }
  return quiz as MicroLessonAiPayload['quiz'];
}

export async function generateMicroLessonForHomework(
  homeworkId: string,
  options: { force?: boolean } = {},
  deps: GenerateMicroLessonDeps = {},
): Promise<GenerateMicroLessonResult> {
  const prisma = deps.prisma ?? getPrisma();
  const generateAi = deps.generateAi ?? defaultGenerateLessonAi;
  const resources = deps.libraryResources ?? libraryResources;

  const homework = await prisma.importedHomework.findUnique({
    where: { id: homeworkId },
    include: { microLesson: true },
  });

  if (!homework) {
    return { ok: false, reason: 'not_found', message: 'Homework not found.' };
  }

  if (homework.microLesson && !options.force) {
    return { ok: true, lesson: homework.microLesson, created: false };
  }

  const extraction = extractLearningTopic(
    {
      title: homework.title,
      description: homework.description,
      subject: homework.subjectName,
      date: toSortableDate(homework.homeworkDate),
    },
    resources,
  );

  if (!extraction.eligible) {
    return {
      ok: false,
      reason: 'ineligible',
      message: extraction.reason || INSUFFICIENT_TOPIC_REASON,
    };
  }

  let payload: MicroLessonAiPayload;
  try {
    payload = await generateAi({ extraction });
    payload = validateMicroLessonPayload(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    if (/invalid micro-lesson|answerIndex/i.test(message)) {
      return { ok: false, reason: 'invalid', message };
    }
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Recap isn\'t available yet.',
    };
  }

  try {
    if (homework.microLesson && options.force) {
      const lesson = await prisma.microLesson.update({
        where: { id: homework.microLesson.id },
        data: {
          topic: payload.topic,
          subject: extraction.subject,
          grade: extraction.grade,
          title: payload.title,
          summary: payload.summary,
          slides: JSON.stringify(payload.slides),
          quiz: JSON.stringify(payload.quiz),
        },
      });
      return { ok: true, lesson, created: false };
    }

    const lesson = await prisma.microLesson.create({
      data: {
        homeworkId: homework.id,
        topic: payload.topic,
        subject: extraction.subject,
        grade: extraction.grade,
        title: payload.title,
        summary: payload.summary,
        slides: JSON.stringify(payload.slides),
        quiz: JSON.stringify(payload.quiz),
      },
    });
    return { ok: true, lesson, created: true };
  } catch (err) {
    // Race: unique homeworkId — return existing
    const existing = await prisma.microLesson.findUnique({
      where: { homeworkId: homework.id },
    });
    if (existing) {
      return { ok: true, lesson: existing, created: false };
    }
    const message = err instanceof Error ? err.message : 'Failed to save lesson';
    return { ok: false, reason: 'unavailable', message };
  }
}

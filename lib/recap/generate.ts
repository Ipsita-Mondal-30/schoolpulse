/**
 * generateMicroLessonForHomework — server-side Today's Recap generation.
 * Does not touch NeverSkip sync or homework acknowledgement/completion.
 */

import type { MicroLesson } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import libraryData from '@/data/content-library.json';
import { defaultGenerateLessonAi, type GenerateLessonAiFn } from '@/lib/recap/ai';
import {
  encodeScenesForStorage,
  isSlidesEnvelopeV2,
  microLessonQuizItemSchema,
  parseStoredScenes,
  validateMicroLessonPayload,
  type MicroLessonAiPayload,
  type MicroLessonQuizItem,
  type MicroLessonScene,
  type MicroLessonSlide,
} from '@/lib/recap/schema';
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

/** True when stored slides JSON is legacy v1 (needs force regenerate for interactive player). */
export function isLegacyMicroLessonSlides(slidesJson: string): boolean {
  try {
    const raw = JSON.parse(slidesJson) as unknown;
    return !isSlidesEnvelopeV2(raw);
  } catch {
    return true;
  }
}

export function parseLessonScenes(slidesJson: string): {
  version: 1 | 2;
  scenes: MicroLessonScene[];
  celebrationMessage?: string;
  legacySlides?: MicroLessonSlide[];
} {
  return parseStoredScenes(slidesJson);
}

/** @deprecated Prefer parseLessonScenes — returns legacy slide array or empty for v2. */
export function parseLessonSlides(slidesJson: string): MicroLessonSlide[] {
  const parsed = parseStoredScenes(slidesJson);
  return parsed.legacySlides ?? [];
}

export function parseLessonQuiz(quizJson: string): MicroLessonQuizItem[] {
  const quiz = JSON.parse(quizJson) as unknown;
  if (!Array.isArray(quiz) || quiz.length < 3) throw new Error('Invalid quiz JSON');
  return quiz.map((item, i) => {
    const parsed = microLessonQuizItemSchema.safeParse(item);
    if (parsed.success) return parsed.data;
    // Tolerate legacy 4-option quizzes by trimming to 3 if answer still valid
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { question?: unknown }).question === 'string' &&
      Array.isArray((item as { options?: unknown }).options) &&
      typeof (item as { answerIndex?: unknown }).answerIndex === 'number'
    ) {
      const options = (item as { options: string[] }).options.slice(0, 3);
      const answerIndex = (item as { answerIndex: number }).answerIndex;
      if (options.length === 3 && answerIndex >= 0 && answerIndex <= 2) {
        return {
          question: (item as { question: string }).question,
          options,
          answerIndex,
        };
      }
    }
    throw new Error(`Invalid quiz item at ${i}`);
  });
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
      message: "Recap isn't available yet.",
    };
  }

  const slidesJson = encodeScenesForStorage(payload);
  const quizJson = JSON.stringify(payload.quiz);

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
          slides: slidesJson,
          quiz: quizJson,
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
        slides: slidesJson,
        quiz: quizJson,
      },
    });
    return { ok: true, lesson, created: true };
  } catch (err) {
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

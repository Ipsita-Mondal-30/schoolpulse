/**
 * Helpers for Today's Recap UI and API responses.
 */

import type { MicroLesson, QuizAttempt } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { getIndiaToday } from '@/lib/daily-brief';
import { getAllImportantDates, getDaySchedule } from '@/lib/data';
import { getConfirmedSchoolHoliday } from '@/lib/school-day';
import { toSortableDate } from '@/lib/ui-merge';
import libraryData from '@/data/content-library.json';
import {
  extractLearningTopic,
  type LibraryResourceDetail,
} from '@/lib/recap/topic-extraction';
import { parseLessonQuiz, isLegacyMicroLessonSlides, type GenerateMicroLessonDeps } from '@/lib/recap/generate';
import {
  parseStoredScenes,
  type MicroLessonQuizItem,
  type MicroLessonScene,
  type MicroLessonSlide,
} from '@/lib/recap/schema';

const libraryResources = (libraryData.resources as LibraryResourceDetail[]).map((r) => ({
  id: r.id,
  title: r.title,
  date: r.date,
  description: r.description,
  subject: r.subject,
}));

export type RecapVideoStatus =
  | 'NONE'
  | 'QUEUED'
  | 'PENDING'
  | 'PLANNING'
  | 'GENERATING'
  | 'READY'
  | 'FAILED';

export type RecapTopicSummary = {
  homeworkId: string;
  subject: string;
  topic: string;
  /** Interactive practice MicroLesson id (quiz/cards) — NOT a Veo video. */
  lessonId: string | null;
  questionCount: number | null;
  attempt: { score: number; total: number; completedAt: string } | null;
  /** AI Homework Video (Veo) — separate from interactive practice. */
  videoStatus: RecapVideoStatus;
  videoUrl: string | null;
};

/** @deprecated Prefer RecapTopicSummary — kept for Home card primary topic */
export type TodaysRecapCard = RecapTopicSummary & { eligible: true };

export type TodaysRecapResult = {
  status: 'ready' | 'eligible' | 'empty';
  isHoliday: boolean;
  holidayName: string | null;
  topicCount: number;
  topics: RecapTopicSummary[];
  /** First / best topic for one-tap Start, when any exist */
  card: TodaysRecapCard | null;
};

function parseSections(sectionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sectionsJson) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function sectionMatches(sections: string[], section: string): boolean {
  if (!section) return true;
  if (sections.length === 0) return true;
  return sections.includes(section) || sections.includes('ALL');
}

export function lessonToSlides(slidesJson: string): MicroLessonSlide[] {
  try {
    const parsed = parseStoredScenes(slidesJson);
    return parsed.legacySlides ?? [];
  } catch {
    return [];
  }
}

export type MicroLessonForPlayer = {
  id: string;
  homeworkId: string;
  topic: string;
  subject: string;
  grade: string;
  title: string;
  summary: string;
  /** @deprecated Prefer scenes — legacy v1 only */
  slides: MicroLessonSlide[];
  scenes: MicroLessonScene[];
  celebrationMessage?: string;
  schemaVersion: 1 | 2;
  quiz: Array<{
    question: string;
    options: string[];
    optionHints?: MicroLessonQuizItem['optionHints'];
  }>;
};

export function toPlayerLesson(lesson: MicroLesson): MicroLessonForPlayer {
  const quizInternal = parseLessonQuiz(lesson.quiz);
  let scenes: MicroLessonScene[] = [];
  let celebrationMessage: string | undefined;
  let schemaVersion: 1 | 2 = 1;
  let slides: MicroLessonSlide[] = [];
  try {
    const parsed = parseStoredScenes(lesson.slides);
    schemaVersion = parsed.version;
    scenes = parsed.scenes;
    celebrationMessage = parsed.celebrationMessage;
    slides = parsed.legacySlides ?? [];
  } catch {
    slides = [];
  }
  return {
    id: lesson.id,
    homeworkId: lesson.homeworkId,
    topic: lesson.topic,
    subject: lesson.subject,
    grade: lesson.grade,
    title: lesson.title,
    summary: lesson.summary,
    slides,
    scenes,
    celebrationMessage,
    schemaVersion,
    quiz: quizInternal.map((q) => ({
      question: q.question,
      options: q.options,
      optionHints: q.optionHints,
    })),
  };
}

/**
 * List today's eligible ImportedHomework topics for Recap (due today or sent today).
 * Does not call Gemini or invent topics. Always returns a result suitable for Home.
 */
export async function getTodaysRecap(
  options: { today?: string; section?: string } = {},
  deps: GenerateMicroLessonDeps = {},
): Promise<TodaysRecapResult> {
  const prisma = deps.prisma ?? getPrisma();
  const today = options.today || getIndiaToday();
  const section = options.section || 'I-A';
  const resources = deps.libraryResources ?? libraryResources;

  const holiday = getConfirmedSchoolHoliday(
    today,
    getAllImportantDates(),
    getDaySchedule(today),
  );

  const rows = await prisma.importedHomework.findMany({
    where: {
      OR: [{ dueDate: today }, { homeworkDate: today }],
    },
    include: {
      microLesson: {
        include: {
          attempts: { orderBy: { completedAt: 'desc' }, take: 1 },
        },
      },
      homeworkVideo: {
        select: { status: true, videoUrl: true },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { homeworkDate: 'desc' }],
    take: 40,
  });

  const candidates = rows.filter((hw) =>
    sectionMatches(parseSections(hw.sectionsJson), section),
  );

  const ranked = [...candidates].sort((a, b) => {
    const aDue = toSortableDate(a.dueDate) === today ? 0 : 1;
    const bDue = toSortableDate(b.dueDate) === today ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    if (a.microLesson && !b.microLesson) return -1;
    if (!a.microLesson && b.microLesson) return 1;
    return 0;
  });

  const topics: RecapTopicSummary[] = [];
  const seenHomework = new Set<string>();

  function videoFields(hw: (typeof ranked)[number]): Pick<
    RecapTopicSummary,
    'videoStatus' | 'videoUrl'
  > {
    const st = (hw.homeworkVideo?.status || 'NONE') as RecapVideoStatus;
    const ready =
      st === 'READY' && hw.homeworkVideo?.videoUrl
        ? hw.homeworkVideo.videoUrl
        : null;
    return {
      videoStatus: hw.homeworkVideo ? st : 'NONE',
      videoUrl: ready,
    };
  }

  for (const hw of ranked) {
    if (seenHomework.has(hw.id)) continue;

    if (hw.microLesson) {
      seenHomework.add(hw.id);
      const attempt = hw.microLesson.attempts[0] ?? null;
      let questionCount = 0;
      try {
        questionCount = parseLessonQuiz(hw.microLesson.quiz).length;
      } catch {
        questionCount = 0;
      }
      topics.push({
        homeworkId: hw.id,
        subject: hw.microLesson.subject,
        topic: hw.microLesson.topic,
        lessonId: hw.microLesson.id,
        questionCount,
        attempt: attempt
          ? {
              score: attempt.score,
              total: attempt.total,
              completedAt: attempt.completedAt.toISOString(),
            }
          : null,
        ...videoFields(hw),
      });
      continue;
    }

    const extraction = extractLearningTopic(
      {
        title: hw.title,
        description: hw.description,
        subject: hw.subjectName,
        date: toSortableDate(hw.homeworkDate),
      },
      resources,
    );
    if (!extraction.eligible) continue;

    seenHomework.add(hw.id);
    topics.push({
      homeworkId: hw.id,
      subject: extraction.subject,
      topic: extraction.topic,
      lessonId: null,
      questionCount: null,
      attempt: null,
      ...videoFields(hw),
    });
  }

  const primary = topics[0]
    ? ({ ...topics[0], eligible: true } as TodaysRecapCard)
    : null;

  const hasReady = topics.some((t) => t.lessonId);
  const status: TodaysRecapResult['status'] =
    topics.length === 0 ? 'empty' : hasReady ? 'ready' : 'eligible';

  return {
    status,
    isHoliday: Boolean(holiday),
    holidayName: holiday?.name ?? null,
    topicCount: topics.length,
    topics,
    card: primary,
  };
}

export async function recordQuizAttempt(
  lessonId: string,
  answers: number[],
  deps: GenerateMicroLessonDeps = {},
): Promise<
  | { ok: true; attempt: QuizAttempt; score: number; total: number }
  | { ok: false; message: string }
> {
  const prisma = deps.prisma ?? getPrisma();
  const lesson = await prisma.microLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: 'Lesson not found.' };

  let quiz: MicroLessonQuizItem[];
  try {
    quiz = parseLessonQuiz(lesson.quiz);
  } catch {
    return { ok: false, message: 'Lesson quiz is invalid.' };
  }

  const total = quiz.length;
  let score = 0;
  for (let i = 0; i < total; i++) {
    if (answers[i] === quiz[i].answerIndex) score += 1;
  }

  const attempt = await prisma.quizAttempt.create({
    data: { lessonId, score, total },
  });

  return { ok: true, attempt, score, total };
}

export async function checkQuizAnswer(
  lessonId: string,
  questionIndex: number,
  answerIndex: number,
  deps: GenerateMicroLessonDeps = {},
): Promise<{ ok: true; correct: boolean } | { ok: false; message: string }> {
  const prisma = deps.prisma ?? getPrisma();
  const lesson = await prisma.microLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: 'Lesson not found.' };
  let quiz: MicroLessonQuizItem[];
  try {
    quiz = parseLessonQuiz(lesson.quiz);
  } catch {
    return { ok: false, message: 'Lesson quiz is invalid.' };
  }
  const item = quiz[questionIndex];
  if (!item) return { ok: false, message: 'Question not found.' };
  return { ok: true, correct: answerIndex === item.answerIndex };
}

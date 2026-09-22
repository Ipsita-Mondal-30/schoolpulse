import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertGeminiApiKeyConfigured,
  DEFAULT_GEMINI_MODEL,
  getGeminiModelId,
} from '@/lib/recap/ai';
import { generateMicroLessonForHomework } from '@/lib/recap/generate';
import type { MicroLessonAiPayload } from '@/lib/recap/schema';
import { getTodaysRecap } from '@/lib/recap/today';

function samplePayload(): MicroLessonAiPayload {
  return {
    topic: 'Opposite Words',
    title: "Let's learn Opposite Words!",
    summary: 'Hot and cold are opposites.',
    scenes: [
      { type: 'intro', message: "Hey! Let's learn!", visualHint: 'star' },
      {
        type: 'visual_teach',
        headline: 'Opposites!',
        bits: ['hot', 'cold'],
        visualHint: 'abc',
      },
      {
        type: 'examples',
        items: [
          { label: 'hot ↔ cold' },
          { label: 'big ↔ small' },
        ],
      },
      {
        type: 'choice',
        prompt: 'Opposite of hot?',
        options: ['cold', 'warm', 'sun'],
        answerIndex: 0,
      },
      {
        type: 'find',
        prompt: 'Find small',
        options: ['tall', 'small', 'wide'],
        answerIndex: 1,
      },
    ],
    quiz: [
      { question: 'Opposite of hot?', options: ['cold', 'warm', 'sun'], answerIndex: 0 },
      { question: 'Opposite of big?', options: ['tall', 'small', 'wide'], answerIndex: 1 },
      { question: 'Opposite of happy?', options: ['glad', 'sad', 'fun'], answerIndex: 1 },
    ],
  };
}

describe('Gemini recap AI configuration', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('uses default model when GEMINI_MODEL is unset', () => {
    delete process.env.GEMINI_MODEL;
    expect(getGeminiModelId()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('uses GEMINI_MODEL when set', () => {
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    expect(getGeminiModelId()).toBe('gemini-2.0-flash');
  });

  it('throws when GOOGLE_GENERATIVE_AI_API_KEY is missing', () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(() => assertGeminiApiKeyConfigured()).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });

  it('does not require OpenAI for the Recap generation flow', async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const prisma = {
      importedHomework: {
        findUnique: async () => ({
          id: 'hw-gemini',
          title: 'Learn opposite words.',
          description: '',
          subjectName: 'English',
          homeworkDate: '2026-09-15',
          microLesson: null,
        }),
      },
      microLesson: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'lesson-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async () => null,
      },
    };

    const result = await generateMicroLessonForHomework(
      'hw-gemini',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => samplePayload(),
        libraryResources: [],
      },
    );

    expect(result.ok).toBe(true);
  });
});

describe('Gemini generation failure handling', () => {
  it('returns unavailable when generateAi fails without saving a lesson', async () => {
    const prisma = {
      importedHomework: {
        findUnique: async () => ({
          id: 'hw-fail',
          title: 'Learn opposite words.',
          description: '',
          subjectName: 'English',
          homeworkDate: '2026-09-15',
          microLesson: null,
        }),
      },
      microLesson: {
        findUnique: async () => null,
        create: async () => {
          throw new Error('should not persist');
        },
      },
    };

    const result = await generateMicroLessonForHomework(
      'hw-fail',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => {
          throw new Error('Gemini API error');
        },
        libraryResources: [],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unavailable');
      expect(result.message).toContain("isn't available");
    }
  });
});

describe('Gemini structured output validation', () => {
  it('rejects invalid structured payload before persist', async () => {
    const prisma = {
      importedHomework: {
        findUnique: async () => ({
          id: 'hw-invalid',
          title: 'Learn opposite words.',
          description: '',
          subjectName: 'English',
          homeworkDate: '2026-09-15',
          microLesson: null,
        }),
      },
      microLesson: {
        findUnique: async () => null,
        create: vi.fn(),
      },
    };

    const result = await generateMicroLessonForHomework(
      'hw-invalid',
      {},
      {
        prisma: prisma as never,
        generateAi: async () =>
          ({
            topic: 'X',
            title: 'Y',
            summary: 'Z',
            scenes: [],
            quiz: [],
          }) as never,
        libraryResources: [],
      },
    );

    expect(result.ok).toBe(false);
    expect(prisma.microLesson.create).not.toHaveBeenCalled();
  });
});

describe('getTodaysRecap home payload', () => {
  it('returns empty status with topicCount 0 instead of hiding Home entry', async () => {
    const prisma = {
      importedHomework: {
        findMany: async () => [],
      },
    };
    const result = await getTodaysRecap(
      { today: '2026-09-15', section: 'I-A' },
      { prisma: prisma as never, libraryResources: [] },
    );
    expect(result.status).toBe('empty');
    expect(result.topicCount).toBe(0);
    expect(result.topics).toEqual([]);
    expect(result.card).toBeNull();
  });

  it('lists eligible topics for Home count copy', async () => {
    const prisma = {
      importedHomework: {
        findMany: async () => [
          {
            id: 'hw-a',
            title: 'Learn opposite words.',
            description: '',
            subjectName: 'English',
            homeworkDate: '2026-09-15',
            dueDate: '2026-09-15',
            sectionsJson: '["I-A"]',
            microLesson: null,
          },
          {
            id: 'hw-b',
            title: 'Practice addition up to 20',
            description: '',
            subjectName: 'Mathematics',
            homeworkDate: '2026-09-15',
            dueDate: null,
            sectionsJson: '["I-A"]',
            microLesson: null,
          },
          {
            id: 'hw-c',
            title: 'Complete page 42',
            description: '',
            subjectName: 'English',
            homeworkDate: '2026-09-15',
            dueDate: null,
            sectionsJson: '["I-A"]',
            microLesson: null,
          },
        ],
      },
    };
    const result = await getTodaysRecap(
      { today: '2026-09-15', section: 'I-A' },
      { prisma: prisma as never, libraryResources: [] },
    );
    expect(result.topicCount).toBe(2);
    expect(result.status).toBe('eligible');
    expect(result.topics.map((t) => t.homeworkId)).toEqual(['hw-a', 'hw-b']);
    expect(result.card?.homeworkId).toBe('hw-a');
  });
});

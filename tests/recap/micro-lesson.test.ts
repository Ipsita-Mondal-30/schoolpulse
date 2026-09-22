import { describe, expect, it } from 'vitest';
import {
  extractLearningTopic,
  findHomeworkLibraryResource,
  INSUFFICIENT_TOPIC_REASON,
} from '@/lib/recap/topic-extraction';
import {
  scoreQuizAnswers,
  validateMicroLessonPayload,
  type MicroLessonAiPayload,
} from '@/lib/recap/schema';
import { generateMicroLessonForHomework } from '@/lib/recap/generate';
import { recordQuizAttempt } from '@/lib/recap/today';

function samplePayload(overrides: Partial<MicroLessonAiPayload> = {}): MicroLessonAiPayload {
  return {
    topic: 'Opposite Words',
    title: "Let's learn Opposite Words!",
    summary: 'Hot and cold are opposites.',
    celebrationMessage: "You're a star!",
    scenes: [
      {
        type: 'intro',
        message: "Hey! Let's learn something fun!",
        visualHint: 'star',
        durationMs: 3000,
      },
      {
        type: 'visual_teach',
        headline: 'Opposites mean different!',
        bits: ['hot', 'cold', 'big', 'small'],
        visualHint: 'abc',
      },
      {
        type: 'examples',
        items: [
          { label: 'hot ↔ cold', visualHint: 'sun' },
          { label: 'big ↔ small', visualHint: 'star' },
          { label: 'happy ↔ sad', visualHint: 'heart' },
        ],
      },
      {
        type: 'choice',
        prompt: 'Which is the opposite of hot?',
        options: ['cold', 'warm', 'sun'],
        answerIndex: 0,
        optionHints: ['moon', 'sun', 'star'],
      },
      {
        type: 'find',
        prompt: 'Find the opposite of big',
        options: ['tall', 'small', 'wide'],
        answerIndex: 1,
      },
    ],
    quiz: [
      {
        question: 'Opposite of hot?',
        options: ['cold', 'warm', 'sun'],
        answerIndex: 0,
      },
      {
        question: 'Opposite of big?',
        options: ['tall', 'small', 'wide'],
        answerIndex: 1,
      },
      {
        question: 'Happy is the opposite of…',
        options: ['glad', 'sad', 'fun'],
        answerIndex: 1,
      },
    ],
    ...overrides,
  };
}

function mockPrisma(state: {
  homework?: Record<string, unknown> | null;
  lesson?: Record<string, unknown> | null;
  attempts?: unknown[];
  acknowledgements?: unknown[];
}) {
  const attempts = state.attempts ?? [];
  const acknowledgements = state.acknowledgements ?? [];
  let lesson = state.lesson ?? null;
  const homework = state.homework;

  return {
    importedHomework: {
      findUnique: async () => {
        if (!homework) return null;
        return { ...homework, microLesson: lesson };
      },
    },
    microLesson: {
      findUnique: async ({ where }: { where: { id?: string; homeworkId?: string } }) => {
        if (!lesson) return null;
        if (where.id && (lesson as { id: string }).id !== where.id) return null;
        if (where.homeworkId && (lesson as { homeworkId: string }).homeworkId !== where.homeworkId) {
          return null;
        }
        return lesson;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        lesson = { id: 'lesson-1', ...data, createdAt: new Date(), updatedAt: new Date() };
        return lesson;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        lesson = { ...(lesson as object), ...data };
        return lesson;
      },
    },
    quizAttempt: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `attempt-${attempts.length + 1}`,
          completedAt: new Date(),
          ...data,
        };
        attempts.push(row);
        return row;
      },
    },
    homeworkAcknowledgement: {
      create: async ({ data }: { data: unknown }) => {
        acknowledgements.push(data);
        return data;
      },
      findMany: async () => acknowledgements,
    },
    _state: { get lesson() { return lesson; }, attempts, acknowledgements },
  };
}

describe('topic extraction', () => {
  it('marks Learn opposite words as eligible', () => {
    const result = extractLearningTopic({
      title: 'Learn opposite words.',
      description: '',
      subject: 'English',
      date: '2026-09-15',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toContain('opposite');
      expect(result.subject).toBe('English');
    }
  });

  it('marks Practice addition up to 20 as eligible', () => {
    const result = extractLearningTopic({
      title: 'Practice addition up to 20',
      description: 'Revise sums.',
      subject: 'Mathematics',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toMatch(/addition/);
    }
  });

  it('rejects Complete page 42 as ineligible', () => {
    const result = extractLearningTopic({
      title: 'Complete page 42',
      description: '',
      subject: 'English',
    });
    expect(result).toEqual({
      eligible: false,
      reason: INSUFFICIENT_TOPIC_REASON,
    });
  });

  it('extracts उ की मात्रा from Do Page logistics notes', () => {
    const result = extractLearningTopic({
      title: 'ए ki Matra sulekh pustika',
      description:
        "Today's Hindi Homework (15/09/26) Do Page No 12( ए की मात्रा) in Sulekh pustika. Submission of book -16/9/26 Thankyou.",
      subject: 'HINDI',
      date: '2026-09-15',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic).toMatch(/मात्रा|matra/i);
      expect(result.subject).toBe('HINDI');
    }
  });

  it('extracts topic from title ए ki Matra without inventing page content', () => {
    const result = extractLearningTopic({
      title: 'ए ki Matra sulekh pustika',
      description: '',
      subject: 'HINDI',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toContain('matra');
    }
  });

  it('extracts Learn poem - Bitiya Aayi as an eligible poem topic', () => {
    const result = extractLearningTopic({
      title: 'Learn poem- Bitiya Aayi',
      description:
        "Today's Hindi Homework (17/09/26) Learn poem - Bitiya Aayi 1-4 Lines from Textbook page no 32",
      subject: 'HINDI',
      date: '2026-09-17',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toContain('bitiya');
      expect(result.topic.toLowerCase()).toMatch(/poem/);
    }
  });

  it('keeps Chapter 10 Shapes and Patterns eligible', () => {
    const result = extractLearningTopic({
      title: 'Chapter-10 Shapes and Patterns',
      description: '',
      subject: 'MATHEMATICS',
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toMatch(/shape|pattern|chapter/);
    }
  });

  it('prefers linked Content Library material when uniquely matched', () => {
    const resources = [
      {
        id: 'cl-opp',
        title: 'Opposite words worksheet',
        date: '2026-09-15',
        description: 'Learn opposite words: hot cold big small',
        subject: 'ENGLISH',
      },
    ];
    const match = findHomeworkLibraryResource(
      {
        title: 'Opposite words worksheet',
        description: 'Please revise.',
        subject: 'English',
        date: '2026-09-15',
      },
      resources,
    );
    expect(match?.id).toBe('cl-opp');

    const result = extractLearningTopic(
      {
        title: 'Opposite words worksheet',
        description: 'Please revise.',
        subject: 'English',
        date: '2026-09-15',
      },
      resources,
    );
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.libraryResourceId).toBe('cl-opp');
      expect(result.sourceSnippets[0]).toContain('hot cold');
    }
  });
});

describe('micro-lesson schema validation', () => {
  it('rejects invalid AI JSON', () => {
    expect(() =>
      validateMicroLessonPayload({
        topic: 'X',
        title: 'Y',
        summary: 'Z',
        scenes: [{ type: 'intro', message: 'hi' }],
        quiz: [{ question: 'q', options: ['a'], answerIndex: 0 }],
      }),
    ).toThrow(/Invalid micro-lesson/);
  });

  it('accepts interactive scene payload for a मात्रा-shaped topic', () => {
    const payload = samplePayload({
      topic: 'ए की मात्रा',
      title: 'ए की मात्रा Practice',
      summary: 'Learn ए की मात्रा with short examples.',
      scenes: [
        { type: 'intro', message: 'Hey! Let’s learn ए की मात्रा!', visualHint: 'letter' },
        {
          type: 'visual_teach',
          headline: 'ए की मात्रा makes a sound!',
          bits: ['ए', 'के', 'से'],
          visualHint: 'letter',
        },
        {
          type: 'examples',
          items: [
            { label: 'के', visualHint: 'letter' },
            { label: 'से', visualHint: 'letter' },
            { label: 'ने', visualHint: 'letter' },
          ],
        },
        {
          type: 'choice',
          prompt: 'Which word has ए की मात्रा?',
          options: ['के', 'क', 'कि'],
          answerIndex: 0,
        },
        {
          type: 'find',
          prompt: 'Find ए की मात्रा',
          options: ['का', 'के', 'कि'],
          answerIndex: 1,
        },
      ],
    });
    expect(validateMicroLessonPayload(payload).topic).toContain('मात्रा');
  });

  it('calculates quiz score correctly', () => {
    const quiz = samplePayload().quiz;
    expect(scoreQuizAnswers(quiz, [0, 1, 1])).toEqual({ score: 3, total: 3 });
    expect(scoreQuizAnswers(quiz, [1, 1, 0])).toEqual({ score: 1, total: 3 });
  });
});

describe('generateMicroLessonForHomework', () => {
  it('generates a lesson for Learn opposite words', async () => {
    const prisma = mockPrisma({
      homework: {
        id: 'hw-1',
        title: 'Learn opposite words.',
        description: '',
        subjectName: 'English',
        homeworkDate: '2026-09-15',
      },
    });

    const result = await generateMicroLessonForHomework(
      'hw-1',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => samplePayload(),
        libraryResources: [],
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.lesson.topic).toBe('Opposite Words');
      expect(result.lesson.homeworkId).toBe('hw-1');
    }
  });

  it('generates a lesson for Practice addition up to 20', async () => {
    const prisma = mockPrisma({
      homework: {
        id: 'hw-2',
        title: 'Practice addition up to 20',
        description: 'Sums within 20',
        subjectName: 'Mathematics',
        homeworkDate: '2026-09-15',
      },
    });

    const result = await generateMicroLessonForHomework(
      'hw-2',
      {},
      {
        prisma: prisma as never,
        generateAi: async () =>
          samplePayload({
            topic: 'Addition Up To 20',
            title: 'Practice addition',
            summary: 'Add numbers up to 20.',
          }),
        libraryResources: [],
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lesson.topic).toBe('Addition Up To 20');
  });

  it('does not generate for Complete page 42', async () => {
    const prisma = mockPrisma({
      homework: {
        id: 'hw-3',
        title: 'Complete page 42',
        description: '',
        subjectName: 'English',
        homeworkDate: '2026-09-15',
      },
    });
    let aiCalled = false;
    const result = await generateMicroLessonForHomework(
      'hw-3',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => {
          aiCalled = true;
          return samplePayload();
        },
        libraryResources: [],
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ineligible');
    expect(aiCalled).toBe(false);
    expect(prisma._state.lesson).toBeNull();
  });

  it('returns existing MicroLesson without duplicate generation', async () => {
    const existing = {
      id: 'lesson-existing',
      homeworkId: 'hw-1',
      topic: 'Opposite Words',
      subject: 'English',
      grade: '1',
      title: 'Existing',
      summary: 'Existing',
      slides: '[]',
      quiz: '[]',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = mockPrisma({
      homework: {
        id: 'hw-1',
        title: 'Learn opposite words.',
        description: '',
        subjectName: 'English',
        homeworkDate: '2026-09-15',
      },
      lesson: existing,
    });
    let aiCalled = false;
    const result = await generateMicroLessonForHomework(
      'hw-1',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => {
          aiCalled = true;
          return samplePayload();
        },
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.lesson.id).toBe('lesson-existing');
    }
    expect(aiCalled).toBe(false);
  });

  it('rejects invalid AI JSON without saving', async () => {
    const prisma = mockPrisma({
      homework: {
        id: 'hw-1',
        title: 'Learn opposite words.',
        description: '',
        subjectName: 'English',
        homeworkDate: '2026-09-15',
      },
    });
    const result = await generateMicroLessonForHomework(
      'hw-1',
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
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['invalid', 'unavailable']).toContain(result.reason);
    expect(prisma._state.lesson).toBeNull();
  });

  it('returns unavailable on AI API failure without breaking homework flow', async () => {
    const prisma = mockPrisma({
      homework: {
        id: 'hw-1',
        title: 'Learn opposite words.',
        description: '',
        subjectName: 'English',
        homeworkDate: '2026-09-15',
      },
    });
    const result = await generateMicroLessonForHomework(
      'hw-1',
      {},
      {
        prisma: prisma as never,
        generateAi: async () => {
          throw new Error('network down');
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unavailable');
      expect(result.message).toContain("isn't available");
    }
    expect(prisma._state.lesson).toBeNull();
  });
});

describe('quiz attempt vs homework acknowledgement', () => {
  it('records quiz score without creating homework acknowledgement', async () => {
    const quiz = samplePayload().quiz;
    const prisma = mockPrisma({
      lesson: {
        id: 'lesson-1',
        homeworkId: 'hw-1',
        quiz: JSON.stringify(quiz),
      },
    });

    const result = await recordQuizAttempt('lesson-1', [0, 1, 1], {
      prisma: prisma as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBe(3);
      expect(result.total).toBe(3);
    }
    expect(prisma._state.attempts).toHaveLength(1);
    expect(prisma._state.acknowledgements).toHaveLength(0);
  });

  it('parent acknowledgement path does not create QuizAttempt or MicroLesson', async () => {
    // Simulate acknowledgement-only write (no recap side effects)
    const prisma = mockPrisma({});
    await prisma.homeworkAcknowledgement.create({
      data: { userId: 'u1', homeworkId: 'hw-1' },
    });
    expect(prisma._state.acknowledgements).toHaveLength(1);
    expect(prisma._state.attempts).toHaveLength(0);
    expect(prisma._state.lesson).toBeNull();
  });
});

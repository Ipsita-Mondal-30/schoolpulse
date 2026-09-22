import { z } from 'zod';

/** Visual tokens for the React player — never HTML/CSS from the model. */
export const visualHintSchema = z.enum([
  'star',
  'letter',
  'book',
  'pencil',
  'shape_circle',
  'shape_square',
  'shape_triangle',
  'bug',
  'caterpillar',
  'sun',
  'moon',
  'heart',
  'hand',
  'abc',
  'number',
  'leaf',
  'sparkle',
]);

export type VisualHint = z.infer<typeof visualHintSchema>;

const shortText = z.string().min(1).max(80);
const mediumText = z.string().min(1).max(160);

export const introSceneSchema = z.object({
  type: z.literal('intro'),
  message: mediumText,
  visualHint: visualHintSchema.optional(),
  durationMs: z.number().int().min(2000).max(8000).optional(),
});

export const visualTeachSceneSchema = z.object({
  type: z.literal('visual_teach'),
  headline: mediumText,
  bits: z.array(shortText).min(1).max(6),
  visualHint: visualHintSchema.optional(),
});

export const examplesSceneSchema = z.object({
  type: z.literal('examples'),
  items: z
    .array(
      z.object({
        label: shortText,
        visualHint: visualHintSchema.optional(),
      }),
    )
    .min(2)
    .max(4),
});

export const choiceSceneSchema = z.object({
  type: z.literal('choice'),
  prompt: mediumText,
  options: z.array(shortText).length(3),
  answerIndex: z.number().int().min(0).max(2),
  optionHints: z.array(visualHintSchema).length(3).optional(),
});

export const findSceneSchema = z.object({
  type: z.literal('find'),
  prompt: mediumText,
  options: z.array(shortText).length(3),
  answerIndex: z.number().int().min(0).max(2),
  optionHints: z.array(visualHintSchema).length(3).optional(),
});

export const matchSceneSchema = z.object({
  type: z.literal('match'),
  prompt: mediumText,
  pairs: z
    .array(
      z.object({
        left: shortText,
        right: shortText,
      }),
    )
    .min(2)
    .max(4),
});

export const celebrationSceneSchema = z.object({
  type: z.literal('celebration'),
  message: mediumText,
});

export const microLessonSceneSchema = z.discriminatedUnion('type', [
  introSceneSchema,
  visualTeachSceneSchema,
  examplesSceneSchema,
  choiceSceneSchema,
  findSceneSchema,
  matchSceneSchema,
  celebrationSceneSchema,
]);

export type MicroLessonScene = z.infer<typeof microLessonSceneSchema>;

export const microLessonQuizItemSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(80)).length(3),
  answerIndex: z.number().int().min(0).max(2),
  optionHints: z.array(visualHintSchema).length(3).optional(),
});

export type MicroLessonQuizItem = z.infer<typeof microLessonQuizItemSchema>;

export const microLessonAiSchema = z
  .object({
    topic: z.string().min(1).max(120),
    title: z.string().min(1).max(160),
    summary: z.string().min(1).max(280),
    celebrationMessage: z.string().min(1).max(120).optional(),
    scenes: z.array(microLessonSceneSchema).min(5).max(10),
    quiz: z.array(microLessonQuizItemSchema).length(3),
  })
  .superRefine((data, ctx) => {
    const types = new Set(data.scenes.map((s) => s.type));
    if (!types.has('intro')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scenes must include intro' });
    }
    if (!types.has('visual_teach')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scenes must include visual_teach' });
    }
    if (!types.has('examples')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scenes must include examples' });
    }
    if (!types.has('choice') && !types.has('find') && !types.has('match')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scenes must include choice, find, or match',
      });
    }
    for (const scene of data.scenes) {
      if (scene.type === 'choice' || scene.type === 'find') {
        if (scene.answerIndex < 0 || scene.answerIndex >= scene.options.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid ${scene.type} answerIndex`,
          });
        }
      }
    }
    for (const item of data.quiz) {
      if (item.answerIndex < 0 || item.answerIndex >= item.options.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid quiz answerIndex' });
      }
    }
  });

export type MicroLessonAiPayload = z.infer<typeof microLessonAiSchema>;

/** Persisted in MicroLesson.slides column. */
export type MicroLessonSlidesEnvelopeV2 = {
  version: 2;
  scenes: MicroLessonScene[];
  celebrationMessage?: string;
};

/** Legacy v1 slide shape (pre-interactive player). */
export const legacySlideTypeSchema = z.enum(['intro', 'example', 'explanation', 'practice']);
export const legacyMicroLessonSlideSchema = z.object({
  type: legacySlideTypeSchema,
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(500),
  word: z.string().max(80).optional(),
  opposite: z.string().max(80).optional(),
});
export type MicroLessonSlide = z.infer<typeof legacyMicroLessonSlideSchema>;

export function validateMicroLessonPayload(raw: unknown): MicroLessonAiPayload {
  const parsed = microLessonAiSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid micro-lesson payload: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function isSlidesEnvelopeV2(raw: unknown): raw is MicroLessonSlidesEnvelopeV2 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return obj.version === 2 && Array.isArray(obj.scenes);
}

export function encodeScenesForStorage(payload: MicroLessonAiPayload): string {
  const envelope: MicroLessonSlidesEnvelopeV2 = {
    version: 2,
    scenes: payload.scenes,
    celebrationMessage: payload.celebrationMessage,
  };
  return JSON.stringify(envelope);
}

export function parseStoredScenes(slidesJson: string): {
  version: 1 | 2;
  scenes: MicroLessonScene[];
  celebrationMessage?: string;
  legacySlides?: MicroLessonSlide[];
} {
  const raw = JSON.parse(slidesJson) as unknown;
  if (isSlidesEnvelopeV2(raw)) {
    const scenes = z.array(microLessonSceneSchema).parse(raw.scenes);
    return {
      version: 2,
      scenes,
      celebrationMessage: raw.celebrationMessage,
    };
  }
  if (Array.isArray(raw)) {
    const legacySlides = z.array(legacyMicroLessonSlideSchema).parse(raw);
    return {
      version: 1,
      scenes: [],
      legacySlides,
    };
  }
  throw new Error('Unrecognized slides JSON');
}

export function scoreQuizAnswers(
  quiz: MicroLessonQuizItem[],
  answers: number[],
): { score: number; total: number } {
  const total = quiz.length;
  let score = 0;
  for (let i = 0; i < total; i++) {
    if (answers[i] === quiz[i]?.answerIndex) score += 1;
  }
  return { score, total };
}

/** @deprecated Prefer scene types — kept for transitional imports in tests. */
export const slideTypeSchema = legacySlideTypeSchema;
export const microLessonSlideSchema = legacyMicroLessonSlideSchema;

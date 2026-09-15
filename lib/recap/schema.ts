import { z } from 'zod';

export const slideTypeSchema = z.enum(['intro', 'example', 'explanation', 'practice']);

export const microLessonSlideSchema = z.object({
  type: slideTypeSchema,
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(500),
  word: z.string().max(80).optional(),
  opposite: z.string().max(80).optional(),
});

export const microLessonQuizItemSchema = z.object({
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(120)).length(4),
  answerIndex: z.number().int().min(0).max(3),
});

export const microLessonAiSchema = z.object({
  topic: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(400),
  slides: z.array(microLessonSlideSchema).min(2).max(8),
  quiz: z.array(microLessonQuizItemSchema).min(3).max(5),
});

export type MicroLessonSlide = z.infer<typeof microLessonSlideSchema>;
export type MicroLessonQuizItem = z.infer<typeof microLessonQuizItemSchema>;
export type MicroLessonAiPayload = z.infer<typeof microLessonAiSchema>;

/** Validate AI JSON before persist. Rejects malformed / out-of-range answers. */
export function validateMicroLessonPayload(raw: unknown): MicroLessonAiPayload {
  const parsed = microLessonAiSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid micro-lesson payload: ${parsed.error.message}`);
  }
  for (const item of parsed.data.quiz) {
    if (item.answerIndex < 0 || item.answerIndex >= item.options.length) {
      throw new Error('Invalid quiz answerIndex');
    }
  }
  return parsed.data;
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

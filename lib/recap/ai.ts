/**
 * Server-only Google Gemini structured generation for Today's Recap.
 * Never import from client components.
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import {
  microLessonAiSchema,
  validateMicroLessonPayload,
  type MicroLessonAiPayload,
} from '@/lib/recap/schema';
import type { TopicExtractionResult } from '@/lib/recap/topic-extraction';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/** Retired preview ids still present in some local .env files. */
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-1.5-flash': 'gemini-3.6-flash',
};

export function getGeminiModelId(): string {
  const configured = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return GEMINI_MODEL_ALIASES[configured] || configured;
}

export function assertGeminiApiKeyConfigured(): void {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  }
}

export type GenerateLessonAiFn = (input: {
  extraction: Extract<TopicExtractionResult, { eligible: true }>;
}) => Promise<MicroLessonAiPayload>;

function buildSystemPrompt(): string {
  return `You create Grade 1 interactive micro-lessons for SchoolPulse "Today's Recap".

The React app turns your JSON into an animated mini-game. You provide CONTENT only.

Rules:
- Use ONLY the school source snippets. Never invent school-specific facts.
- Never return HTML, CSS, React, or code.
- Child-friendly, minimal text, large ideas — not paragraphs.
- scenes (5–10) must include: intro, visual_teach, examples, and at least one of choice | find | match.
- intro.message: short hook (one sentence).
- visual_teach: one headline + 1–6 short "bits" (words/letters/phrases), not sentences.
- examples: 2–4 short labels with optional visualHint.
- choice/find: prompt + exactly 3 options + answerIndex 0–2.
- match: 2–4 left/right pairs (tap-to-match game).
- Pick interaction that fits the topic (do not force match if choice/find is clearer).
- visualHint values only from: star, letter, book, pencil, shape_circle, shape_square, shape_triangle, bug, caterpillar, sun, moon, heart, hand, abc, number, leaf, sparkle.
- quiz: exactly 3 questions, each with exactly 3 short options and answerIndex 0–2. Test only what scenes taught.
- Optional celebrationMessage: short praise (UI adds score).

Return structured JSON matching the schema.`;
}

export const defaultGenerateLessonAi: GenerateLessonAiFn = async ({ extraction }) => {
  assertGeminiApiKeyConfigured();

  const sources = extraction.sourceSnippets.join('\n---\n');

  const result = await generateObject({
    // @ts-expect-error version mismatch between ai core and provider
    model: google(getGeminiModelId()),
    schema: microLessonAiSchema,
    system: buildSystemPrompt(),
    prompt: `Subject: ${extraction.subject}
Grade: ${extraction.grade}
Topic (from school sources): ${extraction.topic}

School source material (ground truth):
${sources}

Generate an interactive scene-based micro-lesson and 3-question quiz grounded only in the material above.`,
  });

  return validateMicroLessonPayload(result.object);
};

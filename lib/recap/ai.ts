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

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiModelId(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured || DEFAULT_GEMINI_MODEL;
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
  return `You create short Grade 1 micro-lessons for SchoolPulse "Today's Recap".

Rules:
- Content is AI-generated support material, not official school content.
- Use ONLY the school source snippets provided. Never invent school-specific facts.
- Never contradict school-provided material.
- Keep the lesson 1–3 minutes: minimal text, clear examples, child-friendly.
- Quiz (3–5 questions) must test ONLY information introduced in the slides.
- Each quiz item needs exactly 4 options; answerIndex is 0–3.
- Slide types: intro | example | explanation | practice.
- Optional word/opposite fields for antonym-style examples.

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

Generate a micro-lesson and quiz grounded only in the material above.`,
  });

  return validateMicroLessonPayload(result.object);
};

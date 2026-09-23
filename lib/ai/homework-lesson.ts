/**
 * Gemini lesson planner for homework → Veo (server-only).
 * Grounded in homework + Content Library; never invents page-specific content.
 */

import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import {
  assertGeminiApiKeyConfigured,
  getGeminiModelId,
} from '@/lib/recap/ai';
import {
  extractLearningTopic,
  type HomeworkTopicSource,
  type LibraryResourceDetail,
  type TopicExtractionResult,
} from '@/lib/recap/topic-extraction';

export const INSUFFICIENT_SOURCE = 'INSUFFICIENT_SOURCE';

export const homeworkLessonSceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(3),
  type: z.enum(['intro', 'teach', 'example']),
  narration: z.string().min(1).max(400),
  visualPrompt: z.string().min(1).max(600),
  onScreenText: z.string().max(80).default(''),
});

export const homeworkLessonPlanSchema = z.object({
  eligible: z.literal(true),
  title: z.string().min(1).max(120),
  subject: z.string().min(1).max(80),
  learningObjective: z.string().min(1).max(240),
  sourceConfidence: z.enum(['high', 'medium', 'low']),
  scenes: z.array(homeworkLessonSceneSchema).min(2).max(3),
  /** Single combined Veo prompt for MVP Option A (one short clip). */
  videoPrompt: z.string().min(20).max(1200),
});

export type HomeworkLessonPlan = z.infer<typeof homeworkLessonPlanSchema>;

export type HomeworkLessonResult =
  | HomeworkLessonPlan
  | { eligible: false; reason: typeof INSUFFICIENT_SOURCE | string };

export function validateHomeworkLessonPlan(raw: unknown): HomeworkLessonPlan {
  return homeworkLessonPlanSchema.parse(raw);
}

/**
 * Eligibility using existing Recap topic extraction (page-only → insufficient).
 */
export function assessHomeworkVideoEligibility(input: {
  homework: HomeworkTopicSource;
  libraryResources?: LibraryResourceDetail[];
}): TopicExtractionResult {
  return extractLearningTopic(input.homework, input.libraryResources || []);
}

export async function generateHomeworkLessonPlan(input: {
  homeworkId: string;
  subject: string;
  title: string;
  details: string;
  classLevel?: string;
  libraryResources?: LibraryResourceDetail[];
}): Promise<HomeworkLessonResult> {
  const extraction = assessHomeworkVideoEligibility({
    homework: {
      title: input.title,
      description: input.details,
      subject: input.subject,
    },
    libraryResources: input.libraryResources,
  });

  if (!extraction.eligible) {
    return { eligible: false, reason: INSUFFICIENT_SOURCE };
  }

  assertGeminiApiKeyConfigured();

  const sources = extraction.sourceSnippets.join('\n---\n');
  const classLevel = input.classLevel || 'Class I';

  const result = await generateObject({
    // @ts-expect-error ai / provider version alignment
    model: google(getGeminiModelId()),
    schema: homeworkLessonPlanSchema,
    system: `You create short Class 1 / Class 2 revision lesson plans for SchoolPulse AI videos.

Rules:
- Use ONLY the school source snippets provided. Never invent textbook page content.
- If sources are too thin, you must not invent facts — the caller already checked eligibility.
- 2–3 short scenes (intro, teach, example). Fun, visual, animated, age-appropriate, minimal on-screen text.
- videoPrompt: ONE combined visual prompt for a single short educational animation (no written text in the video, child-friendly 3D/2D classroom style).
- eligible must be true in the JSON schema response.`,
    prompt: `Homework id: ${input.homeworkId}
Subject: ${extraction.subject}
Class: ${classLevel}
Topic: ${extraction.topic}

School source material (ground truth):
${sources}

Return a structured lesson plan with 2–3 scenes and one combined videoPrompt.`,
  });

  const plan = validateHomeworkLessonPlan(result.object);
  return plan;
}

/** Build the single Veo prompt from a validated lesson plan (Option A). */
export function buildVeoPromptFromLesson(plan: HomeworkLessonPlan): string {
  const trimmed = plan.videoPrompt.trim();
  if (trimmed.length >= 20) return trimmed;
  const scenes = plan.scenes
    .map((s) => `Scene ${s.sceneNumber} (${s.type}): ${s.visualPrompt}. Narration idea: ${s.narration}`)
    .join(' ');
  return `Friendly colorful educational animation for a Class 1 child about ${plan.subject}: ${plan.title}. ${scenes} Simple clean classroom background, gentle playful movement, no written text on screen.`;
}

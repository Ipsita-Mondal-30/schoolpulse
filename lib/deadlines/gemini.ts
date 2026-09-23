/**
 * Server-only Gemini extraction of explicit school deadlines.
 * Never invents dates. Never imported from client components.
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { assertGeminiApiKeyConfigured, getGeminiModelId } from '@/lib/recap/ai';
import {
  deadlineExtractionSchema,
  noneExtraction,
  validateExtractionPayload,
  type DeadlineExtractionResult,
} from '@/lib/deadlines/schema';
import { validateAgainstSource } from '@/lib/deadlines/validate';

const MAX_BODY = 800;

function clip(raw: string, max = MAX_BODY): string {
  const t = String(raw || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export type GeminiDeadlineInput = {
  entityType: 'homework' | 'notice';
  sourceId: string;
  subject: string;
  title: string;
  body: string;
  sourceDate: string;
  relatedNotices?: Array<{ sourceId: string; title: string; body: string; publishedDate: string }>;
};

function buildPrompt(input: GeminiDeadlineInput): string {
  const related = (input.relatedNotices ?? [])
    .map(
      (n) =>
        `Related notice ${n.sourceId} (published ${n.publishedDate}):\n${clip(n.title)}\n${clip(n.body)}`,
    )
    .join('\n---\n');

  return `Extract an explicit school-provided homework deadline from this Class 1 school text.

Timezone: Asia/Kolkata
Source date (assigned or published): ${input.sourceDate}
Entity: ${input.entityType}
Source id: ${input.sourceId}
Subject: ${clip(input.subject, 80)}
Title: ${clip(input.title, 160)}
Body:
${clip(input.body)}
${related ? `\n${related}\n` : ''}

Rules:
- Extract a due date ONLY if the text explicitly states a completion, submission, or due deadline.
- Valid: "completion on 25 September", "submit on 27/09/2026", "complete by Friday", "due tomorrow".
- Invalid: "revise EVS", "study EVS", "complete page 42", assigned/published date alone.
- Do NOT guess from school timetables or "homework usually takes N days".
- If the text says Friday/tomorrow/next Monday, resolve it using the source date above to YYYY-MM-DD.
- dueDate must be YYYY-MM-DD or null.
- evidence must be a short quote copied from the source.
- confidence HIGH only when the deadline is explicit. MEDIUM if wording is slightly ambiguous. NONE otherwise.
- sourceType HOMEWORK_TEXT if the quote is from homework, NOTICE if from a related notice, NONE if no deadline.
- If related notices are about a different activity, ignore them.

Return structured JSON only.`;
}

export type GenerateDeadlineFn = (input: GeminiDeadlineInput) => Promise<DeadlineExtractionResult>;

export const defaultGenerateDeadline: GenerateDeadlineFn = async (input) => {
  assertGeminiApiKeyConfigured();
  const result = await generateObject({
    // @ts-expect-error version mismatch between ai core and provider
    model: google(getGeminiModelId()),
    schema: deadlineExtractionSchema,
    system:
      'You extract explicit school deadlines. You never invent dates. If evidence is insufficient, return hasDueDate false and confidence NONE.',
    prompt: buildPrompt(input),
  });
  return validateExtractionPayload(result.object);
};

export async function extractDeadlineWithGemini(
  input: GeminiDeadlineInput,
  generate: GenerateDeadlineFn = defaultGenerateDeadline,
): Promise<DeadlineExtractionResult> {
  const sourceText = [
    input.title,
    input.body,
    ...(input.relatedNotices ?? []).map((n) => `${n.title}\n${n.body}`),
  ].join('\n');

  try {
    const raw = await generate(input);
    return validateAgainstSource(raw, sourceText, input.sourceDate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SchoolPulse] Gemini deadline extract failed for ${input.entityType}:${input.sourceId}: ${msg}`);
    return noneExtraction('gemini_failed');
  }
}

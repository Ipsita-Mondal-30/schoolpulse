import { z } from 'zod';
import { isValidSchoolYmd } from '@/lib/homework-dates';

export const DEADLINE_CONFIDENCE = ['HIGH', 'MEDIUM', 'NONE'] as const;
export type DeadlineConfidence = (typeof DEADLINE_CONFIDENCE)[number];

export const DEADLINE_SOURCE_TYPE = [
  'STRUCTURED_FIELD',
  'HOMEWORK_TEXT',
  'NOTICE',
  'NONE',
] as const;
export type DeadlineSourceType = (typeof DEADLINE_SOURCE_TYPE)[number];

export const deadlineExtractionSchema = z.object({
  hasDueDate: z.boolean(),
  dueDate: z.string().nullable(),
  confidence: z.enum(DEADLINE_CONFIDENCE),
  evidence: z.string().nullable(),
  sourceType: z.enum(DEADLINE_SOURCE_TYPE),
  sourceId: z.string().nullable(),
  reason: z.string().max(400).nullable().optional(),
});

export type DeadlineExtractionResult = z.infer<typeof deadlineExtractionSchema>;

export const EMPTY_EXTRACTION: DeadlineExtractionResult = {
  hasDueDate: false,
  dueDate: null,
  confidence: 'NONE',
  evidence: null,
  sourceType: 'NONE',
  sourceId: null,
  reason: null,
};

export function noneExtraction(reason?: string): DeadlineExtractionResult {
  return { ...EMPTY_EXTRACTION, reason: reason ?? null };
}

export function highExtraction(input: {
  dueDate: string;
  evidence: string;
  sourceType: Exclude<DeadlineSourceType, 'NONE'>;
  sourceId: string | null;
  reason?: string;
}): DeadlineExtractionResult {
  return {
    hasDueDate: true,
    dueDate: input.dueDate,
    confidence: 'HIGH',
    evidence: input.evidence,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    reason: input.reason ?? null,
  };
}

export function isHighCanonicalDue(result: DeadlineExtractionResult | null | undefined): boolean {
  if (!result?.hasDueDate) return false;
  if (result.confidence !== 'HIGH') return false;
  return isValidSchoolYmd(result.dueDate);
}

export function validateExtractionPayload(raw: unknown): DeadlineExtractionResult {
  const parsed = deadlineExtractionSchema.safeParse(raw);
  if (!parsed.success) return noneExtraction('invalid_schema');
  const obj = parsed.data;
  if (!obj.hasDueDate) return noneExtraction(obj.reason ?? 'no_due_date');
  if (!isValidSchoolYmd(obj.dueDate)) return noneExtraction('invalid_due_date');
  if (obj.confidence === 'NONE') return noneExtraction('confidence_none');
  return {
    ...obj,
    dueDate: obj.dueDate!.slice(0, 10),
  };
}

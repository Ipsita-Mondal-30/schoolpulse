import { isValidSchoolYmd } from '@/lib/homework-dates';
import { isHighCanonicalDue, type DeadlineExtractionResult } from '@/lib/deadlines/schema';

/**
 * Canonical This Week due date.
 * 1) NeverSkip structured dueDate
 * 2) HIGH-confidence extraction
 * MEDIUM/NONE never place an item.
 */
export function canonicalDueDate(input: {
  structuredDue?: string | null;
  extraction?: DeadlineExtractionResult | null;
}): string {
  if (isValidSchoolYmd(input.structuredDue)) return input.structuredDue!.slice(0, 10);
  if (input.extraction && isHighCanonicalDue(input.extraction) && input.extraction.dueDate) {
    return input.extraction.dueDate.slice(0, 10);
  }
  return '';
}

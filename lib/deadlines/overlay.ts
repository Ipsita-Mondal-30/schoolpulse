import { NEVERSKIP_SOURCE } from '@/lib/neverskip/types';
import { canonicalDueDate } from '@/lib/deadlines/canonical';
import { isHighCanonicalDue, type DeadlineExtractionResult } from '@/lib/deadlines/schema';

export type ExtractionRow = {
  entityType: string;
  source: string;
  sourceId: string;
  hasDueDate: boolean;
  dueDate: string | null;
  confidence: string;
  evidence: string | null;
  sourceType: string;
};

export function extractionToResult(row: ExtractionRow | undefined): DeadlineExtractionResult | null {
  if (!row) return null;
  return {
    hasDueDate: row.hasDueDate,
    dueDate: row.dueDate,
    confidence: (row.confidence as DeadlineExtractionResult['confidence']) || 'NONE',
    evidence: row.evidence,
    sourceType: (row.sourceType as DeadlineExtractionResult['sourceType']) || 'NONE',
    sourceId: row.sourceId,
  };
}

export function overlayHomeworkDueDate(
  structuredDue: string | null | undefined,
  extraction: ExtractionRow | undefined,
): string | undefined {
  const due = canonicalDueDate({
    structuredDue,
    extraction: extractionToResult(extraction),
  });
  return due || undefined;
}

export function noticeHasStandaloneHighDue(extraction: ExtractionRow | undefined): boolean {
  const result = extractionToResult(extraction);
  return Boolean(result && isHighCanonicalDue(result));
}

export function extractionKey(entityType: string, sourceId: string, source = NEVERSKIP_SOURCE): string {
  return `${entityType}:${source}:${sourceId}`;
}

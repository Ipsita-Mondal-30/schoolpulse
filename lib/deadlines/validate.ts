/**
 * Accept a Gemini/deterministic extraction only when the source text supports it.
 */

import { extractSchoolDeadlineFromDetails } from '@/lib/neverskip/deadline-from-details';
import { isValidSchoolYmd } from '@/lib/homework-dates';
import { extractRelativeDeadline } from '@/lib/deadlines/relative';
import {
  noneExtraction,
  type DeadlineExtractionResult,
  type DeadlineSourceType,
} from '@/lib/deadlines/schema';

function collapse(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9/.\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sourceContainsEvidence(sourceText: string, evidence: string | null): boolean {
  if (!evidence || evidence.trim().length < 4) return false;
  const src = collapse(sourceText);
  const ev = collapse(evidence);
  if (!src || !ev) return false;
  if (src.includes(ev)) return true;
  const tokens = ev.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.every((t) => src.includes(t));
}

function hasDeadlineInstruction(text: string): boolean {
  return /complet(?:e|ion|ed)|submi(?:t|ssion)|deadline|\bdue\b|last date|kindly send|send (?:it|the)/i.test(
    text,
  );
}

function dateMentionedInEvidence(dueYmd: string, evidence: string, sourceYmd: string): boolean {
  const ev = evidence.toLowerCase();
  const day = String(Number(dueYmd.slice(8, 10)));
  const monthNum = dueYmd.slice(5, 7);
  const monthN = String(Number(monthNum));
  const months: Record<string, string> = {
    '01': 'jan',
    '02': 'feb',
    '03': 'mar',
    '04': 'apr',
    '05': 'may',
    '06': 'jun',
    '07': 'jul',
    '08': 'aug',
    '09': 'sep',
    '10': 'oct',
    '11': 'nov',
    '12': 'dec',
  };
  const mon = months[monthNum];
  if (ev.includes(dueYmd)) return true;
  for (const sep of ['/', '-', '.']) {
    if (ev.includes(`${day}${sep}${monthNum}`) || ev.includes(`${day}${sep}${monthN}`)) return true;
  }
  if (mon && ev.includes(mon) && ev.includes(day)) return true;

  const relative = extractRelativeDeadline(evidence, sourceYmd);
  if (relative?.ymd === dueYmd) return true;
  return false;
}

export function validateAgainstSource(
  result: DeadlineExtractionResult,
  sourceText: string,
  sourceYmd: string,
): DeadlineExtractionResult {
  if (!result.hasDueDate || result.confidence === 'NONE') {
    return noneExtraction(result.reason ?? 'no_due_date');
  }
  if (!isValidSchoolYmd(result.dueDate)) {
    return noneExtraction('invalid_due_date');
  }
  if (!sourceContainsEvidence(sourceText, result.evidence)) {
    return noneExtraction('evidence_not_in_source');
  }
  if (!dateMentionedInEvidence(result.dueDate!, result.evidence || '', sourceYmd)) {
    return noneExtraction('date_not_in_evidence');
  }
  if (!hasDeadlineInstruction(result.evidence || '')) {
    const absolute = extractSchoolDeadlineFromDetails(sourceText, sourceYmd);
    const relative = extractRelativeDeadline(sourceText, sourceYmd);
    const supported = absolute === result.dueDate || relative?.ymd === result.dueDate;
    if (!supported) {
      return noneExtraction('evidence_lacks_deadline_language');
    }
  }
  if (result.confidence === 'MEDIUM') {
    return { ...result, hasDueDate: true };
  }
  return result;
}

export function deterministicFromText(
  text: string,
  sourceYmd: string,
  sourceType: Exclude<DeadlineSourceType, 'NONE' | 'STRUCTURED_FIELD'>,
  sourceId: string,
): DeadlineExtractionResult {
  const absolute = extractSchoolDeadlineFromDetails(text, sourceYmd);
  if (absolute) {
    return validateAgainstSource(
      {
        hasDueDate: true,
        dueDate: absolute,
        confidence: 'HIGH',
        evidence: text.slice(0, 240),
        sourceType,
        sourceId,
        reason: 'Explicit calendar date in school text',
      },
      text,
      sourceYmd,
    );
  }
  const relative = extractRelativeDeadline(text, sourceYmd);
  if (relative) {
    return validateAgainstSource(
      {
        hasDueDate: true,
        dueDate: relative.ymd,
        confidence: 'HIGH',
        evidence: relative.evidence,
        sourceType,
        sourceId,
        reason: 'Explicit relative deadline resolved from source date',
      },
      text,
      sourceYmd,
    );
  }
  return noneExtraction('no_explicit_deadline_in_text');
}

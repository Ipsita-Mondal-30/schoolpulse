/**
 * Canonical NeverSkip homework dates for every SchoolPulse surface.
 *
 * assignedDate  ← ImportedHomework.homeworkDate ← ass_dt / assign_dt
 * dueDate       ← structured NeverSkip due_dt / ass_duedt, else HIGH-confidence extraction
 *
 * Never use createdAt, updatedAt, or syncedAt as a school date.
 * Never invent a due date from the assigned/diary date.
 */

import { toSortableDate } from '@/lib/ui-merge';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type HomeworkDateFields = {
  /** Assigned / Class Diary date (UI sentDate, DB homeworkDate). */
  sentDate?: string | null;
  homeworkDate?: string | null;
  /** School-provided due date only (UI submissionDate, DB dueDate). */
  submissionDate?: string | null;
  dueDate?: string | null;
};

function yearOk(ymd: string): boolean {
  const year = Number(ymd.slice(0, 4));
  return Number.isFinite(year) && year >= 1990 && year <= 2100;
}

/** True for a real calendar day YYYY-MM-DD (rejects 0000-00-00). */
export function isValidSchoolYmd(raw?: string | null): boolean {
  const ymd = toSortableDate(raw);
  return Boolean(ymd && YMD_RE.test(ymd) && yearOk(ymd));
}

export function assignedYmd(hw: HomeworkDateFields): string {
  const raw = hw.homeworkDate || hw.sentDate || '';
  const ymd = toSortableDate(raw);
  return isValidSchoolYmd(ymd) ? ymd : '';
}

/** School-provided deadline only. Empty when NeverSkip left due_dt / ass_duedt unset. */
export function dueYmd(hw: HomeworkDateFields): string {
  const raw = hw.dueDate || hw.submissionDate || '';
  const ymd = toSortableDate(raw);
  return isValidSchoolYmd(ymd) ? ymd : '';
}

/**
 * Calendar day for non-deadline surfaces. This Week uses dueYmd only.
 */
export function schoolYmd(hw: HomeworkDateFields): string {
  return dueYmd(hw) || assignedYmd(hw);
}

export function hasSchoolProvidedDueDate(hw: HomeworkDateFields): boolean {
  return Boolean(dueYmd(hw));
}

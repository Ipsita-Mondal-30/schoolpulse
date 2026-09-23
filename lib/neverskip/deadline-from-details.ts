/**
 * Extract a school-provided homework deadline from NeverSkip title/details text.
 *
 * NeverSkip Class Diary usually leaves due_dt / ass_duedt empty. Teachers still
 * write explicit completion/submission dates in assign_details, e.g.
 * "EVS completion on 25 September" or "Submission of book -16/9/26".
 *
 * Only instruction-backed dates are returned. Assigned-date restatements
 * ("Today's homework (17/09/26)") and quiz/event dates ("conducted on …")
 * are ignored. Never copies assignedDate into dueDate.
 */

import { isValidSchoolYmd } from '@/lib/homework-dates';

const MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';

const DATE_TOKEN_RE = new RegExp(
  `(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH})(?:\\s*,?\\s*\\d{4})?)` +
    `|(\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{2,4})`,
  'gi',
);

const MONTH_INDEX: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sept: '09',
  sep: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

const INSTRUCTION_RE =
  /complet(?:e|ion|ed)|submi(?:t|ssion)|deadline|\bdue\b|last date|kindly send|send it(?:\s+back)?|send the (?:book|textbook|notebook|workbook|activity)/i;

const ASSIGNED_RESTATEMENT_RE =
  /today['’]?s?\s+(?:\w+\s+){0,8}homework|todays\s+(?:\w+\s+){0,8}homework/i;

const EVENT_NOT_DEADLINE_RE = /conducted on|know your words/i;

function stripNoise(raw: string): string {
  return String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\*{1,2}/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMonthNameToken(token: string, assignedYmd: string): string {
  const m = token
    .trim()
    .match(
      /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?$/i,
    );
  if (!m) return '';
  const mon = MONTH_INDEX[m[2].toLowerCase()];
  if (!mon) return '';
  const day = m[1].padStart(2, '0');
  const year = m[3] || (assignedYmd && assignedYmd.slice(0, 4)) || '';
  if (!year) return '';
  const ymd = `${year}-${mon}-${day}`;
  return isValidSchoolYmd(ymd) ? ymd : '';
}

function parseNumericToken(token: string): string {
  const compact = token.replace(/\s+/g, '');
  const m = compact.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return '';
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  const ymd = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isValidSchoolYmd(ymd) ? ymd : '';
}

export function parseInstructionDateToken(
  token: string,
  assignedYmd = '',
): string {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  return parseMonthNameToken(trimmed, assignedYmd) || parseNumericToken(trimmed) || '';
}

function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  if (!isValidSchoolYmd(fromYmd) || !isValidSchoolYmd(toYmd)) return null;
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

function isPlausibleDueForAssignment(dueYmd: string, assignedYmd: string): boolean {
  if (!assignedYmd) return true;
  const days = daysBetweenYmd(assignedYmd, dueYmd);
  if (days == null) return false;
  return days >= -14 && days <= 90;
}

/**
 * Return YYYY-MM-DD when title/details contain an explicit school deadline.
 * Prefer the earliest instruction date on/after assignedYmd when several exist.
 */
export function extractSchoolDeadlineFromDetails(
  text: string,
  assignedYmd = '',
): string | null {
  const haystack = stripNoise(text);
  if (!haystack) return null;

  const found: string[] = [];
  DATE_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATE_TOKEN_RE.exec(haystack)) !== null) {
    const token = match[1] || match[2] || match[0];
    const start = match.index;
    const prefix = haystack.slice(Math.max(0, start - 140), start);
    const assignedNear = haystack.slice(Math.max(0, start - 48), start);
    if (ASSIGNED_RESTATEMENT_RE.test(assignedNear)) continue;
    if (EVENT_NOT_DEADLINE_RE.test(assignedNear)) continue;
    if (!INSTRUCTION_RE.test(prefix)) continue;
    const ymd = parseInstructionDateToken(token, assignedYmd);
    if (!ymd) continue;
    if (assignedYmd && !isPlausibleDueForAssignment(ymd, assignedYmd)) continue;
    if (!found.includes(ymd)) found.push(ymd);
  }

  if (found.length === 0) return null;
  found.sort();
  if (assignedYmd && isValidSchoolYmd(assignedYmd)) {
    const onOrAfter = found.filter((d) => d >= assignedYmd);
    if (onOrAfter.length > 0) return onOrAfter[0];
  }
  return found[0];
}

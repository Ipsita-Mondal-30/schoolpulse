/**
 * Validation for Gemini newsletter extractions. Any error → nothing is applied
 * and the last valid planner / JoL timetable stays in place.
 */

export type NewsletterPlannerSubject = { subject: string; portions: string[]; activities: string[] };

export type NewsletterImportantDate = {
  date: string;
  event: string;
  type: 'holiday' | 'event' | 'activity' | 'important';
  description: string;
};

export type NewsletterJolDay = { date: string; weekday: string; classI: string; classII: string };

export type NewsletterExtraction = {
  month: string;
  year: number;
  title?: string;
  monthlyPlanner: NewsletterPlannerSubject[];
  importantDates: NewsletterImportantDate[];
  jolTimetable?: { title?: string; academicYear?: string; days: NewsletterJolDay[] } | null;
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_WINDOW_DAYS = 45;
const IMPORTANT_TYPES = new Set(['holiday', 'event', 'activity', 'important']);

export function monthIndexFromName(name: string): number {
  const n = name.trim().toLowerCase();
  return MONTH_NAMES.findIndex((m) => m.toLowerCase() === n || m.slice(0, 3).toLowerCase() === n);
}

export function monthKeyFor(extraction: Pick<NewsletterExtraction, 'month' | 'year'>): string | null {
  const idx = monthIndexFromName(extraction.month);
  if (idx < 0 || !Number.isInteger(extraction.year)) return null;
  return `${extraction.year}-${String(idx + 1).padStart(2, '0')}`;
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function weekdayOf(ymd: string): string {
  return WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}

function withinMonthWindow(ymd: string, monthKey: string): boolean {
  const [y, m] = monthKey.split('-').map(Number);
  const start = Date.UTC(y, m - 1, 1) - DATE_WINDOW_DAYS * 86400_000;
  const end = Date.UTC(y, m, 0) + DATE_WINDOW_DAYS * 86400_000;
  const t = new Date(`${ymd}T00:00:00Z`).getTime();
  return t >= start && t <= end;
}

export function validateNewsletterExtraction(x: NewsletterExtraction): string[] {
  const errors: string[] = [];
  const monthKey = monthKeyFor(x);
  if (!monthKey) {
    errors.push(`invalid month/year: ${x.month} ${x.year}`);
    return errors;
  }
  if (x.year < 2024 || x.year > 2100) errors.push(`year out of range: ${x.year}`);

  const planner = x.monthlyPlanner ?? [];
  const days = x.jolTimetable?.days ?? [];
  if (planner.length === 0 && days.length === 0) {
    errors.push('no monthly planner subjects and no JoL timetable extracted');
  }
  for (const [i, s] of planner.entries()) {
    if (!s.subject?.trim()) errors.push(`planner[${i}] empty subject`);
    if (!Array.isArray(s.portions) || !Array.isArray(s.activities)) {
      errors.push(`planner[${i}] portions/activities must be arrays`);
    } else if (s.portions.length === 0 && s.activities.length === 0) {
      errors.push(`planner[${i}] ${s.subject}: no portions or activities`);
    }
  }

  for (const [i, d] of (x.importantDates ?? []).entries()) {
    if (!isIsoDate(d.date)) errors.push(`importantDates[${i}] invalid date ${d.date}`);
    else if (!withinMonthWindow(d.date, monthKey)) errors.push(`importantDates[${i}] ${d.date} outside ${monthKey}±45d`);
    if (!d.event?.trim()) errors.push(`importantDates[${i}] empty event`);
    if (!IMPORTANT_TYPES.has(d.type)) errors.push(`importantDates[${i}] invalid type ${d.type}`);
  }

  const seen = new Set<string>();
  for (const d of days) {
    if (!isIsoDate(d.date)) {
      errors.push(`jol day invalid date ${d.date}`);
      continue;
    }
    if (seen.has(d.date)) errors.push(`jol day duplicate date ${d.date}`);
    seen.add(d.date);
    if (!withinMonthWindow(d.date, monthKey)) errors.push(`jol day ${d.date} outside ${monthKey}±45d`);
    if (d.weekday?.trim().toLowerCase() !== weekdayOf(d.date).toLowerCase()) {
      errors.push(`jol day ${d.date}: weekday ${d.weekday} != ${weekdayOf(d.date)}`);
    }
    if (!d.classI?.trim() || !d.classII?.trim()) errors.push(`jol day ${d.date}: empty subject`);
  }
  return errors;
}

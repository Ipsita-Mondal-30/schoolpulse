/**
 * School-day vs confirmed holiday, from Planner/calendar rows only.
 * Does not invent holiday dates or names.
 */

import { addDaysYmd, BRIEF_CALENDAR_AHEAD_DAYS } from '@/lib/daily-brief';

export const CALENDAR_LOOKAHEAD_DAYS = BRIEF_CALENDAR_AHEAD_DAYS;

export type SchoolCalendarType = 'holiday' | 'event' | 'activity' | 'important';

export interface SchoolCalendarItem {
  date: string;
  event: string;
  description?: string;
  type?: SchoolCalendarType;
}

export interface ConfirmedSchoolHoliday {
  date: string;
  name: string;
}

export interface DayHolidayHint {
  isHoliday: boolean;
  holidayName?: string;
}

const TENTATIVE_RE = /tentative/i;

function isTentative(description?: string): boolean {
  return TENTATIVE_RE.test(description || '');
}

/** Planner window used on Home: today through today + lookahead days. */
export function selectCalendarWindow(
  dates: SchoolCalendarItem[],
  today: string,
  daysAhead: number = CALENDAR_LOOKAHEAD_DAYS,
): SchoolCalendarItem[] {
  const end = addDaysYmd(today, daysAhead);
  if (!end) return [];
  const seen = new Set<string>();
  const out: SchoolCalendarItem[] = [];
  for (const row of dates) {
    if (row.date < today || row.date > end) continue;
    const key = `${row.date}-${row.event}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date: row.date,
      event: row.event,
      description: row.description,
      type: row.type,
    });
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.event.localeCompare(b.event);
  });
}

/**
 * Confirmed school holiday for a calendar date.
 * Requires type === 'holiday' (or a named day-schedule holiday that is not Weekend).
 * Tentative descriptions are treated as unconfirmed.
 */
export function getConfirmedSchoolHoliday(
  today: string,
  dates: SchoolCalendarItem[],
  daySchedule?: DayHolidayHint | null,
): ConfirmedSchoolHoliday | null {
  const row = dates.find((d) => d.date === today && d.type === 'holiday');
  if (row && !isTentative(row.description)) {
    const name = row.event.trim();
    if (name) return { date: today, name };
  }

  const hintName = daySchedule?.holidayName?.trim();
  if (
    daySchedule?.isHoliday &&
    hintName &&
    hintName.toLowerCase() !== 'weekend'
  ) {
    return { date: today, name: hintName };
  }

  return null;
}

export function shouldShowDailyPulse(
  today: string,
  dates: SchoolCalendarItem[],
  daySchedule?: DayHolidayHint | null,
): boolean {
  return getConfirmedSchoolHoliday(today, dates, daySchedule) === null;
}

/** Later event/important rows — not today's holiday, not guessed types. */
export function getUpcomingSchoolEvents(
  today: string,
  dates: SchoolCalendarItem[],
  daysAhead: number = CALENDAR_LOOKAHEAD_DAYS,
): SchoolCalendarItem[] {
  const end = addDaysYmd(today, daysAhead);
  if (!end) return [];
  return dates
    .filter((d) => {
      if (d.date <= today || d.date > end) return false;
      return d.type === 'event' || d.type === 'important';
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.event.localeCompare(b.event);
    });
}

/** e.g. "Friday · 11 September" from YYYY-MM-DD. */
export function formatHolidayDateLine(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(dt);
  const dayMonth = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dt);
  return `${weekday} · ${dayMonth}`;
}

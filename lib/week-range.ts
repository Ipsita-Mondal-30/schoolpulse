/**
 * Monday–Sunday week helpers for India (Asia/Kolkata).
 * Uses YYYY-MM-DD calendar strings — no inventing due dates.
 */

import { addDaysYmd, formatBriefDate } from '@/lib/daily-brief';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export type WorkloadLevel = 'Light' | 'Moderate' | 'Heavy';

/**
 * Day of week for a calendar YYYY-MM-DD.
 * Returns 1 = Monday … 7 = Sunday (ISO-style).
 */
export function getDayOfWeekMon1(ymd: string): number {
  if (!YMD_RE.test(ymd)) return 0;
  const [y, m, d] = ymd.split('-').map(Number);
  // UTC noon avoids DST; getUTCDay: 0=Sun … 6=Sat → Mon=1 … Sun=7
  const utcDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/** Monday of the week containing `ymd` (YYYY-MM-DD). */
export function getStartOfWeekIndia(ymd: string): string {
  const dow = getDayOfWeekMon1(ymd);
  if (!dow) return '';
  return addDaysYmd(ymd, -(dow - 1));
}

/** Sunday of the week containing `ymd`. */
export function getEndOfWeekIndia(ymd: string): string {
  const start = getStartOfWeekIndia(ymd);
  if (!start) return '';
  return addDaysYmd(start, 6);
}

export function eachDayYmd(start: string, end: string): string[] {
  if (!YMD_RE.test(start) || !YMD_RE.test(end) || start > end) return [];
  const days: string[] = [];
  let cur = start;
  while (cur && cur <= end) {
    days.push(cur);
    cur = addDaysYmd(cur, 1);
    if (!cur) break;
  }
  return days;
}

export function isInWeek(ymd: string, start: string, end: string): boolean {
  if (!YMD_RE.test(ymd) || !start || !end) return false;
  return ymd >= start && ymd <= end;
}

/**
 * Assignment-volume label only (not academic difficulty).
 * 0–1 Light · 2–3 Moderate · 4+ Heavy
 */
export function getWorkloadLevel(count: number): WorkloadLevel {
  if (count <= 1) return 'Light';
  if (count <= 3) return 'Moderate';
  return 'Heavy';
}

const WEEKDAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/** e.g. "THU, 11 SEP" from YYYY-MM-DD (no UTC parse skew). */
export function formatWeekdayHeading(ymd: string): string {
  if (!YMD_RE.test(ymd)) return ymd;
  const dow = getDayOfWeekMon1(ymd);
  if (!dow) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  void y;
  return `${WEEKDAYS_SHORT[dow - 1]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatWeekRangeLabel(start: string, end: string): string {
  if (!start || !end) return '';
  return `${formatBriefDate(start)} – ${formatBriefDate(end)}`;
}

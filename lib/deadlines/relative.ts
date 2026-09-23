/**
 * Resolve explicit relative deadline phrases against a source calendar date (India).
 * Only weekday / tomorrow / today — never infers from "homework takes 2 days".
 */

import { addDaysYmd } from '@/lib/daily-brief';
import { getDayOfWeekMon1 } from '@/lib/week-range';
import { isValidSchoolYmd } from '@/lib/homework-dates';

const WEEKDAY: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const INSTRUCTION =
  /complet(?:e|ion|ed)|submi(?:t|ssion)|deadline|\bdue\b|last date|kindly send|send (?:it|the)/i;

function strip(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nextWeekdayOnOrAfter(sourceYmd: string, weekdayMon1: number): string {
  if (!isValidSchoolYmd(sourceYmd) || weekdayMon1 < 1 || weekdayMon1 > 7) return '';
  const dow = getDayOfWeekMon1(sourceYmd);
  if (!dow) return '';
  let delta = weekdayMon1 - dow;
  if (delta < 0) delta += 7;
  return addDaysYmd(sourceYmd, delta);
}

export function nextWeekdayAfter(sourceYmd: string, weekdayMon1: number): string {
  if (!isValidSchoolYmd(sourceYmd) || weekdayMon1 < 1 || weekdayMon1 > 7) return '';
  const sameDay = nextWeekdayOnOrAfter(sourceYmd, weekdayMon1);
  if (!sameDay) return '';
  if (sameDay === sourceYmd) return addDaysYmd(sourceYmd, 7);
  return sameDay;
}

export function extractRelativeDeadline(
  text: string,
  sourceYmd: string,
): { ymd: string; evidence: string } | null {
  if (!isValidSchoolYmd(sourceYmd)) return null;
  const haystack = strip(text);
  if (!haystack || !INSTRUCTION.test(haystack)) return null;

  const tomorrow = haystack.match(
    /(?:complete|submit|due|send).{0,40}\b(tomorrow|tmrw)\b|\b(tomorrow|tmrw)\b.{0,20}(?:submit|complete|due)/i,
  );
  if (tomorrow) {
    const ymd = addDaysYmd(sourceYmd, 1);
    if (ymd) return { ymd, evidence: tomorrow[0].slice(0, 80) };
  }

  const today = haystack.match(
    /(?:complete|submit|due).{0,20}\btoday\b|\bdue today\b/i,
  );
  if (today) {
    return { ymd: sourceYmd, evidence: today[0].slice(0, 80) };
  }

  const nextWeekday = haystack.match(
    /(?:complete|submit|due|send).{0,40}\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (nextWeekday) {
    const day = WEEKDAY[nextWeekday[1].toLowerCase()];
    const ymd = nextWeekdayAfter(sourceYmd, day);
    if (ymd) return { ymd, evidence: nextWeekday[0].slice(0, 80) };
  }

  const weekday = haystack.match(
    /(?:complete|submit|due|send|before).{0,40}\b(?:on|by|before)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (weekday) {
    const day = WEEKDAY[weekday[1].toLowerCase()];
    const ymd = nextWeekdayOnOrAfter(sourceYmd, day);
    if (ymd) return { ymd, evidence: weekday[0].slice(0, 80) };
  }

  return null;
}

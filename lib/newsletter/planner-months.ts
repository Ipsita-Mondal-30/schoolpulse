/**
 * Planner months: Neon newsletter extractions (current/future) merged over the
 * static May–Sep 2026 JSON (history). Current month resolved in Asia/Kolkata.
 */

import type { ImportantDate, PlannerSubject } from '@/lib/data';
import { MONTH_NAMES, monthIndexFromName } from './validate';

export type PlannerMonthEntry = {
  key: string;
  month: string;
  year: number;
  monthlyPlanner: PlannerSubject[];
  importantDates: ImportantDate[];
  source: 'newsletter' | 'static';
};

export type PlannerMonthView = {
  months: { key: string; month: string; year: number }[];
  currentMonthKey: string;
  /** Parent-safe line when the school has not published the current month yet. */
  missingCurrentMessage: string | null;
  selected: PlannerMonthEntry | null;
};

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] ?? key} ${y}`;
}

export function staticMonthKey(month: string, year: number): string | null {
  const idx = monthIndexFromName(month);
  return idx < 0 ? null : `${year}-${String(idx + 1).padStart(2, '0')}`;
}

/** Newsletter rows win over static JSON for the same month. Sorted ascending. */
export function mergePlannerMonths(
  newsletter: PlannerMonthEntry[],
  staticMonths: PlannerMonthEntry[],
): PlannerMonthEntry[] {
  const byKey = new Map<string, PlannerMonthEntry>();
  for (const m of staticMonths) byKey.set(m.key, m);
  for (const m of newsletter) byKey.set(m.key, m);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function buildPlannerMonthView(
  entries: PlannerMonthEntry[],
  currentMonthKey: string,
  requestedKey?: string | null,
): PlannerMonthView {
  const keys = entries.map((e) => e.key);
  const hasCurrent = keys.includes(currentMonthKey);
  let selectedKey: string | undefined;
  if (requestedKey && keys.includes(requestedKey)) selectedKey = requestedKey;
  else if (hasCurrent) selectedKey = currentMonthKey;
  else selectedKey = keys.filter((k) => k <= currentMonthKey).pop() ?? keys[keys.length - 1];
  const [, m] = currentMonthKey.split('-').map(Number);
  return {
    months: entries.map(({ key, month, year }) => ({ key, month, year })),
    currentMonthKey,
    missingCurrentMessage: hasCurrent
      ? null
      : `${MONTH_NAMES[m - 1] ?? 'This month'}'s planner has not been published by the school yet.`,
    selected: entries.find((e) => e.key === selectedKey) ?? null,
  };
}

export function parseNewsletterPlannerRow(row: { monthKey: string; plannerJson: string }): PlannerMonthEntry | null {
  try {
    const p = JSON.parse(row.plannerJson) as {
      month?: string;
      year?: number;
      monthlyPlanner?: PlannerSubject[];
      importantDates?: ImportantDate[];
    };
    const [y, m] = row.monthKey.split('-').map(Number);
    return {
      key: row.monthKey,
      month: MONTH_NAMES[m - 1] ?? p.month ?? row.monthKey,
      year: y,
      monthlyPlanner: Array.isArray(p.monthlyPlanner) ? p.monthlyPlanner : [],
      importantDates: Array.isArray(p.importantDates) ? p.importantDates : [],
      source: 'newsletter',
    };
  } catch {
    return null;
  }
}

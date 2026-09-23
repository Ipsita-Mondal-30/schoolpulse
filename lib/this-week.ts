/**
 * This Week view: group homework by school-provided due date (Mon–Sun, India).
 * Assigned/published date is never used as the calendar day.
 * Assigned-only items go to dateNotSpecified — they are not due.
 */

import type { UiHomeworkItem } from '@/lib/ui-merge';
import { filterHomeworkBySection } from '@/lib/ui-merge';
import {
  assignedYmd,
  dueYmd,
  hasSchoolProvidedDueDate,
} from '@/lib/homework-dates';
import {
  addDaysYmd,
  formatBriefDate,
  isDueToday,
  isDueTomorrow,
  isOverdue,
  isRecentlyOverdue,
} from '@/lib/daily-brief';
import {
  eachDayYmd,
  getEndOfWeekIndia,
  getStartOfWeekIndia,
  getWorkloadLevel,
  isInWeek,
  type WorkloadLevel,
} from '@/lib/week-range';

export interface ThisWeekHomeworkItem {
  id: string;
  title: string;
  subject: string;
  description: string;
  submissionDate?: string;
  sentDate: string;
  attachmentImage?: string;
}

export interface ThisWeekDayBucket {
  date: string;
  items: ThisWeekHomeworkItem[];
  count: number;
  workload: WorkloadLevel;
  isToday: boolean;
  isTomorrow: boolean;
}

export interface ThisWeekView {
  today: string;
  section: string;
  weekStart: string;
  weekEnd: string;
  overdue: ThisWeekHomeworkItem[];
  days: ThisWeekDayBucket[];
  dateNotSpecified: ThisWeekHomeworkItem[];
  /** Homework with reliable due in [weekStart, weekEnd]. */
  totalDatedThisWeek: number;
  overdueCount: number;
  dueTomorrowCount: number;
  undatedCount: number;
  nextWeekCount: number;
  nothingDueThisWeek: boolean;
  hasUndated: boolean;
}

export interface BuildThisWeekViewInput {
  homework: UiHomeworkItem[];
  today: string;
  section: string;
}

function dueYmdOrEmpty(submissionDate?: string | null): string {
  return dueYmd({ submissionDate });
}

function toItem(hw: UiHomeworkItem): ThisWeekHomeworkItem {
  return {
    id: hw.id,
    title: hw.title,
    subject: hw.subject,
    description: hw.description || '',
    submissionDate: hw.submissionDate,
    sentDate: hw.sentDate,
    attachmentImage: hw.attachmentImage,
  };
}

function dedupeById(items: UiHomeworkItem[]): UiHomeworkItem[] {
  const seen = new Set<string>();
  const out: UiHomeworkItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function sortByDueAsc(items: ThisWeekHomeworkItem[]): ThisWeekHomeworkItem[] {
  return [...items].sort((a, b) => {
    const da = dueYmdOrEmpty(a.submissionDate) || '';
    const db = dueYmdOrEmpty(b.submissionDate) || '';
    if (da !== db) return da.localeCompare(db);
    return a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title);
  });
}

function sortBySubjectTitle(items: ThisWeekHomeworkItem[]): ThisWeekHomeworkItem[] {
  return [...items].sort(
    (a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title),
  );
}

/**
 * Build Monday–Sunday workload view. Does not mutate inputs.
 * Places homework only on a school-provided due date. Does not copy assigned → due.
 */
export function buildThisWeekView(input: BuildThisWeekViewInput): ThisWeekView {
  const { today, section } = input;
  const weekStart = getStartOfWeekIndia(today);
  const weekEnd = getEndOfWeekIndia(today);
  const nextWeekStart = addDaysYmd(weekEnd, 1);
  const nextWeekEnd = addDaysYmd(nextWeekStart, 6);

  const homework = dedupeById(filterHomeworkBySection(input.homework, section));

  const overdue: ThisWeekHomeworkItem[] = [];
  const undated: ThisWeekHomeworkItem[] = [];
  const byDue = new Map<string, ThisWeekHomeworkItem[]>();
  let totalDatedThisWeek = 0;
  let dueTomorrowCount = 0;
  let nextWeekCount = 0;

  for (const hw of homework) {
    const placeOn = dueYmd(hw);
    if (!placeOn) {
      undated.push(toItem(hw));
      continue;
    }

    const item = toItem(hw);

    if (hasSchoolProvidedDueDate(hw) && isRecentlyOverdue(hw.submissionDate, today)) {
      overdue.push(item);
    }

    if (hasSchoolProvidedDueDate(hw) && isDueTomorrow(hw.submissionDate, today)) {
      dueTomorrowCount += 1;
    }

    if (isInWeek(placeOn, weekStart, weekEnd)) {
      totalDatedThisWeek += 1;
      const list = byDue.get(placeOn) || [];
      list.push(item);
      byDue.set(placeOn, list);
    } else if (
      nextWeekStart &&
      nextWeekEnd &&
      isInWeek(placeOn, nextWeekStart, nextWeekEnd)
    ) {
      nextWeekCount += 1;
    }
  }

  const dayDates = eachDayYmd(weekStart, weekEnd);
  const days: ThisWeekDayBucket[] = dayDates.map((date) => {
    const items = sortBySubjectTitle(byDue.get(date) || []);
    return {
      date,
      items,
      count: items.length,
      workload: getWorkloadLevel(items.length),
      isToday: date === today,
      isTomorrow: date === addDaysYmd(today, 1),
    };
  });

  return {
    today,
    section,
    weekStart,
    weekEnd,
    overdue: sortByDueAsc(overdue),
    days,
    dateNotSpecified: sortBySubjectTitle(undated),
    totalDatedThisWeek,
    overdueCount: overdue.length,
    dueTomorrowCount,
    undatedCount: undated.length,
    nextWeekCount,
    nothingDueThisWeek: totalDatedThisWeek === 0,
    hasUndated: undated.length > 0,
  };
}

/** Relative date label for UI; never labels an assigned date as Due. */
export function dueLabelForItem(
  item: ThisWeekHomeworkItem,
  today: string,
): string {
  if (hasSchoolProvidedDueDate(item)) {
    if (isDueToday(item.submissionDate, today)) return 'Due today';
    if (isDueTomorrow(item.submissionDate, today)) return 'Due tomorrow';
    if (isOverdue(item.submissionDate, today)) {
      const due = dueYmdOrEmpty(item.submissionDate);
      return due ? `Due date passed · ${formatBriefDate(due)}` : 'Due date passed';
    }
    const due = dueYmdOrEmpty(item.submissionDate);
    return due ? `Due ${formatBriefDate(due)}` : 'No deadline provided by school';
  }
  const assigned = assignedYmd(item);
  if (assigned) return `Assigned ${formatBriefDate(assigned)}`;
  return 'No deadline provided by school';
}

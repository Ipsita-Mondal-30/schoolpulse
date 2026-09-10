/**
 * This Week view: group homework by reliable due date (Mon–Sun, India).
 * Never invents due dates — undated items go to dateNotSpecified.
 */

import type { UiHomeworkItem } from '@/lib/ui-merge';
import { filterHomeworkBySection, toSortableDate } from '@/lib/ui-merge';
import {
  addDaysYmd,
  formatBriefDate,
  hasReliableDueDate,
  isDueToday,
  isDueTomorrow,
  isOverdue,
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

function dueYmd(submissionDate?: string | null): string {
  if (!hasReliableDueDate(submissionDate)) return '';
  return toSortableDate(submissionDate!);
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
    const da = dueYmd(a.submissionDate) || '';
    const db = dueYmd(b.submissionDate) || '';
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
 * Only groups under a date when submissionDate is a reliable due date.
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
    if (!hasReliableDueDate(hw.submissionDate)) {
      undated.push(toItem(hw));
      continue;
    }

    const due = dueYmd(hw.submissionDate);
    const item = toItem(hw);

    if (isOverdue(hw.submissionDate, today)) {
      overdue.push(item);
    }

    if (isDueTomorrow(hw.submissionDate, today)) {
      dueTomorrowCount += 1;
    }

    if (isInWeek(due, weekStart, weekEnd)) {
      totalDatedThisWeek += 1;
      const list = byDue.get(due) || [];
      list.push(item);
      byDue.set(due, list);
    } else if (
      nextWeekStart &&
      nextWeekEnd &&
      isInWeek(due, nextWeekStart, nextWeekEnd)
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

/** Relative due label for UI; never invents a date. */
export function dueLabelForItem(
  item: ThisWeekHomeworkItem,
  today: string,
): string {
  if (!hasReliableDueDate(item.submissionDate)) {
    return 'No deadline provided by school';
  }
  if (isDueToday(item.submissionDate, today)) return 'Due today';
  if (isDueTomorrow(item.submissionDate, today)) return 'Due tomorrow';
  if (isOverdue(item.submissionDate, today)) {
    const due = dueYmd(item.submissionDate);
    return due ? `Was due: ${formatBriefDate(due)}` : 'Overdue';
  }
  const due = dueYmd(item.submissionDate);
  return due ? `Due ${formatBriefDate(due)}` : 'No deadline provided by school';
}

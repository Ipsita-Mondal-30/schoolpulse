/**
 * Tonight — Daily Brief: classify homework/notices for the home dashboard.
 * Due buckets use only reliable submissionDate (NeverSkip dueDate). Never invent dues.
 */

import type { UiHomeworkItem, UiNoticeItem } from '@/lib/ui-merge';
import { filterHomeworkBySection, toSortableDate } from '@/lib/ui-merge';

export const INDIA_TIME_ZONE = 'Asia/Kolkata';

export interface DailyBriefHomeworkItem {
  id: string;
  title: string;
  subject: string;
  submissionDate?: string;
  sentDate: string;
}

export interface DailyBriefNoticeItem {
  id: string;
  summary: string;
  date: string;
  time: string;
}

export interface DailyBriefCalendarItem {
  date: string;
  event: string;
  description?: string;
}

export interface DailyBrief {
  today: string;
  section: string;
  overdue: DailyBriefHomeworkItem[];
  dueToday: DailyBriefHomeworkItem[];
  dueTomorrow: DailyBriefHomeworkItem[];
  comingUp: DailyBriefHomeworkItem[];
  recentHomework: DailyBriefHomeworkItem[];
  recentNotices: DailyBriefNoticeItem[];
  calendarItems: DailyBriefCalendarItem[];
  /** True when overdue/dueToday/dueTomorrow are all empty. */
  nothingUrgent: boolean;
}

export interface BuildDailyBriefInput {
  homework: UiHomeworkItem[];
  notices: UiNoticeItem[];
  today: string;
  section: string;
  comingUpDays?: number;
  recentHomeworkDays?: number;
  recentNoticeDays?: number;
  recentNoticeLimit?: number;
  /** Optional school calendar rows already known for today/tomorrow. */
  calendarItems?: DailyBriefCalendarItem[];
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** India calendar date as YYYY-MM-DD (avoids device-TZ midnight off-by-one). */
export function getIndiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** India local hour 0–23 for greeting. */
export function getIndiaHour(now: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = Number.parseInt(hourStr, 10);
  return Number.isFinite(hour) ? hour % 24 : 0;
}

export function getBriefGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Add days to a YYYY-MM-DD calendar date (UTC noon math to avoid DST issues). */
export function addDaysYmd(ymd: string, days: number): string {
  if (!YMD_RE.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Format YYYY-MM-DD for display without UTC parse skew (e.g. "11 Sep"). */
export function formatBriefDate(ymd: string): string {
  const sorted = toSortableDate(ymd) || ymd;
  if (!YMD_RE.test(sorted)) return ymd;
  const [y, m, d] = sorted.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${d} ${months[m - 1]}`;
}

export function hasReliableDueDate(submissionDate?: string | null): boolean {
  if (!submissionDate || !String(submissionDate).trim()) return false;
  return YMD_RE.test(toSortableDate(submissionDate));
}

function dueYmd(submissionDate?: string | null): string {
  if (!hasReliableDueDate(submissionDate)) return '';
  return toSortableDate(submissionDate!);
}

export function isDueToday(submissionDate: string | undefined, today: string): boolean {
  const due = dueYmd(submissionDate);
  return Boolean(due && due === today);
}

export function isDueTomorrow(submissionDate: string | undefined, today: string): boolean {
  const due = dueYmd(submissionDate);
  const tomorrow = addDaysYmd(today, 1);
  return Boolean(due && tomorrow && due === tomorrow);
}

export function isOverdue(submissionDate: string | undefined, today: string): boolean {
  const due = dueYmd(submissionDate);
  return Boolean(due && due < today);
}

export function isComingUp(
  submissionDate: string | undefined,
  today: string,
  comingUpDays = 7,
): boolean {
  const due = dueYmd(submissionDate);
  if (!due) return false;
  const afterTomorrow = addDaysYmd(today, 2);
  const end = addDaysYmd(today, comingUpDays);
  if (!afterTomorrow || !end) return false;
  return due >= afterTomorrow && due <= end;
}

function toBriefHomework(hw: UiHomeworkItem): DailyBriefHomeworkItem {
  return {
    id: hw.id,
    title: hw.title,
    subject: hw.subject,
    submissionDate: hw.submissionDate,
    sentDate: hw.sentDate,
  };
}

function toBriefNotice(n: UiNoticeItem): DailyBriefNoticeItem {
  return {
    id: n.id,
    summary: n.summary,
    date: n.date,
    time: n.time,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function sortByDueAsc(items: DailyBriefHomeworkItem[]): DailyBriefHomeworkItem[] {
  return [...items].sort((a, b) => {
    const da = dueYmd(a.submissionDate) || '';
    const db = dueYmd(b.submissionDate) || '';
    if (da !== db) return da.localeCompare(db);
    return a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title);
  });
}

function sortBySentDesc(items: DailyBriefHomeworkItem[]): DailyBriefHomeworkItem[] {
  return [...items].sort((a, b) => {
    const sa = toSortableDate(a.sentDate) || a.sentDate || '';
    const sb = toSortableDate(b.sentDate) || b.sentDate || '';
    if (sa !== sb) return sb.localeCompare(sa);
    return a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title);
  });
}

/**
 * Build the daily brief from already-merged UI homework and notices.
 * Does not mutate inputs. Does not invent due dates.
 */
export function buildDailyBrief(input: BuildDailyBriefInput): DailyBrief {
  const {
    today,
    section,
    comingUpDays = 7,
    recentHomeworkDays = 7,
    recentNoticeDays = 14,
    recentNoticeLimit = 5,
    calendarItems = [],
  } = input;

  const homework = dedupeById(filterHomeworkBySection(input.homework, section));
  const notices = dedupeById(input.notices);

  const overdue: DailyBriefHomeworkItem[] = [];
  const dueToday: DailyBriefHomeworkItem[] = [];
  const dueTomorrow: DailyBriefHomeworkItem[] = [];
  const comingUp: DailyBriefHomeworkItem[] = [];
  const placed = new Set<string>();

  for (const hw of homework) {
    if (isOverdue(hw.submissionDate, today)) {
      overdue.push(toBriefHomework(hw));
      placed.add(hw.id);
    } else if (isDueToday(hw.submissionDate, today)) {
      dueToday.push(toBriefHomework(hw));
      placed.add(hw.id);
    } else if (isDueTomorrow(hw.submissionDate, today)) {
      dueTomorrow.push(toBriefHomework(hw));
      placed.add(hw.id);
    } else if (isComingUp(hw.submissionDate, today, comingUpDays)) {
      comingUp.push(toBriefHomework(hw));
      placed.add(hw.id);
    }
  }

  const recentStart = addDaysYmd(today, -(recentHomeworkDays - 1));
  const recentHomework: DailyBriefHomeworkItem[] = [];
  for (const hw of homework) {
    if (placed.has(hw.id)) continue;
    // Only items without a reliable due (or due outside urgent windows) with recent sentDate.
    const sent = toSortableDate(hw.sentDate) || '';
    if (!sent || !recentStart || sent < recentStart || sent > today) continue;
    recentHomework.push(toBriefHomework(hw));
  }

  const noticeStart = addDaysYmd(today, -(recentNoticeDays - 1));
  const recentNotices = notices
    .filter((n) => {
      const d = toSortableDate(n.date) || '';
      if (!d || !noticeStart) return false;
      return d >= noticeStart && d <= today;
    })
    .sort((a, b) => {
      const da = toSortableDate(a.date) || '';
      const db = toSortableDate(b.date) || '';
      if (da !== db) return db.localeCompare(da);
      return (b.time || '').localeCompare(a.time || '');
    })
    .slice(0, recentNoticeLimit)
    .map(toBriefNotice);

  const nothingUrgent =
    overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0;

  return {
    today,
    section,
    overdue: sortByDueAsc(overdue),
    dueToday: sortByDueAsc(dueToday),
    dueTomorrow: sortByDueAsc(dueTomorrow),
    comingUp: sortByDueAsc(comingUp),
    recentHomework: sortBySentDesc(recentHomework),
    recentNotices,
    calendarItems: calendarItems.filter((c) => c.date === today || c.date === addDaysYmd(today, 1)),
    nothingUrgent,
  };
}

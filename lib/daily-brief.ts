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
  type?: 'holiday' | 'event' | 'activity' | 'important';
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

export const ATTENTION_OVERDUE_DAYS = 14;
export const ATTENTION_LIMIT = 3;
/** Planner rows kept on the brief: today through this many days ahead. */
export const BRIEF_CALENDAR_AHEAD_DAYS = 7;

export type AttentionKind = 'notice' | 'due_today' | 'overdue' | 'due_tomorrow' | 'recent';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  meta: string;
  href: '/homework' | '/updates';
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
  /** Optional school calendar rows already known for today through the lookahead window. */
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

export type HomeworkDayBucket = 'today' | 'upcoming' | 'passed' | 'none';

/**
 * Homework page Today / Upcoming filter.
 *
 * Prefer a reliable school due date (NeverSkip dueDate → UI submissionDate).
 * When due is absent, use homework assignment date (homeworkDate → sentDate).
 * Does not invent dues from free-text notes like "Submission of book -16/9/26".
 */
export function homeworkDayBucket(
  hw: { submissionDate?: string | null; sentDate?: string | null },
  today: string,
): HomeworkDayBucket {
  if (hasReliableDueDate(hw.submissionDate)) {
    const due = toSortableDate(hw.submissionDate!);
    if (due < today) return 'passed';
    if (due === today) return 'today';
    return 'upcoming';
  }
  const sent = toSortableDate(hw.sentDate || '');
  if (!sent || !YMD_RE.test(sent)) return 'none';
  if (sent < today) return 'passed';
  if (sent === today) return 'today';
  return 'upcoming';
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

/** Overdue, but only if the due date is still within the recent window. */
export function isRecentlyOverdue(
  submissionDate: string | undefined,
  today: string,
  windowDays = ATTENTION_OVERDUE_DAYS,
): boolean {
  if (!isOverdue(submissionDate, today)) return false;
  const due = dueYmd(submissionDate);
  const start = addDaysYmd(today, -windowDays);
  return Boolean(due && start && due >= start);
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
    calendarItems: calendarItems.filter((c) => {
      const end = addDaysYmd(today, BRIEF_CALENDAR_AHEAD_DAYS);
      return !!c.date && c.date >= today && (!end || c.date <= end);
    }),
    nothingUrgent,
  };
}

function homeworkTitle(hw: DailyBriefHomeworkItem): string {
  return hw.title ? `${hw.subject} — ${hw.title}` : hw.subject;
}

/** Drop the school greeting so circulars don’t all look the same. */
export function stripSchoolGreeting(text: string): string {
  let out = text.trim();
  out = out.replace(/^(jai\s+(sri|shri|shree|sree)\s+gurudev[!.]?\s*)+/gi, '');
  out = out.replace(/^namaste\s+/i, '');
  out = out.replace(
    /^dear\s+(parents?|students?|children)(\s+and\s+(students?|parents?|children))?\s*,?\s*/i,
    '',
  );
  return out.replace(/\s+/g, ' ').trim();
}

function noticeFingerprint(title: string): string {
  const cleaned = stripSchoolGreeting(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return cleaned.slice(0, 48);
}

/**
 * Home “needs attention” list: only things that need action.
 * Circulars/notices collapse to one Updates row — never three copies of
 * “Jai Sri Gurudev Namaste Dear Parents…”.
 */
export function buildAttentionItems(
  brief: DailyBrief,
  options?: { limit?: number; overdueDays?: number; unreadUpdates?: number },
): AttentionItem[] {
  const limit = options?.limit ?? ATTENTION_LIMIT;
  const overdueDays = options?.overdueDays ?? ATTENTION_OVERDUE_DAYS;
  const unreadUpdates = options?.unreadUpdates ?? 0;
  const items: AttentionItem[] = [];

  for (const hw of brief.dueToday) {
    items.push({
      id: `hw:${hw.id}`,
      kind: 'due_today',
      title: homeworkTitle(hw),
      meta: 'Due today',
      href: '/homework',
    });
  }

  const recentOverdue = brief.overdue
    .filter((hw) => isRecentlyOverdue(hw.submissionDate, brief.today, overdueDays))
    .sort((a, b) => {
      const da = dueYmd(a.submissionDate) || '';
      const db = dueYmd(b.submissionDate) || '';
      return db.localeCompare(da);
    });

  for (const hw of recentOverdue) {
    items.push({
      id: `hw:${hw.id}`,
      kind: 'overdue',
      title: homeworkTitle(hw),
      meta: hw.submissionDate
        ? `Due date passed · ${formatBriefDate(hw.submissionDate)}`
        : 'Due date passed',
      href: '/homework',
    });
  }

  for (const hw of brief.dueTomorrow) {
    items.push({
      id: `hw:${hw.id}`,
      kind: 'due_tomorrow',
      title: homeworkTitle(hw),
      meta: 'Due tomorrow',
      href: '/homework',
    });
  }

  const noticeCount = Math.max(unreadUpdates, brief.recentNotices.length);
  const uniqueNotices: DailyBriefNoticeItem[] = [];
  const seenPrints = new Set<string>();
  for (const notice of brief.recentNotices) {
    const print = noticeFingerprint(notice.summary || '');
    if (!print || seenPrints.has(print)) continue;
    seenPrints.add(print);
    uniqueNotices.push(notice);
  }
  if (items.length < limit && noticeCount > 0) {
    const first = uniqueNotices[0];
    const cleaned = first ? stripSchoolGreeting(first.summary) : '';
    const oneDistinct = uniqueNotices.length === 1 && cleaned;
    items.push({
      id: 'updates',
      kind: 'notice',
      title: oneDistinct
        ? cleaned
        : `${noticeCount} new school update${noticeCount === 1 ? '' : 's'}`,
      meta: 'View',
      href: '/updates',
    });
  }

  return dedupeById(items).slice(0, limit);
}

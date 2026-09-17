/**
 * Concise Updates change feed.
 *
 * NEW/CHANGED: first insert (createdAt) or ContentChangeEvent — not homeworkDate === today.
 * RECENT: remaining notices ordered by publishedDate/time (fallback createdAt).
 * Re-fetching an unchanged record must not create another "new" item.
 */

import { uiHomeworkId, uiNoticeId } from '@/lib/neverskip/ids';
import { formatRelativeTimeIndia, type FieldChange } from '@/lib/neverskip/changes';
import { homeworkSectionsForUi, noticeSummaryForUi, resolveNoticeClassesForUi } from '@/lib/ui-merge';
import { addDaysYmd, getIndiaToday } from '@/lib/daily-brief';
import { isNewerThan } from '@/lib/updates-unread';
import libraryData from '@/data/content-library.json';
import {
  resolveNoticeLibraryLink,
  type LibraryResourceRef,
} from '@/lib/notice-library-link';

const LIBRARY_RESOURCES: LibraryResourceRef[] = (
  libraryData.resources as { id: string; title: string; date: string }[]
).map((r) => ({ id: r.id, title: r.title, date: r.date }));

function noticeLibraryHref(notice: {
  title?: string;
  summary?: string;
  content?: string;
  publishedDate?: string;
}): string | undefined {
  const link = resolveNoticeLibraryLink(
    {
      summary: notice.summary || notice.title || '',
      message: notice.content || '',
      date: notice.publishedDate || '',
    },
    LIBRARY_RESOURCES,
  );
  return link?.href;
}

export type UpdateFeedKind = 'new' | 'changed' | 'recent';
export type UpdateFeedType = 'homework' | 'notice';
export type UpdateFeedSection = 'new' | 'recent';

export interface UpdateFeedChangeField {
  field: string;
  label: string;
  previous: string | null;
  current: string | null;
  reliable: boolean;
}

export interface UpdateFeedItem {
  id: string;
  kind: UpdateFeedKind;
  type: UpdateFeedType;
  /** NEW/CHANGED vs RECENT (school publication list). */
  section: UpdateFeedSection;
  source: string;
  sourceId: string;
  uiId: string;
  subject?: string;
  title: string;
  occurredAt: string;
  sourceDate: string;
  /** HH:mm when known (notices). */
  sourceTime?: string;
  sections: string[];
  href: string;
  changedFields: UpdateFeedChangeField[];
  /** Content Library CTA when notice text mentions it (never invents resource ids). */
  libraryHref?: string;
}

export interface UpdateFeedHomeworkRow {
  id: string;
  source: string;
  sourceId: string;
  subjectName: string;
  title: string;
  createdAt: Date | string;
  homeworkDate: string;
  sections: string[];
}

export interface UpdateFeedNoticeRow {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  summary: string;
  content: string;
  createdAt: Date | string;
  publishedDate: string;
  publishedTime?: string;
  classes: string[];
}

export interface UpdateFeedChangeRow {
  id: string;
  entityType: string;
  source: string;
  sourceId: string;
  entityId: string;
  detectedAt: Date | string;
  changedFields: UpdateFeedChangeField[];
  title?: string;
  subject?: string;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function toMs(value: Date | string): number {
  const d = value instanceof Date ? value : new Date(value);
  return d.getTime();
}

function entityKey(type: UpdateFeedType, source: string, sourceId: string): string {
  return `${type}:${source}:${sourceId}`;
}

function homeworkHref(uiId: string): string {
  return `/homework?item=${encodeURIComponent(uiId)}`;
}

function noticeHref(uiId: string): string {
  return `/notices?item=${encodeURIComponent(uiId)}`;
}

function asChangeFields(fields: FieldChange[] | UpdateFeedChangeField[]): UpdateFeedChangeField[] {
  return fields.map((c) => ({
    field: c.field,
    label: c.label,
    previous: c.previous,
    current: c.current,
    reliable: c.reliable,
  }));
}

function normalizePublishedTime(raw?: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Sort key for RECENT notices: publishedDate+time, else createdAt ISO. Newest first via localeCompare desc. */
export function noticePublicationSortKey(notice: {
  publishedDate?: string | null;
  publishedTime?: string | null;
  createdAt: Date | string;
}): string {
  const date = String(notice.publishedDate ?? '').trim();
  if (YMD_RE.test(date)) {
    const time = normalizePublishedTime(notice.publishedTime) || '00:00';
    return `${date}T${time}:00`;
  }
  return toIso(notice.createdAt) || '0000-00-00T00:00:00';
}

function indiaDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatDayMonth(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}`;
}

/**
 * Parent-facing calendar label for a school date.
 * Prefer sourceDate (published/assigned); fall back to createdAt's India day.
 */
export function formatUpdateDisplayDate(
  sourceDate: string,
  createdAt?: string,
  now: Date = new Date(),
): string {
  let ymd = YMD_RE.test(sourceDate) ? sourceDate : '';
  if (!ymd && createdAt) {
    const at = new Date(createdAt);
    if (!Number.isNaN(at.getTime())) ymd = indiaDay(at);
  }
  if (!ymd) return '';
  const today = getIndiaToday(now);
  if (ymd === today) return 'Today';
  const yesterday = addDaysYmd(today, -1);
  if (yesterday && ymd === yesterday) return 'Yesterday';
  return formatDayMonth(ymd);
}

export function partitionUpdatesFeed(items: UpdateFeedItem[]): {
  newItems: UpdateFeedItem[];
  recentItems: UpdateFeedItem[];
} {
  const newItems: UpdateFeedItem[] = [];
  const recentItems: UpdateFeedItem[] = [];
  for (const item of items) {
    if (item.section === 'recent') recentItems.push(item);
    else newItems.push(item);
  }
  return { newItems, recentItems };
}

/**
 * One row per sourceId in NEW/CHANGED; RECENT fills remaining notices by publication date.
 */
export function buildUpdatesFeed(input: {
  homework: UpdateFeedHomeworkRow[];
  notices: UpdateFeedNoticeRow[];
  changes: UpdateFeedChangeRow[];
  since: Date;
  /** YYYY-MM-DD inclusive lower bound for RECENT notices (India calendar). */
  publishedSinceYmd?: string;
}): UpdateFeedItem[] {
  const sinceMs = input.since.getTime();
  const publishedSince = input.publishedSinceYmd?.trim() || '';
  const latestChange = new Map<string, UpdateFeedChangeRow>();

  for (const change of input.changes) {
    const detectedMs = toMs(change.detectedAt);
    if (!Number.isFinite(detectedMs) || detectedMs < sinceMs) continue;
    const type: UpdateFeedType = change.entityType === 'notice' ? 'notice' : 'homework';
    const key = entityKey(type, change.source || 'neverskip', change.sourceId);
    const existing = latestChange.get(key);
    if (!existing || detectedMs > toMs(existing.detectedAt)) {
      latestChange.set(key, change);
    }
  }

  const newItems: UpdateFeedItem[] = [];
  const covered = new Set<string>();
  const newNoticeKeys = new Set<string>();

  for (const hw of input.homework) {
    const source = hw.source || 'neverskip';
    const key = entityKey('homework', source, hw.sourceId);
    covered.add(key);
    const createdMs = toMs(hw.createdAt);
    const change = latestChange.get(key);
    const changeMs = change ? toMs(change.detectedAt) : 0;
    const uiId = uiHomeworkId(hw.sourceId, source);
    const sections = homeworkSectionsForUi(hw.sections);
    const title = hw.title.trim() || 'Homework';
    const subject = hw.subjectName.trim() || undefined;

    if (change && changeMs >= createdMs && changeMs >= sinceMs) {
      newItems.push({
        id: `chg:${change.id}`,
        kind: 'changed',
        section: 'new',
        type: 'homework',
        source,
        sourceId: hw.sourceId,
        uiId,
        subject,
        title: change.title?.trim() || title,
        occurredAt: toIso(change.detectedAt),
        sourceDate: hw.homeworkDate,
        sections,
        href: homeworkHref(uiId),
        changedFields: asChangeFields(change.changedFields),
      });
      continue;
    }

    if (Number.isFinite(createdMs) && createdMs >= sinceMs) {
      newItems.push({
        id: `new:homework:${source}:${hw.sourceId}`,
        kind: 'new',
        section: 'new',
        type: 'homework',
        source,
        sourceId: hw.sourceId,
        uiId,
        subject,
        title,
        occurredAt: toIso(hw.createdAt),
        sourceDate: hw.homeworkDate,
        sections,
        href: homeworkHref(uiId),
        changedFields: [],
      });
    }
  }

  for (const notice of input.notices) {
    const source = notice.source || 'neverskip';
    const key = entityKey('notice', source, notice.sourceId);
    covered.add(key);
    const createdMs = toMs(notice.createdAt);
    const change = latestChange.get(key);
    const changeMs = change ? toMs(change.detectedAt) : 0;
    const uiId = uiNoticeId(notice.sourceId, source);
    const sections = resolveNoticeClassesForUi(
      notice.classes,
      notice.title,
      notice.summary,
      notice.content,
    );
    const title = noticeSummaryForUi(notice.title, notice.summary, notice.content) || 'School notice';
    const sourceTime = normalizePublishedTime(notice.publishedTime) || undefined;
    const libraryHref = noticeLibraryHref(notice);

    if (change && changeMs >= createdMs && changeMs >= sinceMs) {
      newNoticeKeys.add(key);
      newItems.push({
        id: `chg:${change.id}`,
        kind: 'changed',
        section: 'new',
        type: 'notice',
        source,
        sourceId: notice.sourceId,
        uiId,
        title: change.title?.trim() || title,
        occurredAt: toIso(change.detectedAt),
        sourceDate: notice.publishedDate,
        sourceTime,
        sections,
        href: noticeHref(uiId),
        changedFields: asChangeFields(change.changedFields),
        libraryHref,
      });
      continue;
    }

    if (Number.isFinite(createdMs) && createdMs >= sinceMs) {
      newNoticeKeys.add(key);
      newItems.push({
        id: `new:notice:${source}:${notice.sourceId}`,
        kind: 'new',
        section: 'new',
        type: 'notice',
        source,
        sourceId: notice.sourceId,
        uiId,
        title,
        occurredAt: toIso(notice.createdAt),
        sourceDate: notice.publishedDate,
        sourceTime,
        sections,
        href: noticeHref(uiId),
        changedFields: [],
        libraryHref,
      });
    }
  }

  // Changed rows whose entity was imported before `since` (not in the insert windows).
  for (const [key, change] of latestChange) {
    if (covered.has(key)) continue;
    const type: UpdateFeedType = change.entityType === 'notice' ? 'notice' : 'homework';
    const source = change.source || 'neverskip';
    const uiId = type === 'homework' ? uiHomeworkId(change.sourceId, source) : uiNoticeId(change.sourceId, source);
    if (type === 'notice') newNoticeKeys.add(key);
    newItems.push({
      id: `chg:${change.id}`,
      kind: 'changed',
      section: 'new',
      type,
      source,
      sourceId: change.sourceId,
      uiId,
      subject: change.subject,
      title: change.title?.trim() || (type === 'homework' ? 'Homework' : 'School notice'),
      occurredAt: toIso(change.detectedAt),
      sourceDate: '',
      sections: [],
      href: type === 'homework' ? homeworkHref(uiId) : noticeHref(uiId),
      changedFields: asChangeFields(change.changedFields),
    });
  }

  newItems.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const recentItems: UpdateFeedItem[] = [];
  for (const notice of input.notices) {
    const source = notice.source || 'neverskip';
    const key = entityKey('notice', source, notice.sourceId);
    if (newNoticeKeys.has(key)) continue;

    const pub = String(notice.publishedDate ?? '').trim();
    const inPublishWindow =
      !publishedSince ||
      (YMD_RE.test(pub) && pub >= publishedSince) ||
      (!YMD_RE.test(pub) && toMs(notice.createdAt) >= sinceMs);
    if (!inPublishWindow) continue;

    const uiId = uiNoticeId(notice.sourceId, source);
    const sections = resolveNoticeClassesForUi(
      notice.classes,
      notice.title,
      notice.summary,
      notice.content,
    );
    const title = noticeSummaryForUi(notice.title, notice.summary, notice.content) || 'School notice';
    const sourceTime = normalizePublishedTime(notice.publishedTime) || undefined;
    const sortKey = noticePublicationSortKey(notice);
    const libraryHref = noticeLibraryHref(notice);

    recentItems.push({
      id: `recent:notice:${source}:${notice.sourceId}`,
      kind: 'recent',
      section: 'recent',
      type: 'notice',
      source,
      sourceId: notice.sourceId,
      uiId,
      title,
      occurredAt: toIso(notice.createdAt) || sortKey,
      sourceDate: YMD_RE.test(pub) ? pub : '',
      sourceTime,
      sections,
      href: noticeHref(uiId),
      changedFields: [],
      libraryHref,
    });
  }

  recentItems.sort((a, b) => {
    const ka = noticePublicationSortKey({
      publishedDate: a.sourceDate,
      publishedTime: a.sourceTime,
      createdAt: a.occurredAt,
    });
    const kb = noticePublicationSortKey({
      publishedDate: b.sourceDate,
      publishedTime: b.sourceTime,
      createdAt: b.occurredAt,
    });
    if (ka !== kb) return kb.localeCompare(ka);
    return b.id.localeCompare(a.id);
  });

  return [...newItems, ...recentItems];
}

export function filterUpdatesBySection(items: UpdateFeedItem[], section: string): UpdateFeedItem[] {
  if (!section) return items;
  return items.filter((item) => {
    if (item.sections.length === 0) return true;
    return item.sections.includes(section) || item.sections.includes('ALL');
  });
}

export function countUnreadUpdates(items: UpdateFeedItem[], lastSeen: string | null): number {
  return items
    .filter((item) => item.section === 'new')
    .filter((item) => isNewerThan(item.occurredAt, lastSeen)).length;
}

export function formatUpdateOccurredLabel(
  kind: UpdateFeedKind,
  occurredAt: string,
  now: Date = new Date(),
): string {
  if (kind === 'recent') return '';
  const at = new Date(occurredAt);
  if (Number.isNaN(at.getTime())) return kind === 'new' ? 'Added' : 'Changed';
  if (kind === 'new' && indiaDay(at) === indiaDay(now)) return 'Added today';
  const rel = formatRelativeTimeIndia(at, now);
  if (kind === 'new') return rel ? `Added ${rel}` : 'Added';
  return rel ? `Changed ${rel}` : 'Changed';
}

export function formatUpdateSourceDateLabel(type: UpdateFeedType, sourceDate: string): string {
  if (!sourceDate || !YMD_RE.test(sourceDate)) return '';
  const label = formatDayMonth(sourceDate);
  return type === 'homework' ? `Assigned ${label}` : `Published ${label}`;
}

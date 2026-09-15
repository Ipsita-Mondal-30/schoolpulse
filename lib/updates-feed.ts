/**
 * Concise Updates change feed.
 *
 * Newness comes from ImportedHomework / ImportedNotice createdAt (first insert
 * of a stable sourceId), not homeworkDate / publishedDate.
 * Changes come from persisted ContentChangeEvent rows.
 * Re-fetching an unchanged record must not create another "new" item.
 */

import { uiHomeworkId, uiNoticeId } from '@/lib/neverskip/ids';
import { formatRelativeTimeIndia, type FieldChange } from '@/lib/neverskip/changes';
import { homeworkSectionsForUi, noticeSummaryForUi, resolveNoticeClassesForUi } from '@/lib/ui-merge';
import { isNewerThan } from '@/lib/updates-unread';

export type UpdateFeedKind = 'new' | 'changed';
export type UpdateFeedType = 'homework' | 'notice';

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
  source: string;
  sourceId: string;
  uiId: string;
  subject?: string;
  title: string;
  occurredAt: string;
  sourceDate: string;
  sections: string[];
  href: string;
  changedFields: UpdateFeedChangeField[];
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

/**
 * One row per sourceId: "changed" wins when a later ContentChangeEvent exists,
 * otherwise a first insert in the window is "new". Unchanged re-syncs are ignored.
 */
export function buildUpdatesFeed(input: {
  homework: UpdateFeedHomeworkRow[];
  notices: UpdateFeedNoticeRow[];
  changes: UpdateFeedChangeRow[];
  since: Date;
}): UpdateFeedItem[] {
  const sinceMs = input.since.getTime();
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

  const items: UpdateFeedItem[] = [];
  const covered = new Set<string>();

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
      items.push({
        id: `chg:${change.id}`,
        kind: 'changed',
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
      items.push({
        id: `new:homework:${source}:${hw.sourceId}`,
        kind: 'new',
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

    if (change && changeMs >= createdMs && changeMs >= sinceMs) {
      items.push({
        id: `chg:${change.id}`,
        kind: 'changed',
        type: 'notice',
        source,
        sourceId: notice.sourceId,
        uiId,
        title: change.title?.trim() || title,
        occurredAt: toIso(change.detectedAt),
        sourceDate: notice.publishedDate,
        sections,
        href: noticeHref(uiId),
        changedFields: asChangeFields(change.changedFields),
      });
      continue;
    }

    if (Number.isFinite(createdMs) && createdMs >= sinceMs) {
      items.push({
        id: `new:notice:${source}:${notice.sourceId}`,
        kind: 'new',
        type: 'notice',
        source,
        sourceId: notice.sourceId,
        uiId,
        title,
        occurredAt: toIso(notice.createdAt),
        sourceDate: notice.publishedDate,
        sections,
        href: noticeHref(uiId),
        changedFields: [],
      });
    }
  }

  // Changed rows whose entity was imported before `since` (not in the insert windows).
  for (const [key, change] of latestChange) {
    if (covered.has(key)) continue;
    const type: UpdateFeedType = change.entityType === 'notice' ? 'notice' : 'homework';
    const source = change.source || 'neverskip';
    const uiId = type === 'homework' ? uiHomeworkId(change.sourceId, source) : uiNoticeId(change.sourceId, source);
    items.push({
      id: `chg:${change.id}`,
      kind: 'changed',
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

  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return items;
}

export function filterUpdatesBySection(items: UpdateFeedItem[], section: string): UpdateFeedItem[] {
  if (!section) return items;
  return items.filter((item) => {
    if (item.sections.length === 0) return true;
    return item.sections.includes(section) || item.sections.includes('ALL');
  });
}

export function countUnreadUpdates(items: UpdateFeedItem[], lastSeen: string | null): number {
  return items.filter((item) => isNewerThan(item.occurredAt, lastSeen)).length;
}

function indiaDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatUpdateOccurredLabel(
  kind: UpdateFeedKind,
  occurredAt: string,
  now: Date = new Date(),
): string {
  const at = new Date(occurredAt);
  if (Number.isNaN(at.getTime())) return kind === 'new' ? 'Added' : 'Changed';
  if (kind === 'new' && indiaDay(at) === indiaDay(now)) return 'Added today';
  const rel = formatRelativeTimeIndia(at, now);
  if (kind === 'new') return rel ? `Added ${rel}` : 'Added';
  return rel ? `Changed ${rel}` : 'Changed';
}

export function formatUpdateSourceDateLabel(type: UpdateFeedType, sourceDate: string): string {
  if (!sourceDate || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return '';
  const [, m, d] = sourceDate.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${d} ${months[m - 1]}`;
  return type === 'homework' ? `Assigned ${label}` : `Published ${label}`;
}

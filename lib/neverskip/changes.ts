/**
 * Meaningful NeverSkip change detection.
 * Only compare normalized source fields — never invent previous values.
 */

import type { NormalizedHomework, NormalizedNotice } from './types';

export type ChangeEntityType = 'homework' | 'notice' | 'jol';

export interface FieldChange {
  field: string;
  label: string;
  /** Serialized previous value; null if not reliably available. */
  previous: string | null;
  /** Serialized current value; null if cleared/absent. */
  current: string | null;
  /** True when both previous and current are reliable for A → B display. */
  reliable: boolean;
}

export interface HomeworkSnapshot {
  refId: string | null;
  subjectId: string | null;
  subjectName: string;
  title: string;
  description: string;
  sections: string[];
  homeworkDate: string;
  dueDate: string | null;
  attachmentUrl: string | null;
}

export interface NoticeSnapshot {
  title: string;
  summary: string;
  content: string;
  publishedDate: string;
  publishedTime: string;
  classes: string[];
  imageUrl: string | null;
}

const HOMEWORK_USER_FIELDS = new Set([
  'subjectName',
  'title',
  'description',
  'sections',
  'homeworkDate',
  'dueDate',
  'attachmentUrl',
]);

const NOTICE_USER_FIELDS = new Set([
  'title',
  'summary',
  'content',
  'publishedDate',
  'publishedTime',
  'classes',
  'imageUrl',
]);

function normalizeComparable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t;
  }
  if (Array.isArray(value)) {
    // Stable order so section/class reorder alone is not a content change.
    return JSON.stringify([...value.map(String)].sort());
  }
  return String(value);
}

function valuesEqual(a: string | null, b: string | null): boolean {
  return a === b;
}

/** Collapse whitespace for trivial text-equivalence checks. */
export function collapseText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when previous/current differ only by whitespace/casing noise — not a parent-facing edit.
 */
export function isTrivialTextFieldChange(previous: string | null, current: string | null): boolean {
  return collapseText(previous).toLowerCase() === collapseText(current).toLowerCase();
}

function pushChange(
  out: FieldChange[],
  field: string,
  label: string,
  previousRaw: unknown,
  currentRaw: unknown,
): void {
  const previous = normalizeComparable(previousRaw);
  const current = normalizeComparable(currentRaw);
  if (valuesEqual(previous, current)) return;

  // Ignore whitespace-only instruction/title/content churn from re-normalization.
  if (
    (field === 'description' ||
      field === 'title' ||
      field === 'content' ||
      field === 'summary' ||
      field === 'subjectName') &&
    isTrivialTextFieldChange(previous, current)
  ) {
    return;
  }

  const reliable = previous !== null || current !== null;

  out.push({ field, label, previous, current, reliable });
}

export function homeworkSnapshot(item: NormalizedHomework): HomeworkSnapshot {
  return {
    refId: item.refId,
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    title: item.title,
    description: item.description,
    sections: [...item.sections],
    homeworkDate: item.homeworkDate,
    dueDate: item.dueDate,
    attachmentUrl: item.attachmentUrl,
  };
}

export function noticeSnapshot(item: NormalizedNotice): NoticeSnapshot {
  return {
    title: item.title,
    summary: item.summary,
    content: item.content,
    publishedDate: item.publishedDate,
    publishedTime: item.publishedTime,
    classes: [...item.classes],
    imageUrl: item.imageUrl,
  };
}

export function getMeaningfulHomeworkChanges(
  previous: NormalizedHomework,
  current: NormalizedHomework,
): FieldChange[] {
  const out: FieldChange[] = [];
  pushChange(out, 'refId', 'Reference', previous.refId, current.refId);
  pushChange(out, 'subjectId', 'Subject id', previous.subjectId, current.subjectId);
  pushChange(out, 'subjectName', 'Subject', previous.subjectName, current.subjectName);
  pushChange(out, 'title', 'Title', previous.title, current.title);
  pushChange(out, 'description', 'Instructions', previous.description, current.description);
  pushChange(out, 'sections', 'Sections', previous.sections, current.sections);
  pushChange(out, 'homeworkDate', 'Assigned date', previous.homeworkDate, current.homeworkDate);
  pushChange(out, 'dueDate', 'Due date', previous.dueDate, current.dueDate);
  pushChange(out, 'attachmentUrl', 'Attachment', previous.attachmentUrl, current.attachmentUrl);
  return out;
}

export function getMeaningfulNoticeChanges(
  previous: NormalizedNotice,
  current: NormalizedNotice,
): FieldChange[] {
  const out: FieldChange[] = [];
  pushChange(out, 'title', 'Title', previous.title, current.title);
  pushChange(out, 'summary', 'Summary', previous.summary, current.summary);
  pushChange(out, 'content', 'Notice content', previous.content, current.content);
  pushChange(out, 'publishedDate', 'Published date', previous.publishedDate, current.publishedDate);
  pushChange(out, 'publishedTime', 'Published time', previous.publishedTime, current.publishedTime);
  pushChange(out, 'classes', 'Classes', previous.classes, current.classes);
  pushChange(out, 'imageUrl', 'Image', previous.imageUrl, current.imageUrl);
  return out;
}

/** User-facing fields only (hide internal ref/subject ids from primary copy). */
export function userVisibleChanges(
  entityType: ChangeEntityType,
  changes: FieldChange[],
): FieldChange[] {
  const allow = entityType === 'homework' ? HOMEWORK_USER_FIELDS : NOTICE_USER_FIELDS;
  return changes.filter((c) => allow.has(c.field));
}

/**
 * Parent-relevant homework fields that warrant an Updates card.
 * Excludes internal ids; sections-only audience expansion is handled separately.
 */
export const PARENT_HOMEWORK_CHANGE_FIELDS = new Set([
  'subjectName',
  'title',
  'description',
  'homeworkDate',
  'dueDate',
  'attachmentUrl',
  'sections',
]);

export const PARENT_NOTICE_CHANGE_FIELDS = new Set([
  'title',
  'summary',
  'content',
  'publishedDate',
  'publishedTime',
  'classes',
  'imageUrl',
]);

export function parentRelevantChanges(
  entityType: ChangeEntityType,
  changes: FieldChange[],
): FieldChange[] {
  const allow =
    entityType === 'notice' ? PARENT_NOTICE_CHANGE_FIELDS : PARENT_HOMEWORK_CHANGE_FIELDS;
  return changes.filter((c) => allow.has(c.field));
}

/**
 * Proven false-positive: historical I-A-only → full Class 1 audience rewrite on sync.
 * Safe to hide from Updates and to clean up from ContentChangeEvent.
 */
export function isLegacyAudienceOnlyChange(changes: FieldChange[]): boolean {
  if (changes.length !== 1 || changes[0].field !== 'sections') return false;
  try {
    const prev = JSON.parse(changes[0].previous || '[]') as unknown;
    const next = JSON.parse(changes[0].current || '[]') as unknown;
    if (!Array.isArray(prev) || !Array.isArray(next)) return false;
    const prevS = prev.map(String);
    const nextS = next.map(String);
    if (!(prevS.length === 1 && prevS[0] === 'I-A')) return false;
    // Full Class 1 A–K (or any expansion beyond sole I-A)
    return nextS.length > 1 && nextS.includes('I-A');
  } catch {
    return false;
  }
}

/** True when a stored change event should never surface on the parent Updates page. */
export function isNoiseChangeEvent(
  entityType: ChangeEntityType,
  changes: FieldChange[],
): boolean {
  if (changes.length === 0) return true;
  if (entityType === 'homework' && isLegacyAudienceOnlyChange(changes)) return true;
  if (parentRelevantChanges(entityType, changes).length === 0) return true;
  return false;
}

export function hasReliablePreviousValue(changes: FieldChange[]): boolean {
  return userVisibleChanges('homework', changes).some(
    (c) => c.reliable && c.previous !== null,
  ) || userVisibleChanges('notice', changes).some(
    (c) => c.reliable && c.previous !== null,
  );
}

export function hasReliablePreviousForType(
  entityType: ChangeEntityType,
  changes: FieldChange[],
): boolean {
  return userVisibleChanges(entityType, changes).some(
    (c) => c.reliable && c.previous !== null,
  );
}

/**
 * Relative time for change cards (India calendar day awareness).
 * Uses Asia/Kolkata for "today"/"yesterday"; never invents absolute school times.
 */
export function formatRelativeTimeIndia(
  detectedAt: Date | string,
  now: Date = new Date(),
): string {
  const at = typeof detectedAt === 'string' ? new Date(detectedAt) : detectedAt;
  if (Number.isNaN(at.getTime())) return '';

  const diffMs = now.getTime() - at.getTime();
  if (diffMs < 0) return 'Just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const indiaDay = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const today = indiaDay(now);
  const thatDay = indiaDay(at);
  if (thatDay === today) return `${hours}h ago`;

  // Yesterday in IST: subtract one calendar day from today string via UTC noon math
  const [y, m, d] = today.split('-').map(Number);
  const yest = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  const yestStr = `${yest.getUTCFullYear()}-${String(yest.getUTCMonth() + 1).padStart(2, '0')}-${String(yest.getUTCDate()).padStart(2, '0')}`;
  if (thatDay === yestStr) return 'Yesterday';

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(at);
}

export function serializeFieldChanges(changes: FieldChange[]): string {
  return JSON.stringify(changes);
}

export function parseFieldChanges(raw: string): FieldChange[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map((c) => ({
      field: String(c.field ?? ''),
      label: String(c.label ?? c.field ?? ''),
      previous: c.previous === undefined || c.previous === null ? null : String(c.previous),
      current: c.current === undefined || c.current === null ? null : String(c.current),
      reliable: Boolean(c.reliable),
    }));
  } catch {
    return [];
  }
}

/** Format a stored snapshot value for parent display (never invent). */
export function formatChangeValue(field: string, raw: string | null): string {
  if (raw === null) return '—';
  if (field === 'sections' || field === 'classes') {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.join(', ') || '—';
    } catch {
      /* fall through */
    }
  }
  if (field === 'dueDate' || field === 'homeworkDate' || field === 'publishedDate') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [, m, d] = raw.split('-').map(Number);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `${d} ${months[m - 1]}`;
    }
  }
  if (field === 'attachmentUrl' || field === 'imageUrl') {
    return raw ? 'Yes' : '—';
  }
  // Truncate long instruction/content bodies
  if (raw.length > 160) return `${raw.slice(0, 157)}…`;
  return raw;
}

export interface ChangePresentationLine {
  heading: string;
  previous?: string;
  current?: string;
  showDiff: boolean;
}

/**
 * Build parent-facing lines. Only show A→B when reliable previous exists.
 * Never invent old values.
 */
export function presentChangeLines(
  entityType: ChangeEntityType,
  changes: FieldChange[],
): ChangePresentationLine[] {
  const visible = userVisibleChanges(entityType, changes);
  if (visible.length === 0) {
    return [
      {
        heading:
          entityType === 'homework'
            ? 'Homework details were updated.'
            : 'The school updated this notice.',
        showDiff: false,
      },
    ];
  }

  const lines: ChangePresentationLine[] = [];
  for (const c of visible) {
    if (c.reliable && c.previous !== null && c.current !== null) {
      lines.push({
        heading: `${c.label} changed`,
        previous: formatChangeValue(c.field, c.previous),
        current: formatChangeValue(c.field, c.current),
        showDiff: true,
      });
    } else if (c.reliable && c.previous === null && c.current !== null) {
      lines.push({
        heading: `${c.label} set`,
        current: formatChangeValue(c.field, c.current),
        showDiff: false,
      });
    } else if (c.reliable && c.previous !== null && c.current === null) {
      lines.push({
        heading: `${c.label} cleared`,
        previous: formatChangeValue(c.field, c.previous),
        showDiff: false,
      });
    } else {
      lines.push({
        heading:
          entityType === 'homework'
            ? 'Homework details were updated.'
            : 'Notice content was updated.',
        showDiff: false,
      });
    }
  }

  // Dedupe identical generic lines
  const seen = new Set<string>();
  return lines.filter((l) => {
    const key = `${l.heading}|${l.previous ?? ''}|${l.current ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

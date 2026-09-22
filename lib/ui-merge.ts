/**
 * Shared Homework / Notices merge helpers for SchoolPulse UI.
 * Keeps Prisma imports + JSON/sheet sources combined and deduped.
 */

import {
  defaultClass1Audience,
  isLegacyDefaultHomeworkAudience,
  parseClass1SectionsFromText,
} from '@/lib/class-sections';

export interface UiHomeworkItem {
  id: string;
  title: string;
  subject: string;
  sections: string[];
  description: string;
  submissionDate?: string;
  sentDate: string;
  attachmentImage?: string;
}

export interface UiNoticeItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  classes: string[];
  summary: string;
  message: string;
}

/** Normalize to YYYY-MM-DD when possible; return '' if unparseable. */
export function toSortableDate(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mon = months[m1[2].toLowerCase()];
    if (mon) return `${m1[3]}-${mon}-${m1[1].padStart(2, '0')}`;
  }

  const m2 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m2) {
    let year = m2[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/** Pull Class I section codes from free text (e.g. title "Classes: I-A, I-B"). */
export function parseSectionsFromText(...parts: string[]): string[] {
  const parsed = parseClass1SectionsFromText(...parts);
  if (parsed.length > 0) return parsed;
  const hay = parts.join(' ');
  // "Class: I" / "Class I" without section → Class 1 audience, not I-A-only
  if (/\bclass(?:es)?\s*:?\s*I\b/i.test(hay)) {
    return defaultClass1Audience();
  }
  return [];
}

/**
 * Imported homework with no targeting (or the historical I-A-only default)
 * is visible to every Class 1 section.
 */
export function homeworkSectionsForUi(sections: string[]): string[] {
  if (sections.length === 0 || isLegacyDefaultHomeworkAudience(sections)) {
    return defaultClass1Audience();
  }
  return sections;
}

/** Extract a YYYY-MM-DD from notice body text when publishedDate is missing. */
export function extractDateFromText(...parts: string[]): string {
  const hay = parts.join(' ');
  // Prefer ISO
  const iso = hay.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  // 4-Sep-2026
  const named = hay.match(/\b(\d{1,2}-[A-Za-z]{3}-20\d{2})\b/);
  if (named) return toSortableDate(named[1]);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = hay.match(/\b(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\b/);
  if (dmy) return toSortableDate(dmy[1]);
  return '';
}

export function mergeHomeworkItems(
  imported: UiHomeworkItem[],
  sheet: UiHomeworkItem[],
  local: UiHomeworkItem[],
): UiHomeworkItem[] {
  const byId = new Map<string, UiHomeworkItem>();
  const contentKeys = new Set<string>();

  const add = (item: UiHomeworkItem) => {
    if (!item.id) return;
    if (byId.has(item.id)) return;
    const sentDate = toSortableDate(item.sentDate) || item.sentDate || '';
    const normalized = { ...item, sentDate };
    const contentKey =
      `${normalized.sentDate}|${normalized.subject}|${normalized.title}|${normalized.description}`.toLowerCase();
    if (contentKeys.has(contentKey)) return;
    byId.set(normalized.id, normalized);
    contentKeys.add(contentKey);
  };

  imported.forEach(add);
  sheet.forEach(add);
  local.forEach(add);

  return Array.from(byId.values());
}

export function mergeNoticeItems(imported: UiNoticeItem[], local: UiNoticeItem[]): UiNoticeItem[] {
  const byId = new Map<string, UiNoticeItem>();
  const contentKeys = new Set<string>();

  const add = (item: UiNoticeItem) => {
    if (!item.id) return;
    if (byId.has(item.id)) return;
    const date = toSortableDate(item.date) || item.date || '';
    const normalized = { ...item, date };
    const contentKey =
      `${normalized.date}|${normalized.time}|${normalized.summary}|${normalized.message}`.toLowerCase();
    if (contentKeys.has(contentKey)) return;
    byId.set(normalized.id, normalized);
    contentKeys.add(contentKey);
  };

  imported.forEach(add);
  local.forEach(add);

  return Array.from(byId.values());
}

/** Normalize "9:05" / "9:5" / "09:05:00" → "09:05" for stable newest-first sorting. */
function normalizeNoticeTime(raw?: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '00:00';
  const m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return '00:00';
  const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Newest first by date then time; blank dates sink to the bottom. */
export function sortNoticesNewestFirst(items: UiNoticeItem[]): UiNoticeItem[] {
  return [...items].sort((a, b) => {
    const da = toSortableDate(a.date);
    const db = toSortableDate(b.date);
    if (!da && !db) {
      return normalizeNoticeTime(b.time).localeCompare(normalizeNoticeTime(a.time));
    }
    if (!da) return 1;
    if (!db) return -1;
    if (da === db) {
      return normalizeNoticeTime(b.time).localeCompare(normalizeNoticeTime(a.time));
    }
    return db.localeCompare(da);
  });
}

export function sortHomeworkDatesNewestFirst(dates: string[]): string[] {
  return [...dates].sort((a, b) => {
    const da = toSortableDate(a) || a;
    const db = toSortableDate(b) || b;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });
}

export function filterHomeworkBySection(
  items: UiHomeworkItem[],
  section: string | 'ALL',
): UiHomeworkItem[] {
  if (section === 'ALL') return items;
  return items.filter((hw) => hw.sections.includes(section));
}

export function filterNoticesByClass(
  items: UiNoticeItem[],
  activeClass: string | 'All',
): UiNoticeItem[] {
  if (activeClass === 'All') return items;
  return items.filter((n) => n.classes.includes(activeClass));
}

/** Prefer a readable summary when NeverSkip stored class targeting as the title. */
export function noticeSummaryForUi(title: string, summary: string, content: string): string {
  const s = (summary || title || '').trim();
  if (/^class(?:es)?\s*:/i.test(s)) {
    const first = content.replace(/\s+/g, ' ').trim().slice(0, 140);
    return first || s;
  }
  return s || content.replace(/\s+/g, ' ').trim().slice(0, 140);
}

/** UI-layer date when Prisma publishedDate is blank (does not alter ingestion). */
export function resolveNoticeDateForUi(opts: {
  publishedDate?: string | null;
  title?: string;
  summary?: string;
  content?: string;
  createdAt?: Date | string | null;
}): string {
  const fromPublished = toSortableDate(opts.publishedDate);
  if (fromPublished) return fromPublished;

  const fromText = extractDateFromText(
    opts.content || '',
    opts.title || '',
    opts.summary || '',
  );
  if (fromText) return fromText;

  if (opts.createdAt) {
    const d = opts.createdAt instanceof Date ? opts.createdAt : new Date(opts.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return '';
}

export function resolveNoticeClassesForUi(
  classes: string[],
  ...textParts: string[]
): string[] {
  if (classes.length > 0) return classes;
  const parsed = parseSectionsFromText(...textParts);
  return parsed.length > 0 ? parsed : defaultClass1Audience();
}

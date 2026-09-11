import { homeworkSourceId, noticeSourceId } from './ids';
import {
  NEVERSKIP_SOURCE,
  type NeverSkipFile,
  type NeverSkipHomeworkResponse,
  type NeverSkipNoticesResponse,
  type NeverSkipRawAssignment,
  type NeverSkipRawNotice,
  type NeverSkipNoticeTarget,
  type NormalizedHomework,
  type NormalizedNotice,
} from './types';

const DEFAULT_SECTIONS = ['I-A'];

function coerceItemList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extract assignment rows from NeverSkip getassignmentsapi envelopes.
 * Prefer D.item_list (live portal shape { S, D, F }) before generic `data` keys —
 * an empty `data: []` must not hide a populated D.item_list.
 */
export function extractAssignments(response: NeverSkipHomeworkResponse | null | undefined): NeverSkipRawAssignment[] {
  if (!response) return [];
  if (Array.isArray(response)) return response.filter(isObject);

  const r = response as Record<string, unknown>;

  // NeverSkip live envelope: { S, D: { item_list: [...] }, F }
  const D = r.D;
  if (D && typeof D === 'object') {
    if (Array.isArray(D)) return D.filter(isObject);
    const d = D as Record<string, unknown>;
    for (const key of ['item_list', 'assignments', 'result', 'data']) {
      const list = coerceItemList(d[key]);
      if (list) return list.filter(isObject);
    }
  }

  if (Array.isArray(r.assignments)) return r.assignments.filter(isObject);
  if (Array.isArray(r.result)) return r.result.filter(isObject);
  if (Array.isArray(r.item_list)) return r.item_list.filter(isObject);

  const data = r.data;
  if (Array.isArray(data)) return data.filter(isObject);
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const key of ['item_list', 'assignments', 'result']) {
      const list = coerceItemList(d[key]);
      if (list) return list.filter(isObject);
    }
  }

  return [];
}

export function extractNotices(response: NeverSkipNoticesResponse | null | undefined): NeverSkipRawNotice[] {
  if (!response || typeof response !== 'object') return [];
  if (Array.isArray(response.D?.item_list)) return response.D!.item_list!.filter(isObject);
  if (Array.isArray(response.item_list)) return response.item_list.filter(isObject);
  if (Array.isArray(response.data)) return response.data.filter(isObject);
  return [];
}

function isObject(v: unknown): v is NeverSkipRawAssignment & NeverSkipRawNotice {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse common NeverSkip / Indian date formats to YYYY-MM-DD. Returns '' if unparseable. */
export function normalizeDate(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return '';
  const s = String(raw).trim();

  // NeverSkip notice board: "03:51 PM | 11/09/2026" or "3:51 pm | 11-09-2026"
  const noticeStamp = s.match(
    /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*\|\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})$/i,
  );
  if (noticeStamp) {
    return normalizeDate(noticeStamp[2]);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // 4-Sep-2026 or 04-Sep-2026 (reject nonsense years like 30-Nov--0001)
  const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const yearNum = Number(m1[3]);
    if (yearNum < 1990 || yearNum > 2100) return '';
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mon = months[m1[2].toLowerCase()];
    if (mon) return `${m1[3]}-${mon}-${m1[1].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m2 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m2) {
    let year = m2[3];
    if (year.length === 2) year = `20${year}`;
    const yearNum = Number(year);
    if (yearNum < 1990 || yearNum > 2100) return '';
    return `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    if (y < 1990 || y > 2100) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return '';
}

/** Extract HH:mm from NeverSkip notice stamps like "03:51 PM | 11/09/2026". */
export function normalizeTime(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return '00:00';
  const s = String(raw).trim();

  const noticeStamp = s.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*\|/i);
  if (noticeStamp) {
    return normalizeTime(noticeStamp[1]);
  }

  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const ap = ampm[3].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '00:00';
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function extractSections(raw: NeverSkipRawAssignment): string[] {
  const fromFields = [
    ...asStringList(raw.sections),
    ...asStringList(raw.section),
    ...asStringList(raw.class_sec),
    ...asStringList(raw.class_name),
  ];
  const unique = Array.from(new Set(fromFields));
  if (unique.length > 0) return unique;
  // Class-1 MVP default when API provides no targeting (not a content correction)
  return [...DEFAULT_SECTIONS];
}

function extractAttachmentUrl(raw: NeverSkipRawAssignment): string | null {
  if (raw.download_url && String(raw.download_url).trim()) {
    return String(raw.download_url).trim();
  }
  const files = raw.ass_files;
  if (typeof files === 'string' && files.trim()) return files.trim();
  if (Array.isArray(files)) {
    for (const f of files as NeverSkipFile[]) {
      const url = f?.url || f?.file_url;
      if (url && String(url).trim()) return String(url).trim();
    }
  }
  return null;
}

function subjectNameFrom(raw: NeverSkipRawAssignment): string {
  const name = raw.subject_name || raw.subject;
  if (name && String(name).trim()) return String(name).trim();
  if (raw.subject_id != null && String(raw.subject_id).trim()) {
    return String(raw.subject_id).trim();
  }
  return 'General';
}

export function normalizeHomework(raw: NeverSkipRawAssignment): NormalizedHomework | null {
  const sourceId = homeworkSourceId(raw.assign_id, raw.refid);
  if (!sourceId) return null;

  const homeworkDate = normalizeDate(raw.ass_dt) || normalizeDate(raw.assign_dt);
  const dueDate =
    normalizeDate(raw.due_dt) ||
    normalizeDate(raw.submission_dt) ||
    null;

  return {
    source: NEVERSKIP_SOURCE,
    sourceId,
    refId: raw.refid != null ? String(raw.refid) : null,
    subjectId: raw.subject_id != null ? String(raw.subject_id) : null,
    subjectName: subjectNameFrom(raw),
    title: String(raw.assign_title ?? '').trim() || 'Homework',
    description: String(raw.assign_details ?? '').trim(),
    sections: extractSections(raw),
    homeworkDate,
    dueDate: dueDate || null,
    attachmentUrl: extractAttachmentUrl(raw),
  };
}

function classesFromTarget(target: NeverSkipRawNotice['test_tar']): string[] {
  if (!target) return [];
  if (typeof target === 'string') return asStringList(target);
  const t = target as NeverSkipNoticeTarget;
  const list = [
    ...asStringList(t.classes),
    ...asStringList(t.class),
    ...asStringList(t.sections),
    ...asStringList(t.section),
    ...asStringList(t.class_sec),
  ];
  return Array.from(new Set(list));
}

/** Live NeverSkip often puts audience in `title` as "Classes: I-A, I-B". */
function classesFromAudienceTitle(title: string): string[] {
  const m = title.trim().match(/^Classes?:\s*(.+)$/i);
  if (!m) return [];
  return m[1]
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAudienceTitle(title: string): boolean {
  return /^Classes?:\s*/i.test(title.trim());
}

function firstNormalizedDate(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      const n = normalizeDate(String(c));
      if (n) return n;
    }
  }
  return '';
}

function firstNormalizedTime(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      return normalizeTime(c);
    }
  }
  return '00:00';
}

function noticeDisplayTitle(audienceOrTitle: string, content: string): string {
  if (audienceOrTitle && !isAudienceTitle(audienceOrTitle)) return audienceOrTitle;
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return audienceOrTitle || 'Notice';
  // Prefer a short preview of the body when title is only an audience line.
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

export function normalizeNotice(raw: NeverSkipRawNotice): NormalizedNotice | null {
  const content = String(raw.cont ?? raw.content ?? raw.message ?? '').trim();
  const rawTitle = String(raw.title ?? '').trim();
  if (!content && !rawTitle) return null;

  const publishedDate = firstNormalizedDate(
    raw.date,
    raw.ntc_dt,
    raw.notice_dt,
    raw.msg_dt,
    raw.pub_dt,
    raw.crt_dt,
    raw.created_dt,
    raw.post_dt,
    raw.notice_date,
    raw.msg_date,
    raw.dt,
  );
  const publishedTime = firstNormalizedTime(
    typeof raw.time === 'string' ? raw.time : undefined,
    typeof raw.msg_time === 'string' ? raw.msg_time : undefined,
    typeof raw.ntc_tm === 'string' ? raw.ntc_tm : undefined,
    typeof raw.crt_tm === 'string' ? raw.crt_tm : undefined,
    // Combined stamp lives in `date` for live NeverSkip notices
    typeof raw.date === 'string' && raw.date.includes('|') ? raw.date : undefined,
  );

  const classesFromTargetList = classesFromTarget(raw.test_tar);
  const classes =
    classesFromTargetList.length > 0
      ? classesFromTargetList
      : classesFromAudienceTitle(rawTitle);

  const title = noticeDisplayTitle(rawTitle, content);
  const summary =
    title ||
    (content.length > 120 ? `${content.slice(0, 117)}...` : content) ||
    'Notice';

  const sourceId = noticeSourceId({
    id: raw.id,
    noticeId: raw.notice_id,
    date: publishedDate || (typeof raw.date === 'string' ? raw.date : ''),
    time: publishedTime,
    title: rawTitle || title,
    content,
  });

  return {
    source: NEVERSKIP_SOURCE,
    sourceId,
    title: title || summary,
    summary,
    content: content || rawTitle,
    publishedDate: publishedDate || '',
    publishedTime,
    classes,
    imageUrl: raw.image && String(raw.image).trim() ? String(raw.image).trim() : null,
  };
}

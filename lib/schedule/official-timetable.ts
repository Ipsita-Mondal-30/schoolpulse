/**
 * The school publishes each Joy of Learning timetable as a PDF attached to a Daily Notice
 * (e.g. "JOY OF LEARNING, WORKSHEET - II TIMETABLE", 19 Aug 2026). That attachment is the
 * authoritative document; dates in ImportedJolSchedule are extracted copies of it.
 */

export type OfficialTimetable = {
  noticeSourceId: string;
  title: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  url: string;
  fileName: string;
};

type NoticeRow = {
  sourceId: string;
  content: string;
  publishedDate: string;
  attachmentsJson: string;
};

const JOL_RE = /joy\s+of\s+learning|\bjol\b/i;
const TIMETABLE_RE = /time\s*-?\s*table/i;

function noticeTitle(content: string): string {
  const head = content.split('|')[0] ?? '';
  return head.split('\n')[0].trim().replace(/[:\s]+$/, '');
}

function firstAttachment(raw: string): { url: string; name: string } | null {
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return null;
    for (const a of list) {
      const url = typeof a?.url === 'string' ? a.url.trim() : '';
      if (/^https?:\/\//.test(url)) {
        return { url, name: typeof a.name === 'string' && a.name ? a.name : url.split('/').pop() || 'timetable' };
      }
    }
  } catch {
    // ignore malformed attachment JSON
  }
  return null;
}

/** Newest notice whose title announces a Joy of Learning timetable and carries a file. */
export function officialTimetableFromNotices(rows: NoticeRow[]): OfficialTimetable | null {
  const candidates = rows
    .map((row) => ({ row, title: noticeTitle(row.content), file: firstAttachment(row.attachmentsJson) }))
    .filter((c) => c.file && JOL_RE.test(c.title) && TIMETABLE_RE.test(c.title))
    .sort((a, b) => b.row.publishedDate.localeCompare(a.row.publishedDate));
  const best = candidates[0];
  if (!best?.file) return null;
  return {
    noticeSourceId: best.row.sourceId,
    title: best.title,
    publishedDate: best.row.publishedDate,
    url: best.file.url,
    fileName: best.file.name,
  };
}

export type JolTimetableStatus = {
  state: 'upcoming' | 'in_progress' | 'completed';
  firstDate: string;
  lastDate: string;
  /** Next dated entry on or after today (not set once completed). */
  next: { activityDate: string; label: string } | null;
  /** The school published a timetable after the last stored date — the stored dates are an older timetable. */
  newerOfficialPublished: boolean;
};

export function jolTimetableStatus(
  days: Array<{ activityDate: string; classI: string }>,
  today: string,
  official: Pick<OfficialTimetable, 'publishedDate'> | null,
): JolTimetableStatus | null {
  const dated = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.activityDate));
  if (dated.length === 0) return null;
  const sorted = [...dated].sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  const firstDate = sorted[0].activityDate;
  const lastDate = sorted[sorted.length - 1].activityDate;
  const nextDay = sorted.find((d) => d.activityDate >= today) ?? null;
  const state = !nextDay ? 'completed' : today < firstDate ? 'upcoming' : 'in_progress';
  return {
    state,
    firstDate,
    lastDate,
    next: nextDay ? { activityDate: nextDay.activityDate, label: nextDay.classI } : null,
    newerOfficialPublished: Boolean(official && official.publishedDate > lastDate),
  };
}

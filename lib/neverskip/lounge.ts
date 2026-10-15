/**
 * NeverSkip "Lounge" (Circulars) and cursor pagination for the connect/* feeds.
 *
 * Lounge is the media view of the same messages shown in Daily Notice: each Lounge
 * group carries the real files (PDF/XLSX/JPEG) with `msg_id`, which equals the Daily
 * Notice `test_tar.msid`. Lounge files are joined onto notices by that id, so a
 * circular is never stored twice.
 *
 * Both feeds page with a cursor: request `page` = previous response `D.prmontyr`
 * ("" for the newest page). Sending numeric pages returns page 0 again.
 */
import type { SourceAttachment } from './attachments';
import { isPortalIconUrl } from './attachments';
import type { NeverSkipRawNotice } from './types';

export const LOUNGE_PATH = '/parentweb/connect/fetchloungeinfo';

export const MAX_CURSOR_PAGES = 60;

function envelopeData(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const d = (body as Record<string, unknown>).D;
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
}

/** Cursor for the next (older) page; '' when the feed has no more pages. */
export function nextPortalCursor(body: unknown): string {
  const d = envelopeData(body);
  const v = d?.prmontyr;
  return typeof v === 'string' ? v.trim() : '';
}

export function envelopeItemList(body: unknown): unknown[] {
  const list = envelopeData(body)?.item_list;
  return Array.isArray(list) ? list : [];
}

/** Daily Notice message id from `test_tar` (object, JSON, or Python-dict string). */
export function noticeMessageId(raw: Pick<NeverSkipRawNotice, 'test_tar'>): string {
  const t = raw.test_tar;
  if (t && typeof t === 'object') {
    const v = (t as Record<string, unknown>).msid;
    return v == null ? '' : String(v).trim();
  }
  if (typeof t === 'string') {
    const m = t.match(/['"]msid['"]\s*:\s*['"]?(\d+)/);
    return m ? m[1] : '';
  }
  return '';
}

function fileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

/** msg_id → real files from one or more Lounge responses. Thumbnails and icons are skipped. */
export function parseLoungeAttachments(bodies: unknown[]): Map<string, SourceAttachment[]> {
  const out = new Map<string, SourceAttachment[]>();
  for (const body of bodies) {
    for (const group of envelopeItemList(body)) {
      if (!group || typeof group !== 'object') continue;
      const files = (group as Record<string, unknown>).item_list;
      if (!Array.isArray(files)) continue;
      for (const f of files) {
        if (!f || typeof f !== 'object') continue;
        const o = f as Record<string, unknown>;
        const msgId = o.msg_id == null ? '' : String(o.msg_id).trim();
        const url = String(o.download_url || o.src || '').trim();
        if (!msgId || !/^https?:\/\//i.test(url) || isPortalIconUrl(url)) continue;
        const list = out.get(msgId) ?? [];
        if (!list.some((a) => a.url === url)) {
          const name = fileName(url);
          list.push(name ? { url, name } : { url });
        }
        out.set(msgId, list);
      }
    }
  }
  return out;
}

/** Attach Lounge files to notices with the same message id. Returns how many notices matched. */
export function joinLoungeFilesToNotices(
  notices: NeverSkipRawNotice[],
  loungeFiles: Map<string, SourceAttachment[]>,
): { matched: number; unmatchedMessageIds: string[] } {
  const used = new Set<string>();
  let matched = 0;
  for (const notice of notices) {
    const id = noticeMessageId(notice);
    const files = id ? loungeFiles.get(id) : undefined;
    if (!files?.length) continue;
    notice.lounge_files = files;
    used.add(id);
    matched += 1;
  }
  return { matched, unmatchedMessageIds: [...loungeFiles.keys()].filter((id) => !used.has(id)) };
}

export interface CursorPagesResult<T> {
  items: T[];
  pagesFetched: number;
  complete: boolean;
  errors: string[];
  rawFetched: number;
  uniqueFetched: number;
}

/**
 * Walk a connect/* feed from its first page by `D.prmontyr` cursor until the cursor is
 * empty or a page has no items. Keeps whatever was fetched when a later page fails.
 */
export async function fetchCursorPages<T>(options: {
  firstPage: unknown;
  fetchPage: (cursor: string) => Promise<unknown>;
  extract: (body: unknown) => T[];
  keyOf: (item: T) => string;
  maxPages?: number;
}): Promise<CursorPagesResult<T>> {
  const maxPages = options.maxPages ?? MAX_CURSOR_PAGES;
  const byKey = new Map<string, T>();
  const errors: string[] = [];
  const seenCursors = new Set<string>();
  const firstCursor = nextPortalCursor(options.firstPage);
  let body: unknown = options.firstPage;
  let pagesFetched = 0;
  let rawFetched = 0;
  let complete = false;

  while (pagesFetched < maxPages) {
    const items = options.extract(body);
    pagesFetched += 1;
    rawFetched += items.length;
    for (const item of items) {
      const key = options.keyOf(item);
      if (!byKey.has(key)) byKey.set(key, item);
    }
    const cursor = nextPortalCursor(body);
    if (!cursor || items.length === 0) {
      complete = true;
      break;
    }
    if (seenCursors.has(cursor)) {
      // After the oldest page the portal wraps back to the newest page's cursor.
      if (cursor === firstCursor) complete = true;
      else errors.push(`cursor repeated (${cursor}) — stopping`);
      break;
    }
    seenCursors.add(cursor);
    try {
      body = await options.fetchPage(cursor);
    } catch (err) {
      errors.push(`page ${pagesFetched}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
    if (body == null) {
      errors.push(`page ${pagesFetched}: empty response`);
      break;
    }
  }
  if (!complete && errors.length === 0) errors.push(`stopped at ${maxPages} pages`);

  return {
    items: [...byKey.values()],
    pagesFetched,
    complete,
    errors,
    rawFetched,
    uniqueFetched: byKey.size,
  };
}

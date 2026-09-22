/**
 * NeverSkip Joy of Learning / Content Library — discovery notes (observed 2026-09-19).
 *
 * Q1 page: https://parent.neverskip.com/default/content-library
 * Q2 API: POST https://nskapi.neverskip.com/parentweb/lms/fetchcontentlib
 * Q3 payload: { values:'', page:'0', pg_key:'CD', works:'', limit:0 } (same shape as homework)
 * Q4 envelope: { S, D: { page_count, stu_id, item_list }, F }
 * Q5–8 resources: item.media[] with media_type, media_url, dwn_url, thump_url (PDFs observed as media_type "P")
 * Q9 dates: sch_dt (YYYY-MM-DD), sch_fdt (e.g. 18-Sep-2026), sch_tm, tmstmp
 * Q10 activity link: title/subject often include "Joy of learning" / JOL; no separate activity id
 * Q11 printouts: not a separate type — PDFs in media[] (use media_type + filename)
 * Q12 pagination: page_count (observed 12), ~10 items/page, zero-based page
 *
 * No dedicated /jol endpoint found. Content Library is the source for JOL printouts/resources.
 */

import { isScheduleDocumentText } from './calendar';
import type { NeverSkipClient } from './client';
import { nsError, nsLog, nsWarn } from './log';
import { normalizeDate, normalizeTime } from './normalizers';
import type {
  NeverSkipContentLibraryResponse,
  NeverSkipRawContentItem,
  NormalizedJolItem,
} from './types';
import { NEVERSKIP_SOURCE } from './types';

export const JOL_CONTENT_LIBRARY_PATH = '/parentweb/lms/fetchcontentlib';
export const JOL_CONTENT_LIBRARY_PAGE = 'https://parent.neverskip.com/default/content-library';
export const JOL_API_MATCH = '/parentweb/lms/fetchcontentlib';

export const JOL_KEYWORD_RE = /joy\s*of\s*learning|\bJOL\b|jol\s*[-–]?\s*(i{1,3}|ws|worksheet)/i;

export type ContentLibPayload = {
  values: string;
  page: string;
  pg_key: string;
  works: string;
  limit: number;
};

export function buildContentLibPayload(page: number | string, limit = 0): ContentLibPayload {
  return {
    values: '',
    page: String(page),
    pg_key: 'CD',
    works: '',
    limit,
  };
}

export function isContentLibraryApiUrl(url: string): boolean {
  return url.includes(JOL_API_MATCH);
}

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function extractContentLibraryItems(
  response: NeverSkipContentLibraryResponse | null | undefined,
): NeverSkipRawContentItem[] {
  if (!response || typeof response !== 'object') return [];
  const r = response as Record<string, unknown>;
  if (r.S === false) return [];
  const D = r.D;
  if (D && typeof D === 'object' && !Array.isArray(D)) {
    const list = coerceItemList((D as Record<string, unknown>).item_list);
    if (list) return list.filter(isObject) as NeverSkipRawContentItem[];
  }
  const root = coerceItemList(r.item_list);
  if (root) return root.filter(isObject) as NeverSkipRawContentItem[];
  return [];
}

export function extractContentLibPageCount(
  response: NeverSkipContentLibraryResponse | null | undefined,
): number | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const D =
    r.D && typeof r.D === 'object' && !Array.isArray(r.D)
      ? (r.D as Record<string, unknown>)
      : null;
  const raw = D?.page_count ?? r.page_count;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

export type ContentMedia = {
  mediaType: string;
  mediaUrl: string | null;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
};

export function parseContentMedia(raw: unknown): ContentMedia[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  const out: ContentMedia[] = [];
  for (const m of list) {
    if (!isObject(m)) continue;
    const mediaUrl = String(m.media_url ?? m.url ?? '').trim() || null;
    const downloadUrl = String(m.dwn_url ?? m.download_url ?? mediaUrl ?? '').trim() || null;
    const thumbnailUrl = String(m.thump_url ?? m.thumb_url ?? m.thumbnail ?? '').trim() || null;
    const mediaType = String(m.media_type ?? m.type ?? '').trim() || 'document';
    if (!mediaUrl && !downloadUrl) continue;
    out.push({ mediaType, mediaUrl, downloadUrl, thumbnailUrl });
  }
  return out;
}

export function isJolRelatedText(...parts: Array<string | null | undefined>): boolean {
  return JOL_KEYWORD_RE.test(parts.filter(Boolean).join(' '));
}

function deriveResourceType(
  title: string,
  media: ContentMedia[],
): string {
  const blob = title.toLowerCase();
  if (/timetable|time\s*table/i.test(blob)) return 'timetable';
  if (/newsletter/i.test(blob)) return 'newsletter';
  if (/print\s*out|printout/i.test(blob)) return 'printout';
  if (/worksheet/i.test(blob)) return 'worksheet';
  const primary = media[0];
  if (primary) {
    const t = primary.mediaType.toUpperCase();
    if (t === 'P' || /\.pdf(\?|$)/i.test(primary.downloadUrl || primary.mediaUrl || '')) {
      return /print|worksheet|practice\s*paper|revision\s*paper/i.test(blob) ? 'printout' : 'pdf';
    }
    if (t === 'I' || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(primary.mediaUrl || '')) return 'image';
  }
  if (media.length === 0) return 'link';
  return 'document';
}

export function normalizeContentLibraryItem(
  raw: NeverSkipRawContentItem,
): NormalizedJolItem | null {
  const sourceId = String(raw.refid ?? raw.con_id ?? '').trim();
  if (!sourceId) return null;

  const title = String(raw.con_tit ?? raw.title ?? '').trim() || 'Content library item';
  const description = String(raw.con_desc ?? raw.full_desc ?? '').trim();
  const content = String(raw.full_desc ?? raw.con_desc ?? '').trim() || description;
  const publishedDate =
    normalizeDate(typeof raw.sch_dt === 'string' ? raw.sch_dt : null) ||
    normalizeDate(typeof raw.sch_fdt === 'string' ? raw.sch_fdt : null) ||
    '';
  const publishedTime = normalizeTime(typeof raw.sch_tm === 'string' ? raw.sch_tm : null);
  const media = parseContentMedia(raw.media);
  const primary = media[0];
  const jolRelated = isJolRelatedText(title, description, content, String(raw.subject_name ?? ''));
  const scheduleDocument = isScheduleDocumentText(
    title,
    description,
    content,
    String(raw.subject_name ?? ''),
  );
  const resourceType = scheduleDocument && /timetable|time\s*table/i.test(title)
    ? 'timetable'
    : deriveResourceType(title, media);
  const sections = String(raw.cls_sec ?? '')
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    source: NEVERSKIP_SOURCE,
    sourceId,
    title,
    description,
    content,
    activityDate: publishedDate,
    publishedDate,
    publishedTime,
    resourceType,
    resourceUrl: primary?.mediaUrl ?? null,
    downloadUrl: primary?.downloadUrl ?? primary?.mediaUrl ?? null,
    thumbnailUrl: primary?.thumbnailUrl ?? null,
    subjectName: String(raw.subject_name ?? '').trim() || null,
    sections,
    jolRelated,
    scheduleDocument,
    metadataJson: JSON.stringify({
      sub_id: raw.sub_id ?? null,
      is_sch: raw.is_sch ?? null,
      media,
      mediaCount: media.length,
    }),
  };
}

export interface JolFetchResult {
  items: NeverSkipRawContentItem[];
  pagesFetched: number;
  incomplete: boolean;
  errors: string[];
  sourceTotal: number | null;
  rawFetched: number;
  uniqueFetched: number;
}

const MAX_CONTENT_PAGES = 100;

function contentDedupeKey(item: NeverSkipRawContentItem): string | null {
  const id = String(item.refid ?? item.con_id ?? '').trim();
  return id ? `id:${id}` : null;
}

function mergeContentPages(pages: NeverSkipRawContentItem[][]): NeverSkipRawContentItem[] {
  const out: NeverSkipRawContentItem[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page) {
      const key = contentDedupeKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(item);
    }
  }
  return out;
}

export async function fetchAllContentLibraryPages(
  fetchPage: (page: number, payload: ContentLibPayload) => Promise<NeverSkipContentLibraryResponse | null>,
  options: { firstPage?: NeverSkipContentLibraryResponse | null } = {},
): Promise<JolFetchResult> {
  const pages: NeverSkipRawContentItem[][] = [];
  const errors: string[] = [];
  let incomplete = false;
  let pageIndex = 0;
  let pageCount: number | null = null;
  let rawFetched = 0;

  while (pageIndex < MAX_CONTENT_PAGES) {
    const payload = buildContentLibPayload(pageIndex);
    let response: NeverSkipContentLibraryResponse | null;
    try {
      response =
        pageIndex === 0 && options.firstPage
          ? options.firstPage
          : await fetchPage(pageIndex, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'content library page failed';
      errors.push(`page ${pageIndex}: ${msg}`);
      nsWarn(`Content library page ${pageIndex} failed: ${msg}`);
      incomplete = true;
      break;
    }

    if (response == null) {
      if (pageIndex === 0) {
        nsError('JOL SYNC = FAILED — empty content library response');
        return {
          items: [],
          pagesFetched: 0,
          incomplete: true,
          errors: ['JOL SYNC = FAILED — page 0 empty'],
          sourceTotal: null,
          rawFetched: 0,
          uniqueFetched: 0,
        };
      }
      incomplete = true;
      errors.push(`page ${pageIndex}: empty response`);
      break;
    }

    if ((response as { S?: unknown }).S === false) {
      const msg = 'JOL SYNC = AUTHENTICATION_REQUIRED — failure envelope';
      nsError(msg);
      return {
        items: mergeContentPages(pages),
        pagesFetched: pages.length,
        incomplete: true,
        errors: [...errors, msg],
        sourceTotal: pageCount,
        rawFetched,
        uniqueFetched: mergeContentPages(pages).length,
      };
    }

    const items = extractContentLibraryItems(response);
    const pc = extractContentLibPageCount(response);
    if (pc != null) pageCount = pc;
    nsLog(`JOL/contentlib page ${pageIndex + 1}: ${items.length}` + (pc != null ? ` page_count=${pc}` : ''));

    if (items.length === 0) {
      if (pageIndex === 0) pages.push(items);
      break;
    }

    pages.push(items);
    rawFetched += items.length;

    if (pageCount != null && pageIndex + 1 >= pageCount) break;
    if (pageCount == null && items.length < 5) break;
    pageIndex += 1;
  }

  const items = mergeContentPages(pages);
  const uniqueFetched = items.length;
  if (pageCount != null && pageCount > 0 && pages.length < pageCount) {
    incomplete = true;
    errors.push(`fetched ${pages.length} pages < page_count ${pageCount}`);
    nsError(`SYNC FAILED — INCOMPLETE JOL/CONTENT LIBRARY DATA`);
  }

  nsLog(`JOL/contentlib pages=${pages.length} raw=${rawFetched} unique=${uniqueFetched}`);
  return {
    items,
    pagesFetched: pages.length,
    incomplete,
    errors,
    sourceTotal: pageCount != null ? null : uniqueFetched,
    rawFetched,
    uniqueFetched,
  };
}

export async function fetchContentLibraryDetailed(client: NeverSkipClient): Promise<JolFetchResult> {
  return fetchAllContentLibraryPages(async (_page, payload) => {
    return client.postJson<NeverSkipContentLibraryResponse>(JOL_CONTENT_LIBRARY_PATH, payload);
  });
}

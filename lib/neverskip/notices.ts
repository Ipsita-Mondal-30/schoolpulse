import type { NeverSkipClient } from './client';
import { nsLog, nsWarn } from './log';
import { extractNotices } from './normalizers';
import type { NeverSkipNoticesResponse, NeverSkipRawNotice } from './types';

export interface NoticePaginationMeta {
  pageCount: number | null;
  totalCount: number | null;
  sfileLimit: number | null;
  itemListLength: number;
}

export const NOTICES_PATH = '/parentweb/connect/fetchdailynoticeinfo';

/** Default first-page payload — portal historically POSTs `{}`; keep empty-compatible shape. */
export const NOTICES_PAYLOAD = {
  values: '',
  page: '0',
  pg_key: 'CD',
  works: '',
  limit: 0,
} as const;

export type NoticesPayload = {
  values: string;
  page: string;
  pg_key: string;
  works: string;
  limit: number;
};

export interface NoticeFetchResult {
  items: NeverSkipRawNotice[];
  pagesFetched: number;
  incomplete: boolean;
  errors: string[];
}

function noticeDedupeKey(item: NeverSkipRawNotice): string | null {
  if (item.id != null && String(item.id).trim() !== '') return `id:${String(item.id)}`;
  if (item.notice_id != null && String(item.notice_id).trim() !== '') {
    return `nid:${String(item.notice_id)}`;
  }
  const title = String(item.title ?? '').trim();
  const content = String(item.cont ?? item.content ?? '').trim();
  if (!title && !content) return null;
  return `body:${title}|${content.slice(0, 200)}`;
}

function mergeNoticePages(pages: NeverSkipRawNotice[][]): NeverSkipRawNotice[] {
  const out: NeverSkipRawNotice[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page) {
      const key = noticeDedupeKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(item);
    }
  }
  return out;
}

function toFiniteInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

export function extractNoticePagination(
  response: NeverSkipNoticesResponse | null | undefined,
): NoticePaginationMeta {
  const items = extractNotices(response);
  const root =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, unknown>)
      : null;
  const D =
    root?.D && typeof root.D === 'object' && !Array.isArray(root.D)
      ? (root.D as Record<string, unknown>)
      : null;
  return {
    pageCount: toFiniteInt(D?.page_count ?? root?.page_count),
    totalCount: toFiniteInt(D?.total_count ?? root?.total_count),
    sfileLimit: toFiniteInt(D?.sfile_limit ?? root?.sfile_limit),
    itemListLength: items.length,
  };
}

function shouldFetchNextNoticePage(
  meta: NoticePaginationMeta,
  pageIndex: number,
  collectedCount: number,
): boolean {
  if (meta.itemListLength <= 0) return false;
  if (meta.totalCount != null && meta.totalCount > 0) {
    return collectedCount < meta.totalCount;
  }
  if (meta.pageCount != null && meta.pageCount > 0) {
    return pageIndex + 1 < meta.pageCount;
  }
  // Notices historically return a single unpaginated list — do not invent extra pages.
  return false;
}

export function buildNoticesPayload(page: number | string, limit = 0): NoticesPayload {
  return {
    values: '',
    page: String(page),
    pg_key: 'CD',
    works: '',
    limit,
  };
}

const MAX_NOTICE_PAGES = 50;

/**
 * Fetch notices. If the envelope has no pagination metadata, returns the first page only
 * (historical NeverSkip behaviour). When page_count/total_count exist, paginates like homework.
 */
export async function fetchAllNoticePages(
  fetchPage: (page: number, payload: NoticesPayload) => Promise<NeverSkipNoticesResponse | null>,
  options: { limit?: number; firstPage?: NeverSkipNoticesResponse | null } = {},
): Promise<NoticeFetchResult> {
  const limit = options.limit ?? 0;
  const pages: NeverSkipRawNotice[][] = [];
  const errors: string[] = [];
  let incomplete = false;
  let pageIndex = 0;
  let latestMeta: NoticePaginationMeta | null = null;

  while (pageIndex < MAX_NOTICE_PAGES) {
    const payload = buildNoticesPayload(pageIndex, limit);
    let response: NeverSkipNoticesResponse | null;
    try {
      response =
        pageIndex === 0 && options.firstPage
          ? options.firstPage
          : await fetchPage(pageIndex, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'notice page fetch failed';
      errors.push(`page ${pageIndex}: ${msg}`);
      nsWarn(`Notice page ${pageIndex} failed: ${msg}`);
      incomplete = true;
      break;
    }

    if (response == null) {
      if (pageIndex === 0) {
        return { items: [], pagesFetched: 0, incomplete: true, errors: ['page 0: empty response'] };
      }
      incomplete = true;
      errors.push(`page ${pageIndex}: empty response`);
      break;
    }

    const items = extractNotices(response);
    const noticeMeta = extractNoticePagination(response);
    latestMeta = noticeMeta;

    nsLog(
      `Notice page progress: page=${pageIndex} received=${items.length}` +
        (noticeMeta.totalCount != null ? ` totalCount=${noticeMeta.totalCount}` : '') +
        (noticeMeta.pageCount != null ? ` pageCount=${noticeMeta.pageCount}` : ''),
    );

    if (items.length === 0) {
      if (pageIndex === 0) pages.push(items);
      break;
    }

    pages.push(items);
    const collected = mergeNoticePages(pages).length;

    if (pageIndex > 0) {
      const previous = mergeNoticePages(pages.slice(0, -1)).length;
      if (collected === previous) {
        incomplete = true;
        errors.push(`page ${pageIndex}: duplicate notice page`);
        break;
      }
    }

    if (!shouldFetchNextNoticePage(noticeMeta, pageIndex, collected)) {
      break;
    }
    pageIndex += 1;
  }

  const items = mergeNoticePages(pages);
  if (
    latestMeta?.totalCount != null &&
    latestMeta.totalCount > 0 &&
    items.length < latestMeta.totalCount
  ) {
    incomplete = true;
    errors.push(
      `fetched ${items.length} unique notices < total_count ${latestMeta.totalCount}`,
    );
  }

  nsLog(`Notice pages fetched: ${pages.length}`);
  nsLog(`Notice records fetched: ${items.length}`);

  return { items, pagesFetched: pages.length, incomplete, errors };
}

export async function fetchDailyNotices(client: NeverSkipClient): Promise<NeverSkipRawNotice[]> {
  const result = await fetchAllNoticePages(async (_page, payload) => {
    // First page historically used `{}`; keep both shapes compatible by sending payload.
    return client.postJson<NeverSkipNoticesResponse>(
      NOTICES_PATH,
      _page === 0 ? {} : payload,
    );
  });
  return result.items;
}

export async function fetchDailyNoticesDetailed(
  client: NeverSkipClient,
): Promise<NoticeFetchResult> {
  return fetchAllNoticePages(async (_page, payload) => {
    return client.postJson<NeverSkipNoticesResponse>(
      NOTICES_PATH,
      _page === 0 ? {} : payload,
    );
  });
}

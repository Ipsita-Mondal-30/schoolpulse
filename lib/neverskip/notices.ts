/**
 * NeverSkip daily notices fetch.
 *
 * Pagination behavior (do not fabricate missing history):
 * - Prefer replaying the intercepted SPA POST body (portal template), only changing `page`.
 * - When the envelope exposes `total_count` and/or `page_count`, walk pages (cap 50).
 *   If unique fetched < total_count → incomplete / PARTIAL (admin diagnostics only).
 * - When totals are absent and page 0 looks full, probe later pages; if probes fail
 *   (SQLSTATE / non-JSON), keep page-0 rows and set `page0Only` — never invent notices.
 * - Always upsert whatever unique rows were actually returned; never invent dates/content.
 */
import type { NeverSkipClient } from './client';
import { nsError, nsLog, nsWarn } from './log';
import { extractNotices, inspectNoticeEnvelope } from './normalizers';
import type { NeverSkipNoticesResponse, NeverSkipRawNotice } from './types';

export interface NoticePaginationMeta {
  pageCount: number | null;
  totalCount: number | null;
  sfileLimit: number | null;
  itemListLength: number;
}

export const NOTICES_PATH = '/parentweb/connect/fetchdailynoticeinfo';

/** Default first-page payload — portal often POSTs `{}`; keep empty-compatible shape. */
export const NOTICES_PAYLOAD = {
  values: '',
  page: '0',
  pg_key: 'CD',
  works: '',
  limit: 0,
} as const;

export type NoticesPayload = {
  values?: string;
  page: string;
  pg_key?: string;
  works?: string;
  /** Some portal builds use `limit`. */
  limit?: number;
  /** Mirror homework: some builds may use portal typo `limt`. */
  limt?: number;
  /** Extra portal fields captured from the live SPA (never invent these). */
  [key: string]: string | number | boolean | null | undefined;
};

export interface NoticeFetchResult {
  items: NeverSkipRawNotice[];
  pagesFetched: number;
  incomplete: boolean;
  /** True when only page 0 was ingested because further pages returned SQLSTATE/non-JSON. */
  page0Only: boolean;
  errors: string[];
  sourceTotal: number | null;
  rawFetched: number;
  uniqueFetched: number;
}

/**
 * Parse a portal-intercepted fetchdailynoticeinfo POST body into a reusable template.
 * Empty `{}` is valid (historical SPA). Returns null only for non-objects.
 */
export function parseNoticesPortalBody(raw: unknown): NoticesPayload | null {
  if (raw == null) return { page: '0' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: NoticesPayload = {
    page: obj.page != null ? String(obj.page) : '0',
  };

  if ('values' in obj) out.values = obj.values != null ? String(obj.values) : '';
  if ('pg_key' in obj) out.pg_key = obj.pg_key != null ? String(obj.pg_key) : '';
  if ('works' in obj) out.works = obj.works != null ? String(obj.works) : '';

  if ('limt' in obj) {
    const limtRaw = obj.limt;
    if (typeof limtRaw === 'number' && Number.isFinite(limtRaw)) out.limt = Math.trunc(limtRaw);
    else if (typeof limtRaw === 'string' && limtRaw.trim() !== '') {
      const n = Number(limtRaw);
      if (Number.isFinite(n)) out.limt = Math.trunc(n);
    } else if (limtRaw == null) {
      out.limt = 0;
    }
  }
  if ('limit' in obj) {
    const limitRaw = obj.limit;
    if (typeof limitRaw === 'number' && Number.isFinite(limitRaw)) out.limit = Math.trunc(limitRaw);
    else if (typeof limitRaw === 'string' && limitRaw.trim() !== '') {
      const n = Number(limitRaw);
      if (Number.isFinite(n)) out.limit = Math.trunc(n);
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k in out) continue;
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v as string | number | boolean | null;
    }
  }
  return out;
}

/**
 * Clone intercepted portal body and only change `page` (and AG-style limt when present).
 * Does not invent new filter fields.
 */
export function buildNoticesPayloadFromTemplate(
  template: NoticesPayload | null | undefined,
  page: number | string,
  limitOverride?: number,
): NoticesPayload {
  if (!template || Object.keys(template).length === 0) {
    return buildNoticesPayload(page, limitOverride ?? 0);
  }
  const pageNum = typeof page === 'number' ? page : Number(page) || 0;
  const next: NoticesPayload = { ...template, page: String(page) };

  if (String(template.pg_key) === 'AG' && 'limt' in template) {
    next.limt = pageNum * 10;
  }

  if (limitOverride != null && Number.isFinite(limitOverride) && !('limt' in template)) {
    const tmplLimit =
      typeof template.limit === 'number' ? template.limit : Number(template.limit) || 0;
    if (tmplLimit === 0 && limitOverride > 0) {
      next.limit = limitOverride;
    }
  }
  return next;
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

/**
 * Continue while totals say more remain, or the current page looks full enough
 * that a hidden next page is possible. An empty follow-up page stops cleanly.
 */
export function shouldFetchNextNoticePage(
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
  // No pagination meta: probe the next page when this one looks full.
  if (meta.sfileLimit != null && meta.sfileLimit > 0 && meta.itemListLength >= meta.sfileLimit) {
    return true;
  }
  if (meta.itemListLength >= 10) return true;
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
 * Fetch notices. Prefer portal template replay. When page_count/total_count exist, paginate.
 */
export async function fetchAllNoticePages(
  fetchPage: (page: number, payload: NoticesPayload) => Promise<NeverSkipNoticesResponse | null>,
  options: {
    limit?: number;
    firstPage?: NeverSkipNoticesResponse | null;
    portalTemplate?: NoticesPayload | null;
  } = {},
): Promise<NoticeFetchResult> {
  const limit = options.limit ?? 0;
  const portalTemplate = options.portalTemplate ?? null;
  const pages: NeverSkipRawNotice[][] = [];
  const errors: string[] = [];
  let incomplete = false;
  let page0Only = false;
  let pageIndex = 0;
  let latestMeta: NoticePaginationMeta | null = null;

  if (portalTemplate) {
    nsLog(
      `Notices using portal request template keys=${Object.keys(portalTemplate).join(',') || '(empty)'} page=${portalTemplate.page} limt=${portalTemplate.limt ?? ''} limit=${portalTemplate.limit ?? ''} pg_key=${portalTemplate.pg_key ?? ''}`,
    );
  }

  while (pageIndex < MAX_NOTICE_PAGES) {
    const payload = buildNoticesPayloadFromTemplate(portalTemplate, pageIndex, limit);
    let response: NeverSkipNoticesResponse | null;
    try {
      response =
        pageIndex === 0 && options.firstPage
          ? options.firstPage
          : await fetchPage(pageIndex, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'notice page fetch failed';
      // Probe without portal totals: NeverSkip often returns SQLSTATE / non-JSON for page>0.
      // Ingest page 0 (latest notices) and mark PAGE0_ONLY — do not claim full history complete.
      if (
        pageIndex > 0 &&
        latestMeta &&
        latestMeta.totalCount == null &&
        latestMeta.pageCount == null
      ) {
        page0Only = true;
        nsWarn(
          `Notice page ${pageIndex} probe failed without totals (${msg}) — PAGE0_ONLY; preserving Neon history + ingesting page 0`,
        );
        break;
      }
      errors.push(`page ${pageIndex}: ${msg}`);
      nsWarn(`Notice page ${pageIndex} failed: ${msg}`);
      incomplete = true;
      break;
    }

    if (response == null) {
      if (pageIndex === 0) {
        nsError('NOTICE SYNC = FAILED');
        nsError('NOTICE FETCH = FAILED — empty response');
        return {
          items: [],
          pagesFetched: 0,
          incomplete: true,
          page0Only: false,
          errors: ['NOTICE SYNC = FAILED — page 0: empty response'],
          sourceTotal: null,
          rawFetched: 0,
          uniqueFetched: 0,
        };
      }
      if (latestMeta && latestMeta.totalCount == null && latestMeta.pageCount == null) {
        page0Only = true;
        nsWarn(`Notice page ${pageIndex} empty after unpaginated first page — PAGE0_ONLY`);
        break;
      }
      incomplete = true;
      errors.push(`page ${pageIndex}: empty response`);
      break;
    }

    const inspected = inspectNoticeEnvelope(response);
    if (inspected.status === 'failure_envelope') {
      const msg = 'NOTICE SYNC = AUTHENTICATION_REQUIRED — failure envelope (S:false)';
      nsError(msg);
      errors.push(msg);
      incomplete = true;
      if (pageIndex === 0) {
        return {
          items: [],
          pagesFetched: 0,
          incomplete: true,
          page0Only: false,
          errors,
          sourceTotal: null,
          rawFetched: 0,
          uniqueFetched: 0,
        };
      }
      break;
    }
    if (inspected.status === 'invalid_response') {
      const msg = 'NOTICE SYNC = INVALID_RESPONSE — unexpected notice API structure';
      nsError(msg);
      incomplete = true;
      if (pageIndex === 0) {
        errors.push(msg);
        return {
          items: [],
          pagesFetched: 0,
          incomplete: true,
          page0Only: false,
          errors,
          sourceTotal: null,
          rawFetched: 0,
          uniqueFetched: 0,
        };
      }
      if (latestMeta && latestMeta.totalCount == null && latestMeta.pageCount == null) {
        nsLog(
          `Notice page ${pageIndex} invalid without totals — treating earlier pages as complete`,
        );
        incomplete = false;
        page0Only = true;
        break;
      }
      errors.push(msg);
      break;
    }

    const items = inspected.items;
    const noticeMeta = extractNoticePagination(response);
    latestMeta = noticeMeta;

    nsLog(`NOTICES page ${pageIndex + 1}: ${items.length}`);
    nsLog(
      `Notice page progress: page=${pageIndex} received=${items.length}` +
        (noticeMeta.totalCount != null ? ` totalCount=${noticeMeta.totalCount}` : '') +
        (noticeMeta.pageCount != null ? ` pageCount=${noticeMeta.pageCount}` : ''),
    );
    if (items.length > 0) {
      const firstDate = String(items[0].date ?? '(none)');
      const lastDate = String(items[items.length - 1].date ?? '(none)');
      nsLog(`Notice page ${pageIndex} dateRange: first=${firstDate} last=${lastDate}`);
    }

    if (items.length === 0) {
      if (pageIndex === 0) {
        pages.push(items);
      } else if (
        latestMeta.totalCount != null &&
        latestMeta.totalCount > 0 &&
        mergeNoticePages(pages).length < latestMeta.totalCount
      ) {
        incomplete = true;
        errors.push(`page ${pageIndex}: empty item_list while total_count=${latestMeta.totalCount}`);
      } else {
        nsLog(`Notice page ${pageIndex} empty — stopping`);
      }
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

  if (pageIndex >= MAX_NOTICE_PAGES - 1 && latestMeta) {
    const collected = mergeNoticePages(pages).length;
    if (shouldFetchNextNoticePage(latestMeta, pageIndex, collected)) {
      incomplete = true;
      errors.push(`stopped at max pages (${MAX_NOTICE_PAGES})`);
      nsWarn(`Notice pagination stopped at max pages (${MAX_NOTICE_PAGES})`);
    }
  }

  const items = mergeNoticePages(pages);
  const rawFetched = pages.reduce((n, p) => n + p.length, 0);
  const uniqueFetched = items.length;
  const sourceTotal = latestMeta?.totalCount ?? null;

  if (sourceTotal != null && sourceTotal > 0 && uniqueFetched < sourceTotal) {
    incomplete = true;
    const missing = sourceTotal - uniqueFetched;
    errors.push(
      `fetched ${uniqueFetched} unique notices < total_count ${sourceTotal} (missing≈${missing})`,
    );
    nsWarn(
      `NOTICE PARTIAL — unique=${uniqueFetched} < total_count=${sourceTotal} missing≈${missing}; preserving collected notices`,
    );
  }

  nsLog(`NOTICES fetched (raw): ${rawFetched}`);
  nsLog(`NOTICES unique: ${uniqueFetched}`);
  if (sourceTotal != null) nsLog(`NOTICES total source: ${sourceTotal}`);
  nsLog(`Notice pages fetched: ${pages.length}`);
  nsLog(`Notice records fetched: ${uniqueFetched}`);
  if (page0Only) {
    nsWarn('NOTICE STATUS: PAGE0_ONLY — additional history not available from portal');
  } else if (!incomplete && pages.length > 0) {
    nsLog(`NOTICE FETCH = SUCCESS`);
    nsLog(`NOTICES FETCHED = ${uniqueFetched}`);
  }
  if (incomplete) {
    nsWarn('SYNC STATUS: PARTIAL — notice pagination did not fetch all source records');
    nsWarn('Notice pagination incomplete — preserving records collected so far');
  }

  return {
    items,
    pagesFetched: pages.length,
    incomplete,
    page0Only,
    errors,
    sourceTotal,
    rawFetched,
    uniqueFetched,
  };
}

export async function fetchDailyNotices(client: NeverSkipClient): Promise<NeverSkipRawNotice[]> {
  const result = await fetchAllNoticePages(async (_page, payload) => {
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

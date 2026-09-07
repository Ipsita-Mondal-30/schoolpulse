import type { NeverSkipClient } from './client';
import { nsLog, nsWarn } from './log';
import { extractAssignments } from './normalizers';
import type { NeverSkipHomeworkResponse, NeverSkipRawAssignment } from './types';

export const HOMEWORK_PATH = '/parentweb/lms/getassignmentsapi';

/** Default first-page payload observed from NeverSkip parent portal. */
export const HOMEWORK_PAYLOAD = {
  values: '',
  page: '0',
  pg_key: 'CD',
  works: '',
  limit: 0,
} as const;

export type HomeworkPayload = {
  values: string;
  page: string;
  pg_key: string;
  works: string;
  limit: number;
};

export interface HomeworkPaginationMeta {
  pageCount: number | null;
  totalCount: number | null;
  sfileLimit: number | null;
  itemListLength: number;
}

export interface HomeworkFetchResult {
  items: NeverSkipRawAssignment[];
  pagesFetched: number;
  incomplete: boolean;
  errors: string[];
}

function toFiniteInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function homeworkD(response: NeverSkipHomeworkResponse | null | undefined): Record<string, unknown> | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null;
  const D = (response as Record<string, unknown>).D;
  if (D && typeof D === 'object' && !Array.isArray(D)) return D as Record<string, unknown>;
  return null;
}

/** Read NeverSkip homework pagination fields from a response envelope (safe numbers only). */
export function extractHomeworkPagination(
  response: NeverSkipHomeworkResponse | null | undefined,
): HomeworkPaginationMeta {
  const items = extractAssignments(response);
  const D = homeworkD(response);
  const root =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, unknown>)
      : null;

  return {
    pageCount: toFiniteInt(D?.page_count ?? root?.page_count),
    totalCount: toFiniteInt(D?.total_count ?? root?.total_count),
    sfileLimit: toFiniteInt(D?.sfile_limit ?? root?.sfile_limit),
    itemListLength: items.length,
  };
}

export function logHomeworkPagination(page: number | string, meta: HomeworkPaginationMeta): void {
  nsLog('Homework pagination:');
  nsLog(`page=${page}`);
  nsLog(`itemListLength=${meta.itemListLength}`);
  nsLog(`pageCount=${meta.pageCount ?? 'null'}`);
  nsLog(`totalCount=${meta.totalCount ?? 'null'}`);
  nsLog(`limit=${meta.sfileLimit ?? 'null'}`);
}

/** Build the portal-shaped POST body for a zero-based page index. */
export function buildHomeworkPayload(page: number | string, limit = 0): HomeworkPayload {
  return {
    values: '',
    page: String(page),
    pg_key: 'CD',
    works: '',
    limit,
  };
}

function assignmentDedupeKey(item: NeverSkipRawAssignment): string | null {
  if (item.assign_id != null && String(item.assign_id).trim() !== '') {
    return `id:${String(item.assign_id)}`;
  }
  if (item.refid != null && String(item.refid).trim() !== '') {
    return `ref:${String(item.refid)}`;
  }
  return null;
}

/** Merge page item lists; drop duplicates seen on later pages. */
export function mergeHomeworkPageItems(
  pages: NeverSkipRawAssignment[][],
): NeverSkipRawAssignment[] {
  const out: NeverSkipRawAssignment[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const item of page) {
      const key = assignmentDedupeKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(item);
    }
  }
  return out;
}

/**
 * Decide whether another page should be requested after successfully reading `pageIndex` (0-based).
 * Uses NeverSkip metadata when present; otherwise continues while the last page looks full.
 */
export function shouldFetchNextHomeworkPage(
  meta: HomeworkPaginationMeta,
  pageIndex: number,
  collectedCount: number,
): boolean {
  if (meta.itemListLength <= 0) return false;

  if (meta.pageCount != null && meta.pageCount > 0) {
    return pageIndex + 1 < meta.pageCount;
  }

  if (meta.totalCount != null && meta.totalCount > 0) {
    if (collectedCount >= meta.totalCount) return false;
    const pageSize =
      meta.sfileLimit != null && meta.sfileLimit > 0
        ? meta.sfileLimit
        : meta.itemListLength > 0
          ? meta.itemListLength
          : null;
    if (pageSize != null && meta.itemListLength < pageSize) return false;
    return true;
  }

  // No usable totals: stop when a short page arrives; keep going while page looks "full".
  const pageSize = meta.sfileLimit != null && meta.sfileLimit > 0 ? meta.sfileLimit : null;
  if (pageSize != null) return meta.itemListLength >= pageSize;
  // Fallback when limit metadata missing: treat a non-empty page as potentially having more
  // only if length looks like a round default page size (observed live: 10).
  return meta.itemListLength >= 10;
}

const MAX_HOMEWORK_PAGES = 100;

/**
 * Fetch all homework pages via a page callback (token client or browser session).
 * Preserves earlier pages if a later page fails.
 */
export async function fetchAllHomeworkPages(
  fetchPage: (page: number, payload: HomeworkPayload) => Promise<NeverSkipHomeworkResponse | null>,
  options: { limit?: number } = {},
): Promise<HomeworkFetchResult> {
  const limit = options.limit ?? 0;
  const pages: NeverSkipRawAssignment[][] = [];
  const errors: string[] = [];
  let incomplete = false;
  let pageIndex = 0;
  let latestMeta: HomeworkPaginationMeta | null = null;

  while (pageIndex < MAX_HOMEWORK_PAGES) {
    const payload = buildHomeworkPayload(pageIndex, limit);
    let response: NeverSkipHomeworkResponse | null;
    try {
      response = await fetchPage(pageIndex, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'homework page fetch failed';
      errors.push(`page ${pageIndex}: ${msg}`);
      nsWarn(`Homework page ${pageIndex} failed: ${msg}`);
      incomplete = true;
      break;
    }

    if (response == null) {
      errors.push(`page ${pageIndex}: empty or failed response`);
      nsWarn(`Homework page ${pageIndex} returned no body`);
      incomplete = true;
      break;
    }

    const meta = extractHomeworkPagination(response);
    latestMeta = meta;
    logHomeworkPagination(pageIndex, meta);

    const items = extractAssignments(response);
    if (items.length === 0) {
      if (pageIndex === 0) {
        pages.push(items);
      } else {
        incomplete = true;
        errors.push(`page ${pageIndex}: empty item_list while more pages were expected`);
        nsWarn(`Homework page ${pageIndex} returned 0 items — stopping with partial results`);
      }
      break;
    }

    pages.push(items);

    const collected = mergeHomeworkPageItems(pages).length;
    // Stop if a later page added no new unique records (bad/repeated pagination).
    if (pageIndex > 0) {
      const previous = mergeHomeworkPageItems(pages.slice(0, -1)).length;
      if (collected === previous) {
        nsWarn(`Homework page ${pageIndex} added no new records — stopping pagination`);
        break;
      }
    }

    if (!shouldFetchNextHomeworkPage(meta, pageIndex, collected)) {
      break;
    }
    pageIndex += 1;
  }

  if (pageIndex >= MAX_HOMEWORK_PAGES - 1 && latestMeta) {
    const collected = mergeHomeworkPageItems(pages).length;
    if (shouldFetchNextHomeworkPage(latestMeta, pageIndex, collected)) {
      incomplete = true;
      errors.push(`stopped at max pages (${MAX_HOMEWORK_PAGES})`);
      nsWarn(`Homework pagination stopped at max pages (${MAX_HOMEWORK_PAGES})`);
    }
  }

  const items = mergeHomeworkPageItems(pages);
  const pagesFetched = pages.length;

  nsLog(`Homework pages fetched: ${pagesFetched}`);
  nsLog(`Homework records fetched: ${items.length}`);
  if (incomplete) {
    nsWarn('Homework pagination incomplete — preserving records collected so far');
  }

  return { items, pagesFetched, incomplete, errors };
}

/** Token/API client path: paginate getassignmentsapi until all pages are collected. */
export async function fetchHomeworkAssignments(client: NeverSkipClient): Promise<NeverSkipRawAssignment[]> {
  const result = await fetchAllHomeworkPages(async (_page, payload) => {
    return client.postJson<NeverSkipHomeworkResponse>(HOMEWORK_PATH, payload);
  });
  if (result.incomplete) {
    // Caller (syncNeverSkip) should still persist partial results; surface via thrown? No —
    // return items and let sync attach errors. Attach marker on array? Better change return type.
    // For backward compat, stash errors on a symbol — cleaner to return HomeworkFetchResult.
  }
  return result.items;
}

/** Rich fetch used by syncNeverSkip so pagination failures become summary.errors. */
export async function fetchHomeworkAssignmentsDetailed(
  client: NeverSkipClient,
): Promise<HomeworkFetchResult> {
  return fetchAllHomeworkPages(async (_page, payload) => {
    return client.postJson<NeverSkipHomeworkResponse>(HOMEWORK_PATH, payload);
  });
}

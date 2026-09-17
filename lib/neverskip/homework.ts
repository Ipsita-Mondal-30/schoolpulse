import type { NeverSkipClient } from './client';
import { nsError, nsLog, nsWarn } from './log';
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
  /** API total_count when present. */
  sourceTotal: number | null;
  /** Sum of raw item_list lengths across pages (before dedupe). */
  rawFetched: number;
  /** Unique records after cross-page dedupe. */
  uniqueFetched: number;
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

/** Safe date string from a raw assignment (no secrets). */
function rawAssignmentDateHint(item: NeverSkipRawAssignment): string {
  const raw = item.ass_dt ?? item.assign_dt ?? item.due_dt ?? '';
  const s = String(raw).trim();
  return s || '(none)';
}

/** Log first/last dates on a page — metadata only. */
export function logHomeworkPageDateRange(
  pageIndex: number,
  items: NeverSkipRawAssignment[],
): void {
  if (items.length === 0) {
    nsLog(`Homework page ${pageIndex} dateRange: empty`);
    return;
  }
  const first = rawAssignmentDateHint(items[0]);
  const last = rawAssignmentDateHint(items[items.length - 1]);
  nsLog(`Homework page ${pageIndex} dateRange: first=${first} last=${last}`);
}

/** Unique source-id count for progress logs (ids only, never tokens). */
export function countUniqueHomeworkSourceIds(items: NeverSkipRawAssignment[]): number {
  const seen = new Set<string>();
  for (const item of items) {
    const key = assignmentDedupeKey(item);
    if (key) seen.add(key);
  }
  return seen.size;
}

/**
 * Search raw homework for Sep-15 / Hindi sulekh markers (counts only — no full bodies).
 */
export function countHomeworkMarkerHits(items: NeverSkipRawAssignment[]): {
  total: number;
  hits: Record<string, number>;
} {
  const markers = [
    'उ की मात्रा',
    'ए ki matra',
    'matra',
    'sulekh',
    'sulekha',
    'bitiya',
    'bitiya aayi',
    'hungry caterpillar',
    'shapes and patterns',
    'workbook completion',
    '2026-09-17',
    '17-sep-2026',
    '17/09/26',
    '17/09/2026',
    '2026-09-15',
    '15-sep-2026',
    '15/09/26',
    '15/09/2026',
    '15-09-2026',
    '2026-09-11',
    '11-sep-2026',
  ] as const;
  const hits: Record<string, number> = {};
  for (const m of markers) hits[m] = 0;

  for (const item of items) {
    const blob = [
      item.assign_id,
      item.refid,
      item.subject_name,
      item.assign_title,
      item.assign_details,
      item.ass_dt,
      item.assign_dt,
      item.due_dt,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    for (const m of markers) {
      if (blob.includes(m.toLowerCase())) hits[m] += 1;
    }
  }
  return { total: items.length, hits };
}

export function logHomeworkMarkerSearch(items: NeverSkipRawAssignment[]): void {
  const { total, hits } = countHomeworkMarkerHits(items);
  nsLog(`Homework marker search (n=${total}):`);
  for (const [marker, count] of Object.entries(hits)) {
    nsLog(`  marker="${marker}" hits=${count}`);
  }
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
 * Continue while unique collected is still below total_count, or page_count has more pages.
 * Raw page-length sums must NOT stop early when unique is still short (cross-page overlaps).
 * A short last page is NOT a stop signal — only an empty page (or unique >= total) stops.
 */
export function shouldFetchNextHomeworkPage(
  meta: HomeworkPaginationMeta,
  pageIndex: number,
  collectedCount: number,
  _rawFetchedCount = collectedCount,
): boolean {
  if (meta.itemListLength <= 0) return false;

  // Prefer unique reconciliation against total_count.
  if (meta.totalCount != null && meta.totalCount > 0) {
    if (collectedCount >= meta.totalCount) return false;
    // Unique still short — keep going even past declared page_count / raw sums.
    return true;
  }

  if (meta.pageCount != null && meta.pageCount > 0 && pageIndex + 1 < meta.pageCount) {
    return true;
  }

  if (meta.pageCount != null && meta.pageCount > 0) {
    return false;
  }

  // No usable totals: stop when a short page arrives.
  if (meta.sfileLimit != null && meta.sfileLimit > 0 && meta.itemListLength >= meta.sfileLimit) {
    return true;
  }
  if (meta.itemListLength >= 10) return true;
  return false;
}

/**
 * Incomplete when the API's total_count exceeds unique fetched records.
 * Overlaps may make raw >= total while unique is still short — that is still incomplete.
 */
export function homeworkTotalCountMismatch(
  totalCount: number | null | undefined,
  uniqueFetched: number,
): boolean {
  return totalCount != null && totalCount > 0 && uniqueFetched < totalCount;
}

const MAX_HOMEWORK_PAGES = 100;
/** Extra chase pages allowed when a page adds no new uniques but total_count is unmet. */
const MAX_EMPTY_UNIQUE_CHASE = 5;

/**
 * Fetch all homework pages via a page callback (token client or browser session).
 * Preserves earlier pages if a later page fails.
 */
export async function fetchAllHomeworkPages(
  fetchPage: (page: number, payload: HomeworkPayload) => Promise<NeverSkipHomeworkResponse | null>,
  options: { limit?: number } = {},
): Promise<HomeworkFetchResult> {
  let limit = options.limit ?? 0;
  const pages: NeverSkipRawAssignment[][] = [];
  const errors: string[] = [];
  let incomplete = false;
  let pageIndex = 0;
  let latestMeta: HomeworkPaginationMeta | null = null;
  let rawFetchedCount = 0;
  let emptyUniqueStreak = 0;

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
    // Prefer portal page size for subsequent requests when caller left limit=0.
    if (limit === 0 && meta.sfileLimit != null && meta.sfileLimit > 0) {
      limit = meta.sfileLimit;
    }
    logHomeworkPagination(pageIndex, meta);
    nsLog(`HOMEWORK page ${pageIndex + 1}: ${meta.itemListLength}`);

    const items = extractAssignments(response);
    logHomeworkPageDateRange(pageIndex, items);
    if (items.length === 0) {
      if (pageIndex === 0) {
        pages.push(items);
      } else if (
        latestMeta.totalCount != null &&
        latestMeta.totalCount > 0 &&
        mergeHomeworkPageItems(pages).length < latestMeta.totalCount &&
        emptyUniqueStreak < MAX_EMPTY_UNIQUE_CHASE
      ) {
        emptyUniqueStreak += 1;
        nsWarn(
          `Homework page ${pageIndex} empty while unique < total_count — chase ${emptyUniqueStreak}/${MAX_EMPTY_UNIQUE_CHASE}`,
        );
        pageIndex += 1;
        continue;
      } else if (
        latestMeta.pageCount != null &&
        latestMeta.pageCount > 0 &&
        pageIndex >= latestMeta.pageCount
      ) {
        nsWarn(`Homework page ${pageIndex} empty after page_count exhausted — stopping`);
      } else {
        incomplete = true;
        errors.push(`page ${pageIndex}: empty item_list while more pages were expected`);
        nsWarn(`Homework page ${pageIndex} returned 0 items — stopping with partial results`);
      }
      break;
    }

    pages.push(items);
    rawFetchedCount += items.length;

    const collected = mergeHomeworkPageItems(pages).length;
    const uniqueIds = countUniqueHomeworkSourceIds(mergeHomeworkPageItems(pages));
    nsLog(
      `Homework page progress: page=${pageIndex} received=${items.length} cumulativeUnique=${collected} uniqueSourceIds=${uniqueIds} cumulativeRaw=${rawFetchedCount}` +
        (meta.totalCount != null ? ` totalCount=${meta.totalCount}` : ''),
    );

    // Later page with no new uniques: chase while total_count unmet, else stop incomplete.
    if (pageIndex > 0) {
      const previous = mergeHomeworkPageItems(pages.slice(0, -1)).length;
      if (collected === previous) {
        if (
          meta.totalCount != null &&
          meta.totalCount > 0 &&
          collected < meta.totalCount &&
          emptyUniqueStreak < MAX_EMPTY_UNIQUE_CHASE
        ) {
          emptyUniqueStreak += 1;
          nsWarn(
            `Homework page ${pageIndex} added no new uniques (${collected}/${meta.totalCount}) — chase ${emptyUniqueStreak}/${MAX_EMPTY_UNIQUE_CHASE}`,
          );
          pageIndex += 1;
          continue;
        }
        incomplete = true;
        errors.push(
          `page ${pageIndex}: duplicate/empty unique page (cumulative=${collected}` +
            (meta.totalCount != null ? `, total_count=${meta.totalCount}` : '') +
            ')',
        );
        nsWarn(
          `Homework page ${pageIndex} added no new records — stopping pagination (incomplete)`,
        );
        break;
      }
      emptyUniqueStreak = 0;
    }

    if (!shouldFetchNextHomeworkPage(meta, pageIndex, collected, rawFetchedCount)) {
      break;
    }
    pageIndex += 1;
  }

  if (pageIndex >= MAX_HOMEWORK_PAGES - 1 && latestMeta) {
    const collected = mergeHomeworkPageItems(pages).length;
    if (shouldFetchNextHomeworkPage(latestMeta, pageIndex, collected, rawFetchedCount)) {
      incomplete = true;
      errors.push(`stopped at max pages (${MAX_HOMEWORK_PAGES})`);
      nsWarn(`Homework pagination stopped at max pages (${MAX_HOMEWORK_PAGES})`);
    }
  }

  const items = mergeHomeworkPageItems(pages);
  const pagesFetched = pages.length;
  const uniqueFetched = items.length;
  const sourceTotal = latestMeta?.totalCount ?? null;

  if (homeworkTotalCountMismatch(sourceTotal, uniqueFetched)) {
    incomplete = true;
    const msg = `unique homework ${uniqueFetched} < total_count ${sourceTotal} (raw=${rawFetchedCount})`;
    errors.push(msg);
    nsError(`SYNC FAILED — INCOMPLETE HOMEWORK DATA (${msg})`);
  }

  nsLog(`HOMEWORK total source: ${sourceTotal ?? '(none)'}`);
  nsLog(`HOMEWORK total fetched (raw): ${rawFetchedCount}`);
  nsLog(`HOMEWORK unique: ${uniqueFetched}`);
  nsLog(`Homework pages fetched: ${pagesFetched}`);
  nsLog(`Homework records fetched: ${uniqueFetched}`);
  nsLog(`Homework raw records fetched: ${rawFetchedCount}`);
  nsLog(`Homework unique source IDs: ${countUniqueHomeworkSourceIds(items)}`);
  if (sourceTotal != null) {
    nsLog(`Homework total_count (source): ${sourceTotal}`);
  }
  logHomeworkMarkerSearch(items);
  if (incomplete) {
    nsError('SYNC STATUS: INCOMPLETE — homework pagination did not fetch all source records');
    nsWarn('Homework pagination incomplete — preserving records collected so far');
  } else if (sourceTotal != null) {
    nsLog(
      `Homework pagination complete: raw=${rawFetchedCount} unique=${uniqueFetched} total_count=${sourceTotal}`,
    );
  }

  return {
    items,
    pagesFetched,
    incomplete,
    errors,
    sourceTotal,
    rawFetched: rawFetchedCount,
    uniqueFetched,
  };
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

import { classifyAssignment } from './classify';
import type { NeverSkipClient } from './client';
import { fetchHomeworkAssignmentsDetailed } from './homework';
import { nsError, nsLog } from './log';
import { normalizeHomework, normalizeNotice } from './normalizers';
import { fetchDailyNoticesDetailed } from './notices';
import type { NeverSkipStore } from './store';
import type {
  CollectedNeverSkipData,
  NeverSkipRawAssignment,
  NeverSkipRawNotice,
  SyncSummary,
} from './types';

export interface SyncOptions {
  client: NeverSkipClient;
  store: NeverSkipStore;
}

export interface SyncDataOptions {
  homework: NeverSkipRawAssignment[];
  notices: NeverSkipRawNotice[];
  store: NeverSkipStore;
  /** Log prefix label, e.g. "browser sync" */
  label?: string;
  homeworkPagesFetched?: number;
  homeworkFetchIncomplete?: boolean;
  homeworkFetchErrors?: string[];
  homeworkSourceTotal?: number | null;
  homeworkRawFetched?: number;
  homeworkUniqueFetched?: number;
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
  noticeFetchErrors?: string[];
  noticeSourceTotal?: number | null;
  noticeRawFetched?: number;
  noticeUniqueFetched?: number;
}

function newestIsoDate(dates: Array<string | null | undefined>): string {
  const valid = dates.filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (valid.length === 0) return '';
  return valid.sort().reverse()[0];
}

function emptySummary(): SyncSummary {
  return {
    homeworkFetched: 0,
    homeworkInserted: 0,
    homeworkUpdated: 0,
    homeworkSkipped: 0,
    homeworkSkippedType: 0,
    noticesFetched: 0,
    noticesInserted: 0,
    noticesUpdated: 0,
    noticesSkipped: 0,
    errors: [],
  };
}

/** Persist already-collected raw NeverSkip payloads (browser or token client). */
export async function syncNeverSkipData({
  homework,
  notices,
  store,
  label = 'sync',
  homeworkPagesFetched,
  homeworkFetchIncomplete,
  homeworkFetchErrors = [],
  homeworkSourceTotal,
  homeworkRawFetched,
  homeworkUniqueFetched,
  noticePagesFetched,
  noticeFetchIncomplete,
  noticeFetchErrors = [],
  noticeSourceTotal,
  noticeRawFetched,
  noticeUniqueFetched,
}: SyncDataOptions): Promise<SyncSummary> {
  const summary = emptySummary();
  summary.errors.push(...homeworkFetchErrors, ...noticeFetchErrors);
  if (homeworkPagesFetched != null) summary.homeworkPagesFetched = homeworkPagesFetched;
  if (homeworkFetchIncomplete) summary.homeworkFetchIncomplete = true;
  if (homeworkSourceTotal !== undefined) summary.homeworkSourceTotal = homeworkSourceTotal;
  if (homeworkRawFetched != null) summary.homeworkRawFetched = homeworkRawFetched;
  if (homeworkUniqueFetched != null) summary.homeworkUniqueFetched = homeworkUniqueFetched;
  if (noticePagesFetched != null) summary.noticePagesFetched = noticePagesFetched;
  if (noticeFetchIncomplete) summary.noticeFetchIncomplete = true;
  if (noticeSourceTotal !== undefined) summary.noticeSourceTotal = noticeSourceTotal;
  if (noticeRawFetched != null) summary.noticeRawFetched = noticeRawFetched;
  if (noticeUniqueFetched != null) summary.noticeUniqueFetched = noticeUniqueFetched;

  nsLog('SYNC START');
  nsLog(`NeverSkip ${label} started`);
  nsLog('source connection successful');

  if (homeworkPagesFetched != null) {
    nsLog(`Homework pages fetched: ${homeworkPagesFetched}`);
  }
  summary.homeworkFetched = homework.length;
  nsLog(`Homework records fetched: ${homework.length}`);
  // Keep legacy line for existing operators/tests that grep this string
  nsLog(`Homework fetched: ${homework.length}`);

  for (const raw of homework) {
    try {
      if (classifyAssignment(raw) !== 'homework') {
        summary.homeworkSkippedType += 1;
        summary.homeworkSkipped += 1;
        continue;
      }
      const normalized = normalizeHomework(raw);
      if (!normalized) {
        summary.homeworkSkipped += 1;
        continue;
      }
      const result = await store.upsertHomework(normalized);
      if (result === 'inserted') summary.homeworkInserted += 1;
      else if (result === 'updated') summary.homeworkUpdated += 1;
      else summary.homeworkSkipped += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'homework row failed';
      summary.errors.push(msg);
      nsError(`Homework row error: ${msg}`);
    }
  }

  nsLog(`New homework: ${summary.homeworkInserted}`);
  nsLog(`Updated homework: ${summary.homeworkUpdated}`);
  nsLog(`Duplicate homework skipped: ${summary.homeworkSkipped}`);
  nsLog(`Homework type skipped: ${summary.homeworkSkippedType}`);

  if (noticePagesFetched != null) {
    nsLog(`Notice pages fetched: ${noticePagesFetched}`);
  }
  summary.noticesFetched = notices.length;
  nsLog(`Notice records fetched: ${notices.length}`);
  nsLog(`Notices fetched: ${notices.length}`);

  for (const raw of notices) {
    try {
      const normalized = normalizeNotice(raw);
      if (!normalized) {
        summary.noticesSkipped += 1;
        continue;
      }
      const result = await store.upsertNotice(normalized);
      if (result === 'inserted') summary.noticesInserted += 1;
      else if (result === 'updated') summary.noticesUpdated += 1;
      else summary.noticesSkipped += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'notice row failed';
      summary.errors.push(msg);
      nsError(`Notice row error: ${msg}`);
    }
  }

  nsLog(`New notices: ${summary.noticesInserted}`);
  nsLog(`Updated notices: ${summary.noticesUpdated}`);
  nsLog(`Duplicate notices skipped: ${summary.noticesSkipped}`);

  const storedHomework = await store.listHomework();
  const storedNotices = await store.listNotices();
  summary.homeworkStored = storedHomework.length;
  summary.noticesStored = storedNotices.length;

  const homeworkNormalizedIds: string[] = [];
  const homeworkNormalizedDates: string[] = [];
  let classifiedHomework = 0;
  for (const raw of homework) {
    if (classifyAssignment(raw) !== 'homework') continue;
    classifiedHomework += 1;
    const normalized = normalizeHomework(raw);
    if (normalized) {
      homeworkNormalizedIds.push(normalized.sourceId);
      homeworkNormalizedDates.push(normalized.homeworkDate);
    }
  }
  summary.homeworkNormalized = homeworkNormalizedIds.length;

  const noticeNormalizedIds: string[] = [];
  const noticeNormalizedDates: string[] = [];
  for (const raw of notices) {
    const normalized = normalizeNotice(raw);
    if (normalized) {
      noticeNormalizedIds.push(normalized.sourceId);
      noticeNormalizedDates.push(normalized.publishedDate);
    }
  }
  summary.noticesNormalized = noticeNormalizedIds.length;

  const storedHwIds = new Set(storedHomework.map((h) => h.sourceId));
  const storedNtIds = new Set(storedNotices.map((n) => n.sourceId));
  summary.homeworkMissing = homeworkNormalizedIds.filter((id) => !storedHwIds.has(id)).length;
  summary.noticesMissing = noticeNormalizedIds.filter((id) => !storedNtIds.has(id)).length;

  const sourceNewestHomework = newestIsoDate(homeworkNormalizedDates);
  const storedNewestHomework = newestIsoDate(storedHomework.map((h) => h.homeworkDate));
  const sourceNewestNotice = newestIsoDate(noticeNormalizedDates);
  const storedNewestNotice = newestIsoDate(storedNotices.map((n) => n.publishedDate));
  summary.newestHomeworkDate = storedNewestHomework || sourceNewestHomework;
  summary.newestNoticeDate = storedNewestNotice || sourceNewestNotice;

  nsLog('SYNC VALIDATION');
  nsLog(`Homework source count: ${summary.homeworkFetched}`);
  nsLog(`Homework normalized count: ${summary.homeworkNormalized}`);
  nsLog(`Homework stored count: ${summary.homeworkStored}`);
  nsLog(`Homework missing count: ${summary.homeworkMissing}`);
  nsLog(`Newest homework date (source): ${sourceNewestHomework || '(none)'}`);
  nsLog(`Newest homework date (stored): ${storedNewestHomework || '(none)'}`);
  nsLog(`Notice source count: ${summary.noticesFetched}`);
  nsLog(`Notice normalized count: ${summary.noticesNormalized}`);
  nsLog(`Notice stored count: ${summary.noticesStored}`);
  nsLog(`Notice missing count: ${summary.noticesMissing}`);
  nsLog(`Newest notice date (source): ${sourceNewestNotice || '(none)'}`);
  nsLog(`Newest notice date (stored): ${storedNewestNotice || '(none)'}`);

  const incomplete = Boolean(homeworkFetchIncomplete || noticeFetchIncomplete);
  const countsMismatch =
    (summary.homeworkMissing ?? 0) > 0 || (summary.noticesMissing ?? 0) > 0;
  const normalizationLoss =
    classifiedHomework > (summary.homeworkNormalized ?? 0) ||
    (notices.length > 0 && (summary.noticesNormalized ?? 0) < notices.length);
  const dataLoss =
    (sourceNewestHomework && storedNewestHomework && sourceNewestHomework > storedNewestHomework) ||
    (sourceNewestNotice && storedNewestNotice && sourceNewestNotice > storedNewestNotice);

  // Both streams empty with fetch errors = failed sync, not a quiet success.
  const bothEmptyWithErrors =
    homework.length === 0 &&
    notices.length === 0 &&
    (homeworkFetchErrors.length > 0 || noticeFetchErrors.length > 0 || summary.errors.length > 0);

  if (incomplete || countsMismatch || normalizationLoss || dataLoss || bothEmptyWithErrors) {
    nsError('SYNC FAILED — INCOMPLETE SOURCE DATA');
    nsError('SYNC STATUS: INCOMPLETE');
    if (bothEmptyWithErrors) {
      nsError('SYNC FAILED — empty homework and notices after fetch errors');
      summary.errors.push('empty homework and notices after fetch errors');
    }
    if (homeworkFetchIncomplete) {
      nsError('Homework pagination incomplete — sync preserved partial homework results');
      summary.errors.push('homework pagination incomplete');
    }
    if (noticeFetchIncomplete) {
      nsError('Notice pagination incomplete — sync preserved partial notice results');
      summary.errors.push('notice pagination incomplete');
    }
    if (countsMismatch) {
      const msg = `stored counts do not match normalized (homework missing=${summary.homeworkMissing}, notices missing=${summary.noticesMissing})`;
      nsError('SYNC FAILED — DATA LOSS');
      nsError(msg);
      summary.errors.push(msg);
    }
    if (normalizationLoss) {
      const msg = `normalized homework ${summary.homeworkNormalized}/${classifiedHomework}, notices ${summary.noticesNormalized}/${notices.length}`;
      nsError('SYNC FAILED — NORMALIZATION LOSS');
      nsError(msg);
      summary.errors.push(msg);
    }
    if (dataLoss) {
      nsError('SYNC FAILED — DATA LOSS');
      summary.errors.push(
        `newest source dates missing from store (homework ${sourceNewestHomework || 'n/a'} vs ${storedNewestHomework || 'n/a'}, notices ${sourceNewestNotice || 'n/a'} vs ${storedNewestNotice || 'n/a'})`,
      );
    }
  } else {
    nsLog('SYNC COMPLETE');
    nsLog('SYNC STATUS: COMPLETE');
  }

  nsLog('FULL SYNC REPORT');
  nsLog(
    `HOMEWORK source total=${summary.homeworkSourceTotal ?? '(none)'} fetched(raw)=${summary.homeworkRawFetched ?? summary.homeworkFetched} unique=${summary.homeworkUniqueFetched ?? summary.homeworkFetched} inserted=${summary.homeworkInserted} updated=${summary.homeworkUpdated} duplicates=${summary.homeworkSkipped}`,
  );
  nsLog(
    `NOTICES source total=${summary.noticeSourceTotal ?? '(none)'} fetched(raw)=${summary.noticeRawFetched ?? summary.noticesFetched} unique=${summary.noticeUniqueFetched ?? summary.noticesFetched} inserted=${summary.noticesInserted} updated=${summary.noticesUpdated} duplicates=${summary.noticesSkipped}`,
  );
  nsLog(
    `DATABASE homework total=${summary.homeworkStored ?? '?'} notice total=${summary.noticesStored ?? '?'}`,
  );
  nsLog(`LATEST HOMEWORK date=${summary.newestHomeworkDate || '(none)'}`);
  nsLog(`LATEST NOTICE date=${summary.newestNoticeDate || '(none)'}`);

  return summary;
}

/** Token/API client path — fetches then delegates to syncNeverSkipData. */
export async function syncNeverSkip({ client, store }: SyncOptions): Promise<SyncSummary> {
  const fetchErrors: string[] = [];
  let homework: NeverSkipRawAssignment[] = [];
  let notices: NeverSkipRawNotice[] = [];
  let homeworkPagesFetched: number | undefined;
  let homeworkFetchIncomplete = false;
  let homeworkFetchErrors: string[] = [];
  let homeworkSourceTotal: number | null | undefined;
  let homeworkRawFetched: number | undefined;
  let homeworkUniqueFetched: number | undefined;
  let noticePagesFetched: number | undefined;
  let noticeFetchIncomplete = false;
  let noticeFetchErrors: string[] = [];
  let noticeSourceTotal: number | null | undefined;
  let noticeRawFetched: number | undefined;
  let noticeUniqueFetched: number | undefined;

  try {
    const hw = await fetchHomeworkAssignmentsDetailed(client);
    homework = hw.items;
    homeworkPagesFetched = hw.pagesFetched;
    homeworkFetchIncomplete = hw.incomplete;
    homeworkFetchErrors = hw.errors;
    homeworkSourceTotal = hw.sourceTotal;
    homeworkRawFetched = hw.rawFetched;
    homeworkUniqueFetched = hw.uniqueFetched;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'homework fetch failed';
    fetchErrors.push(msg);
    nsError(`Homework fetch failed: ${msg}`);
  }

  try {
    const nt = await fetchDailyNoticesDetailed(client);
    notices = nt.items;
    noticePagesFetched = nt.pagesFetched;
    noticeFetchIncomplete = nt.incomplete;
    noticeFetchErrors = nt.errors;
    noticeSourceTotal = nt.sourceTotal;
    noticeRawFetched = nt.rawFetched;
    noticeUniqueFetched = nt.uniqueFetched;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'notices fetch failed';
    fetchErrors.push(msg);
    nsError(`Notices fetch failed: ${msg}`);
  }

  const dataSummary = await syncNeverSkipData({
    homework,
    notices,
    store,
    label: 'sync',
    homeworkPagesFetched,
    homeworkFetchIncomplete,
    homeworkFetchErrors,
    homeworkSourceTotal,
    homeworkRawFetched,
    homeworkUniqueFetched,
    noticePagesFetched,
    noticeFetchIncomplete,
    noticeFetchErrors,
    noticeSourceTotal,
    noticeRawFetched,
    noticeUniqueFetched,
  });

  return {
    ...dataSummary,
    errors: [...fetchErrors, ...dataSummary.errors],
  };
}

export function collectedToSyncInput(
  data: CollectedNeverSkipData,
): Pick<
  SyncDataOptions,
  | 'homework'
  | 'notices'
  | 'homeworkPagesFetched'
  | 'homeworkFetchIncomplete'
  | 'homeworkFetchErrors'
  | 'homeworkSourceTotal'
  | 'homeworkRawFetched'
  | 'homeworkUniqueFetched'
  | 'noticePagesFetched'
  | 'noticeFetchIncomplete'
  | 'noticeFetchErrors'
  | 'noticeSourceTotal'
  | 'noticeRawFetched'
  | 'noticeUniqueFetched'
> {
  return {
    homework: data.homework,
    notices: data.notices,
    homeworkPagesFetched: data.homeworkPagesFetched,
    homeworkFetchIncomplete: data.homeworkFetchIncomplete,
    homeworkFetchErrors: data.homeworkFetchErrors,
    homeworkSourceTotal: data.homeworkSourceTotal,
    homeworkRawFetched: data.homeworkRawFetched,
    homeworkUniqueFetched: data.homeworkUniqueFetched,
    noticePagesFetched: data.noticePagesFetched,
    noticeFetchIncomplete: data.noticeFetchIncomplete,
    noticeFetchErrors: data.noticeFetchErrors,
    noticeSourceTotal: data.noticeSourceTotal,
    noticeRawFetched: data.noticeRawFetched,
    noticeUniqueFetched: data.noticeUniqueFetched,
  };
}

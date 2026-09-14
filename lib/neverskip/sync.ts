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
  noticePagesFetched?: number;
  noticeFetchIncomplete?: boolean;
  noticeFetchErrors?: string[];
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
  noticePagesFetched,
  noticeFetchIncomplete,
  noticeFetchErrors = [],
}: SyncDataOptions): Promise<SyncSummary> {
  const summary = emptySummary();
  summary.errors.push(...homeworkFetchErrors, ...noticeFetchErrors);
  if (homeworkPagesFetched != null) summary.homeworkPagesFetched = homeworkPagesFetched;
  if (homeworkFetchIncomplete) summary.homeworkFetchIncomplete = true;
  if (noticePagesFetched != null) summary.noticePagesFetched = noticePagesFetched;
  if (noticeFetchIncomplete) summary.noticeFetchIncomplete = true;

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

  if (incomplete || countsMismatch || normalizationLoss || dataLoss) {
    nsError('SYNC FAILED — INCOMPLETE SOURCE DATA');
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
  }
  nsLog(
    incomplete || countsMismatch || normalizationLoss || dataLoss
      ? 'Sync completed with source pagination errors'
      : 'Sync completed',
  );
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
  let noticePagesFetched: number | undefined;
  let noticeFetchIncomplete = false;
  let noticeFetchErrors: string[] = [];

  try {
    const hw = await fetchHomeworkAssignmentsDetailed(client);
    homework = hw.items;
    homeworkPagesFetched = hw.pagesFetched;
    homeworkFetchIncomplete = hw.incomplete;
    homeworkFetchErrors = hw.errors;
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
    noticePagesFetched,
    noticeFetchIncomplete,
    noticeFetchErrors,
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
  | 'noticePagesFetched'
  | 'noticeFetchIncomplete'
  | 'noticeFetchErrors'
> {
  return {
    homework: data.homework,
    notices: data.notices,
    homeworkPagesFetched: data.homeworkPagesFetched,
    homeworkFetchIncomplete: data.homeworkFetchIncomplete,
    homeworkFetchErrors: data.homeworkFetchErrors,
    noticePagesFetched: data.noticePagesFetched,
    noticeFetchIncomplete: data.noticeFetchIncomplete,
    noticeFetchErrors: data.noticeFetchErrors,
  };
}

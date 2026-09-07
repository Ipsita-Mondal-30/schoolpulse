import { classifyAssignment } from './classify';
import type { NeverSkipClient } from './client';
import { fetchHomeworkAssignmentsDetailed } from './homework';
import { nsError, nsLog } from './log';
import { normalizeHomework, normalizeNotice } from './normalizers';
import { fetchDailyNotices } from './notices';
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
}: SyncDataOptions): Promise<SyncSummary> {
  const summary = emptySummary();
  summary.errors.push(...homeworkFetchErrors);
  if (homeworkPagesFetched != null) summary.homeworkPagesFetched = homeworkPagesFetched;
  if (homeworkFetchIncomplete) summary.homeworkFetchIncomplete = true;

  nsLog(`NeverSkip ${label} started`);

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

  summary.noticesFetched = notices.length;
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
  nsLog(`Duplicate notices skipped: ${summary.noticesSkipped}`);
  if (homeworkFetchIncomplete) {
    nsError('Homework pagination incomplete — sync preserved partial homework results');
    summary.errors.push('homework pagination incomplete');
  }
  nsLog(homeworkFetchIncomplete ? 'Sync completed with homework pagination errors' : 'Sync completed');
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
    notices = await fetchDailyNotices(client);
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
> {
  return {
    homework: data.homework,
    notices: data.notices,
    homeworkPagesFetched: data.homeworkPagesFetched,
    homeworkFetchIncomplete: data.homeworkFetchIncomplete,
    homeworkFetchErrors: data.homeworkFetchErrors,
  };
}

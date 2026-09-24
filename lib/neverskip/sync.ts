import { classifyAssignment } from './classify';
import type { NeverSkipClient } from './client';
import { fetchHomeworkAssignmentsDetailed } from './homework';
import { fetchContentLibraryDetailed, normalizeContentLibraryItem } from './jol';
import { nsError, nsLog, nsWarn } from './log';
import { normalizeHomework, normalizeNotice } from './normalizers';
import { fetchDailyNoticesDetailed } from './notices';
import type { NeverSkipStore } from './store';
import type {
  CollectedNeverSkipData,
  NeverSkipRawAssignment,
  NeverSkipRawContentItem,
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
  jolItems?: NeverSkipRawContentItem[];
  scheduleEvents?: import('./types').NormalizedScheduleEvent[];
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
  noticePage0Only?: boolean;
  noticeFetchErrors?: string[];
  noticeSourceTotal?: number | null;
  noticeRawFetched?: number;
  noticeUniqueFetched?: number;
  jolPagesFetched?: number;
  jolFetchIncomplete?: boolean;
  jolFetchErrors?: string[];
  jolSourceTotal?: number | null;
  jolRawFetched?: number;
  jolUniqueFetched?: number;
  scheduleRawCount?: number;
  scheduleFetchIncomplete?: boolean;
  scheduleFetchErrors?: string[];
  scheduleFetchComplete?: boolean;
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
    jolFetched: 0,
    jolInserted: 0,
    jolUpdated: 0,
    jolSkipped: 0,
    errors: [],
  };
}

/** Persist already-collected raw NeverSkip payloads (browser or token client). */
export async function syncNeverSkipData({
  homework,
  notices,
  jolItems = [],
  scheduleEvents = [],
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
  noticePage0Only,
  noticeFetchErrors = [],
  noticeSourceTotal,
  noticeRawFetched,
  noticeUniqueFetched,
  jolPagesFetched,
  jolFetchIncomplete,
  jolFetchErrors = [],
  jolSourceTotal,
  jolRawFetched,
  jolUniqueFetched,
  scheduleRawCount,
  scheduleFetchIncomplete,
  scheduleFetchErrors = [],
  scheduleFetchComplete,
}: SyncDataOptions): Promise<SyncSummary> {
  const startedAt = new Date();
  const summary = emptySummary();
  summary.errors.push(
    ...homeworkFetchErrors,
    ...noticeFetchErrors,
    ...jolFetchErrors,
    ...scheduleFetchErrors,
  );
  if (homeworkPagesFetched != null) summary.homeworkPagesFetched = homeworkPagesFetched;
  if (homeworkFetchIncomplete) summary.homeworkFetchIncomplete = true;
  if (homeworkSourceTotal !== undefined) summary.homeworkSourceTotal = homeworkSourceTotal;
  if (homeworkRawFetched != null) summary.homeworkRawFetched = homeworkRawFetched;
  if (homeworkUniqueFetched != null) summary.homeworkUniqueFetched = homeworkUniqueFetched;
  if (noticePagesFetched != null) summary.noticePagesFetched = noticePagesFetched;
  if (noticeFetchIncomplete) summary.noticeFetchIncomplete = true;
  if (noticePage0Only) summary.noticePage0Only = true;
  if (noticeSourceTotal !== undefined) summary.noticeSourceTotal = noticeSourceTotal;
  if (noticeRawFetched != null) summary.noticeRawFetched = noticeRawFetched;
  if (noticeUniqueFetched != null) summary.noticeUniqueFetched = noticeUniqueFetched;
  if (jolPagesFetched != null) summary.jolPagesFetched = jolPagesFetched;
  if (jolFetchIncomplete) summary.jolFetchIncomplete = true;
  if (jolSourceTotal !== undefined) summary.jolSourceTotal = jolSourceTotal;
  if (jolRawFetched != null) summary.jolRawFetched = jolRawFetched;
  if (jolUniqueFetched != null) summary.jolUniqueFetched = jolUniqueFetched;

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

  if (jolPagesFetched != null) {
    nsLog(`JOL/contentlib pages fetched: ${jolPagesFetched}`);
  }
  summary.jolFetched = jolItems.length;
  nsLog(`JOL/contentlib records fetched: ${jolItems.length}`);

  for (const raw of jolItems) {
    try {
      const normalized = normalizeContentLibraryItem(raw);
      if (!normalized) {
        summary.jolSkipped = (summary.jolSkipped ?? 0) + 1;
        continue;
      }
      const result = await store.upsertJolItem(normalized);
      if (result === 'inserted') summary.jolInserted = (summary.jolInserted ?? 0) + 1;
      else if (result === 'updated') summary.jolUpdated = (summary.jolUpdated ?? 0) + 1;
      else summary.jolSkipped = (summary.jolSkipped ?? 0) + 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'jol row failed';
      summary.errors.push(msg);
      nsError(`JOL row error: ${msg}`);
    }
  }

  nsLog(`New JOL items: ${summary.jolInserted ?? 0}`);
  nsLog(`Updated JOL items: ${summary.jolUpdated ?? 0}`);
  nsLog(`Duplicate JOL skipped: ${summary.jolSkipped ?? 0}`);

  // Calendar / schedule: replace only when fetch completed (including empty D:[]).
  // If this sync invocation did not attempt calendar, leave existing rows untouched.
  const calendarAttempted =
    scheduleFetchComplete === true ||
    scheduleFetchIncomplete === true ||
    scheduleFetchErrors.length > 0 ||
    scheduleRawCount != null;

  summary.scheduleFetchIncomplete = Boolean(scheduleFetchIncomplete);
  summary.scheduleFetchComplete = Boolean(scheduleFetchComplete);
  summary.scheduleFetched = scheduleEvents.length;
  if (scheduleRawCount != null) {
    nsLog(`Calendar raw count: ${scheduleRawCount}`);
  }
  nsLog(
    `Calendar events fetched: ${scheduleEvents.length} complete=${Boolean(scheduleFetchComplete)} attempted=${calendarAttempted}`,
  );

  if (calendarAttempted && scheduleFetchComplete && !scheduleFetchIncomplete) {
    const replaced = await store.replaceScheduleEvents(scheduleEvents);
    summary.scheduleInserted = replaced.inserted;
    summary.scheduleUpdated = replaced.updated;
    nsLog(
      `Calendar replace: inserted=${replaced.inserted} updated=${replaced.updated} removed=${replaced.removed}`,
    );
  } else if (calendarAttempted) {
    summary.schedulePreservedOnFailure = true;
    nsError('CALENDAR SYNC incomplete/failed — preserving last-good schedule events (no overwrite)');
    if (scheduleFetchIncomplete) summary.errors.push('calendar fetch incomplete');
  }

  const storedHomework = await store.listHomework();
  const storedNotices = await store.listNotices();
  const storedJol = await store.listJolItems();
  const storedSchedule = await store.listScheduleEvents();
  summary.homeworkStored = storedHomework.length;
  summary.noticesStored = storedNotices.length;
  summary.jolStored = storedJol.length;
  summary.scheduleStored = storedSchedule.length;

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

  const jolNormalizedIds: string[] = [];
  const jolNormalizedDates: string[] = [];
  for (const raw of jolItems) {
    const normalized = normalizeContentLibraryItem(raw);
    if (normalized) {
      jolNormalizedIds.push(normalized.sourceId);
      jolNormalizedDates.push(normalized.publishedDate);
    }
  }
  summary.jolNormalized = jolNormalizedIds.length;

  const storedHwIds = new Set(storedHomework.map((h) => h.sourceId));
  const storedNtIds = new Set(storedNotices.map((n) => n.sourceId));
  const storedJolIds = new Set(storedJol.map((j) => j.sourceId));
  summary.homeworkMissing = homeworkNormalizedIds.filter((id) => !storedHwIds.has(id)).length;
  summary.noticesMissing = noticeNormalizedIds.filter((id) => !storedNtIds.has(id)).length;

  const sourceNewestHomework = newestIsoDate(homeworkNormalizedDates);
  const storedNewestHomework = newestIsoDate(storedHomework.map((h) => h.homeworkDate));
  const sourceNewestNotice = newestIsoDate(noticeNormalizedDates);
  const storedNewestNotice = newestIsoDate(storedNotices.map((n) => n.publishedDate));
  const sourceNewestJol = newestIsoDate(jolNormalizedDates);
  const storedNewestJol = newestIsoDate(storedJol.map((j) => j.publishedDate));
  summary.newestHomeworkDate = storedNewestHomework || sourceNewestHomework;
  summary.newestNoticeDate = storedNewestNotice || sourceNewestNotice;
  summary.newestJolDate = storedNewestJol || sourceNewestJol;

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
  nsLog(`JOL source count: ${summary.jolFetched}`);
  nsLog(`JOL normalized count: ${summary.jolNormalized}`);
  nsLog(`JOL stored count: ${summary.jolStored}`);
  nsLog(`JOL missing count: ${jolNormalizedIds.filter((id) => !storedJolIds.has(id)).length}`);
  nsLog(`Newest JOL date (source): ${sourceNewestJol || '(none)'}`);
  nsLog(`Newest JOL date (stored): ${storedNewestJol || '(none)'}`);

  summary.newestScheduleDate = newestIsoDate(storedSchedule.map((e) => e.eventDate));
  nsLog(`Calendar stored count: ${summary.scheduleStored}`);
  nsLog(`Newest schedule date (stored): ${summary.newestScheduleDate || '(none)'}`);

  const incomplete = Boolean(
    homeworkFetchIncomplete ||
      noticeFetchIncomplete ||
      jolFetchIncomplete ||
      scheduleFetchIncomplete ||
      noticePage0Only,
  );
  const countsMismatch =
    (summary.homeworkMissing ?? 0) > 0 || (summary.noticesMissing ?? 0) > 0;
  const normalizationLoss =
    classifiedHomework > (summary.homeworkNormalized ?? 0) ||
    (notices.length > 0 && (summary.noticesNormalized ?? 0) < notices.length) ||
    (jolItems.length > 0 && (summary.jolNormalized ?? 0) < jolItems.length);
  const dataLoss =
    (sourceNewestHomework && storedNewestHomework && sourceNewestHomework > storedNewestHomework) ||
    (sourceNewestNotice && storedNewestNotice && sourceNewestNotice > storedNewestNotice);

  // Both streams empty with fetch errors = failed sync, not a quiet success.
  const bothEmptyWithErrors =
    homework.length === 0 &&
    notices.length === 0 &&
    jolItems.length === 0 &&
    (homeworkFetchErrors.length > 0 ||
      noticeFetchErrors.length > 0 ||
      jolFetchErrors.length > 0);

  const hardFailure =
    bothEmptyWithErrors ||
    Boolean(dataLoss) ||
    Boolean(countsMismatch) ||
    Boolean(normalizationLoss);

  const homeworkStatus = homeworkFetchIncomplete
    ? homework.length > 0
      ? 'PARTIAL'
      : 'FAILED'
    : 'COMPLETE';
  const noticeStatus = noticeFetchIncomplete
    ? notices.length > 0
      ? 'PARTIAL'
      : 'FAILED'
    : noticePage0Only
      ? 'PAGE0_ONLY'
      : 'COMPLETE';
  const jolStatus = jolFetchIncomplete
    ? jolItems.length > 0
      ? 'PARTIAL'
      : 'FAILED'
    : 'COMPLETE';
  const calendarStatus = scheduleFetchIncomplete
    ? 'FAILED_PRESERVED'
    : scheduleFetchComplete
      ? 'COMPLETE'
      : 'UNKNOWN';

  summary.sourceStatuses = {
    homework: {
      status: homeworkStatus,
      fetched: summary.homeworkUniqueFetched ?? summary.homeworkFetched,
      stored: summary.homeworkStored,
      newestDate: summary.newestHomeworkDate,
      error: homeworkFetchIncomplete
        ? homeworkFetchErrors.slice(0, 3).join('; ') || 'homework partial'
        : undefined,
    },
    notices: {
      status: noticeStatus,
      fetched: summary.noticeUniqueFetched ?? summary.noticesFetched,
      stored: summary.noticesStored,
      newestDate: summary.newestNoticeDate,
      error: noticeFetchIncomplete || noticePage0Only
        ? noticeFetchErrors.slice(0, 3).join('; ') ||
          (noticePage0Only ? 'page0 only' : 'notice partial')
        : undefined,
    },
    jol: {
      status: jolStatus,
      fetched: summary.jolUniqueFetched ?? summary.jolFetched,
      stored: summary.jolStored,
      newestDate: summary.newestJolDate,
      error: jolFetchIncomplete
        ? jolFetchErrors.slice(0, 3).join('; ') || 'jol partial'
        : undefined,
    },
    calendar: {
      status: calendarStatus,
      fetched: summary.scheduleFetched,
      stored: summary.scheduleStored,
      newestDate: summary.newestScheduleDate,
      error: scheduleFetchIncomplete
        ? scheduleFetchErrors.slice(0, 3).join('; ') || 'calendar incomplete'
        : undefined,
    },
  };

  if (hardFailure) {
    nsError('SYNC FAILED — INCOMPLETE SOURCE DATA');
    nsError('SYNC STATUS: FAILED');
    summary.syncStatus = 'FAILED';
    if (bothEmptyWithErrors) {
      nsError('SYNC FAILED — empty homework and notices after fetch errors');
      summary.errors.push('empty homework and notices after fetch errors');
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
  } else if (incomplete) {
    nsWarn('SYNC STATUS: PARTIAL — one or more sources incomplete; upserts preserved');
    summary.syncStatus = 'PARTIAL';
    if (homeworkFetchIncomplete) {
      nsWarn('Homework pagination partial — unique records preserved; other sources continue');
      summary.errors.push('homework pagination incomplete');
    }
    if (noticeFetchIncomplete) {
      nsWarn('Notice pagination partial — collected notices preserved');
      summary.errors.push('notice pagination incomplete');
    }
    if (noticePage0Only) {
      nsWarn('Notice PAGE0_ONLY — latest notices ingested; older Neon history preserved');
      summary.errors.push('notice page0 only');
    }
    if (jolFetchIncomplete) {
      nsWarn('JOL/content library pagination partial — collected items preserved');
      summary.errors.push('jol pagination incomplete');
    }
    if (scheduleFetchIncomplete) {
      nsWarn('Calendar fetch incomplete — last-good schedule preserved');
      summary.errors.push('calendar fetch incomplete');
    }
  } else {
    nsLog('SYNC COMPLETE');
    nsLog('SYNC STATUS: COMPLETE');
    summary.syncStatus = 'COMPLETE';
  }

  nsLog('FULL SYNC REPORT');
  nsLog(
    `HOMEWORK status=${homeworkStatus} source total=${summary.homeworkSourceTotal ?? '(none)'} fetched(raw)=${summary.homeworkRawFetched ?? summary.homeworkFetched} unique=${summary.homeworkUniqueFetched ?? summary.homeworkFetched} inserted=${summary.homeworkInserted} updated=${summary.homeworkUpdated} duplicates=${summary.homeworkSkipped}`,
  );
  nsLog(
    `NOTICES status=${noticeStatus} source total=${summary.noticeSourceTotal ?? '(none)'} fetched(raw)=${summary.noticeRawFetched ?? summary.noticesFetched} unique=${summary.noticeUniqueFetched ?? summary.noticesFetched} inserted=${summary.noticesInserted} updated=${summary.noticesUpdated} duplicates=${summary.noticesSkipped}`,
  );
  nsLog(
    `JOL status=${jolStatus} source pages=${summary.jolPagesFetched ?? '(none)'} fetched(raw)=${summary.jolRawFetched ?? summary.jolFetched ?? 0} unique=${summary.jolUniqueFetched ?? summary.jolFetched ?? 0} inserted=${summary.jolInserted ?? 0} updated=${summary.jolUpdated ?? 0} duplicates=${summary.jolSkipped ?? 0}`,
  );
  nsLog(
    `CALENDAR status=${calendarStatus} fetched=${summary.scheduleFetched ?? 0} complete=${summary.scheduleFetchComplete ? 'yes' : 'no'} preservedOnFailure=${summary.schedulePreservedOnFailure ? 'yes' : 'no'} stored=${summary.scheduleStored ?? 0}`,
  );
  nsLog(
    `DATABASE homework total=${summary.homeworkStored ?? '?'} notice total=${summary.noticesStored ?? '?'} jol total=${summary.jolStored ?? '?'} schedule total=${summary.scheduleStored ?? '?'}`,
  );
  nsLog(`LATEST HOMEWORK date=${summary.newestHomeworkDate || '(none)'}`);
  nsLog(`LATEST NOTICE date=${summary.newestNoticeDate || '(none)'}`);
  nsLog(`LATEST JOL date=${summary.newestJolDate || '(none)'}`);
  nsLog(`LATEST SCHEDULE date=${summary.newestScheduleDate || '(none)'}`);

  const finishedAt = new Date();
  try {
    await store.recordSyncRun({
      status: summary.syncStatus || 'PARTIAL',
      startedAt,
      finishedAt,
      homeworkExpected: homeworkSourceTotal ?? null,
      homeworkFetched: summary.homeworkUniqueFetched ?? summary.homeworkFetched,
      noticeFetched: summary.noticeUniqueFetched ?? summary.noticesFetched,
      jolFetched: summary.jolUniqueFetched ?? summary.jolFetched,
      scheduleFetched: summary.scheduleFetched,
      errorSummary: summary.errors.slice(0, 20).join('; '),
      reportJson: JSON.stringify({
        syncStatus: summary.syncStatus,
        sources: summary.sourceStatuses,
        homeworkSourceTotal,
        homeworkFetched: summary.homeworkFetched,
        noticeFetched: summary.noticesFetched,
        noticePage0Only: Boolean(noticePage0Only),
        jolFetched: summary.jolFetched,
        scheduleFetched: summary.scheduleFetched,
        jolTimetableStatus: summary.jolTimetableStatus,
        jolTimetableDayCount: summary.jolTimetableDayCount,
      }),
    });
  } catch (err) {
    nsWarn(`Failed to persist SyncRun: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Refresh School/Class/Student + ParentStudent links so parents resolve the
  // synced child after NeverSkip → Neon (no phantom child without import data).
  try {
    if (process.env.DATABASE_URL) {
      const { getPrisma } = await import('@/lib/prisma');
      const { refreshSyncedChildAfterImport } = await import('@/lib/synced-child');
      const identity = await refreshSyncedChildAfterImport(getPrisma());
      if (identity) {
        nsLog(
          `Synced child identity ready: ${identity.displayName} (${identity.classLabel}) id=${identity.neverSkipStudentId}`,
        );
      }
    }
  } catch (err) {
    nsWarn(
      `Synced child identity refresh failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    if (process.env.DATABASE_URL && store.constructor?.name === 'PrismaNeverSkipStore') {
      const { extractAndStoreHomeworkDeadlines } = await import('@/lib/deadlines/run');
      await extractAndStoreHomeworkDeadlines({ maxGeminiCalls: 25 });
    }
  } catch (err) {
    nsWarn(
      `Deadline extraction skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const { invalidateSchoolPulseCaches } = await import('@/lib/cache/schoolpulse');
    const inv = await invalidateSchoolPulseCaches('neverskip-sync');
    nsLog(
      `Cache invalidated after sync: redis=${inv.redisConfigured} deleted=${inv.deleted} version=${inv.version}`,
    );
  } catch (err) {
    nsWarn(
      `Cache invalidation skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

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
  | 'jolItems'
  | 'scheduleEvents'
  | 'homeworkPagesFetched'
  | 'homeworkFetchIncomplete'
  | 'homeworkFetchErrors'
  | 'homeworkSourceTotal'
  | 'homeworkRawFetched'
  | 'homeworkUniqueFetched'
  | 'noticePagesFetched'
  | 'noticeFetchIncomplete'
  | 'noticePage0Only'
  | 'noticeFetchErrors'
  | 'noticeSourceTotal'
  | 'noticeRawFetched'
  | 'noticeUniqueFetched'
  | 'jolPagesFetched'
  | 'jolFetchIncomplete'
  | 'jolFetchErrors'
  | 'jolSourceTotal'
  | 'jolRawFetched'
  | 'jolUniqueFetched'
  | 'scheduleRawCount'
  | 'scheduleFetchIncomplete'
  | 'scheduleFetchErrors'
  | 'scheduleFetchComplete'
> {
  return {
    homework: data.homework,
    notices: data.notices,
    jolItems: data.jolItems ?? [],
    scheduleEvents: data.scheduleEvents ?? [],
    homeworkPagesFetched: data.homeworkPagesFetched,
    homeworkFetchIncomplete: data.homeworkFetchIncomplete,
    homeworkFetchErrors: data.homeworkFetchErrors,
    homeworkSourceTotal: data.homeworkSourceTotal,
    homeworkRawFetched: data.homeworkRawFetched,
    homeworkUniqueFetched: data.homeworkUniqueFetched,
    noticePagesFetched: data.noticePagesFetched,
    noticeFetchIncomplete: data.noticeFetchIncomplete,
    noticePage0Only: data.noticePage0Only,
    noticeFetchErrors: data.noticeFetchErrors,
    noticeSourceTotal: data.noticeSourceTotal,
    noticeRawFetched: data.noticeRawFetched,
    noticeUniqueFetched: data.noticeUniqueFetched,
    jolPagesFetched: data.jolPagesFetched,
    jolFetchIncomplete: data.jolFetchIncomplete,
    jolFetchErrors: data.jolFetchErrors,
    jolSourceTotal: data.jolSourceTotal,
    jolRawFetched: data.jolRawFetched,
    jolUniqueFetched: data.jolUniqueFetched,
    scheduleRawCount: data.scheduleRawCount,
    scheduleFetchIncomplete: data.scheduleFetchIncomplete,
    scheduleFetchErrors: data.scheduleFetchErrors,
    scheduleFetchComplete: data.scheduleFetchComplete,
  };
}

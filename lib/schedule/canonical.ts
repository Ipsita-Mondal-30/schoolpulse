/**
 * Canonical NeverSkip schedule for Joy of Learning + Timetable + Planner.
 * Never falls back to static timetable JSON for live school data.
 */

import type { PrismaClient } from '@prisma/client';

export type CanonicalScheduleEvent = {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  weekday: string;
  subjectName: string | null;
  periodLabel: string | null;
  classSection: string | null;
  resourceUrl: string | null;
};

export type CanonicalScheduleDocument = {
  id: string;
  sourceId: string;
  title: string;
  description: string;
  publishedDate: string;
  resourceType: string;
  downloadUrl: string | null;
  resourceUrl: string | null;
  jolRelated: boolean;
  scheduleDocument: boolean;
};

export type SyncSourceHealth = {
  status: string;
  fetched: number | null;
  stored: number | null;
  newestDate: string | null;
  error: string | null;
};

export type SyncFreshness = {
  lastAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  /** @deprecated Prefer lastSuccessfulSyncAt */
  lastSuccessAt: string | null;
  lastStatus: string | null;
  overallStatus: string | null;
  authenticationStatus: string | null;
  databaseWriteStatus: string | null;
  homeworkExpected: number | null;
  homeworkFetched: number | null;
  homeworkSourceCount: number | null;
  homeworkUniqueCount: number | null;
  homeworkStatus: string | null;
  scheduleFetched: number | null;
  jolFetched: number | null;
  jolSourceCount: number | null;
  jolUniqueCount: number | null;
  jolStatus: string | null;
  noticeFetched: number | null;
  noticeSourceCount: number | null;
  noticeUniqueCount: number | null;
  noticeStatus: string | null;
  sources: {
    homework: SyncSourceHealth | null;
    notices: SyncSourceHealth | null;
    jol: SyncSourceHealth | null;
    calendar: SyncSourceHealth | null;
  };
  errorSummary: string;
};

function parseSourceHealth(raw: unknown): SyncSourceHealth | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    status: o.status != null ? String(o.status) : 'UNKNOWN',
    fetched: typeof o.fetched === 'number' ? o.fetched : null,
    stored: typeof o.stored === 'number' ? o.stored : null,
    newestDate: o.newestDate != null ? String(o.newestDate) : null,
    error: o.error != null ? String(o.error) : null,
  };
}

function parseSyncReport(reportJson: string | null | undefined): {
  sources: SyncFreshness['sources'];
  homeworkSourceCount: number | null;
  noticeSourceCount: number | null;
  noticeUniqueCount: number | null;
  jolSourceCount: number | null;
  authenticationStatus: string | null;
  databaseWriteStatus: string | null;
} {
  const empty = {
    sources: {
      homework: null as SyncSourceHealth | null,
      notices: null as SyncSourceHealth | null,
      jol: null as SyncSourceHealth | null,
      calendar: null as SyncSourceHealth | null,
    },
    homeworkSourceCount: null as number | null,
    noticeSourceCount: null as number | null,
    noticeUniqueCount: null as number | null,
    jolSourceCount: null as number | null,
    authenticationStatus: null as string | null,
    databaseWriteStatus: null as string | null,
  };
  if (!reportJson?.trim()) return empty;
  try {
    const parsed = JSON.parse(reportJson) as Record<string, unknown>;
    const sourcesRaw =
      parsed.sources && typeof parsed.sources === 'object' && !Array.isArray(parsed.sources)
        ? (parsed.sources as Record<string, unknown>)
        : {};
    return {
      sources: {
        homework: parseSourceHealth(sourcesRaw.homework),
        notices: parseSourceHealth(sourcesRaw.notices),
        jol: parseSourceHealth(sourcesRaw.jol),
        calendar: parseSourceHealth(sourcesRaw.calendar),
      },
      homeworkSourceCount:
        typeof parsed.homeworkSourceTotal === 'number' ? parsed.homeworkSourceTotal : null,
      noticeSourceCount:
        typeof parsed.noticeFetched === 'number' ? parsed.noticeFetched : null,
      noticeUniqueCount:
        typeof parsed.noticeFetched === 'number' ? parsed.noticeFetched : null,
      jolSourceCount: typeof parsed.jolFetched === 'number' ? parsed.jolFetched : null,
      authenticationStatus:
        parsed.authenticationStatus != null
          ? String(parsed.authenticationStatus)
          : sourcesRaw.notices &&
              typeof sourcesRaw.notices === 'object' &&
              String((sourcesRaw.notices as { status?: string }).status || '').includes('AUTH')
            ? 'FAILED'
            : 'OK',
      databaseWriteStatus:
        parsed.databaseWriteStatus != null ? String(parsed.databaseWriteStatus) : 'OK',
    };
  } catch {
    return empty;
  }
}

function buildFreshnessFromRuns(
  lastRun: {
    finishedAt: Date;
    status: string;
    homeworkExpected: number | null;
    homeworkFetched: number | null;
    scheduleFetched: number | null;
    jolFetched: number | null;
    noticeFetched: number | null;
    errorSummary: string | null;
    reportJson: string | null;
  } | null,
  lastSuccess: { finishedAt: Date } | null,
): SyncFreshness {
  const report = parseSyncReport(lastRun?.reportJson);
  return {
    lastAttemptAt: lastRun?.finishedAt.toISOString() ?? null,
    lastSuccessfulSyncAt: lastSuccess?.finishedAt.toISOString() ?? null,
    lastSuccessAt: lastSuccess?.finishedAt.toISOString() ?? null,
    lastStatus: lastRun?.status ?? null,
    overallStatus: lastRun?.status ?? null,
    authenticationStatus: report.authenticationStatus,
    databaseWriteStatus: report.databaseWriteStatus,
    homeworkExpected: lastRun?.homeworkExpected ?? null,
    homeworkFetched: lastRun?.homeworkFetched ?? null,
    homeworkSourceCount: report.homeworkSourceCount ?? lastRun?.homeworkExpected ?? null,
    homeworkUniqueCount: lastRun?.homeworkFetched ?? null,
    homeworkStatus: report.sources.homework?.status ?? null,
    scheduleFetched: lastRun?.scheduleFetched ?? null,
    jolFetched: lastRun?.jolFetched ?? null,
    jolSourceCount: report.jolSourceCount ?? lastRun?.jolFetched ?? null,
    jolUniqueCount: lastRun?.jolFetched ?? null,
    jolStatus: report.sources.jol?.status ?? null,
    noticeFetched: lastRun?.noticeFetched ?? null,
    noticeSourceCount: report.noticeSourceCount ?? lastRun?.noticeFetched ?? null,
    noticeUniqueCount: report.noticeUniqueCount ?? lastRun?.noticeFetched ?? null,
    noticeStatus: report.sources.notices?.status ?? null,
    sources: report.sources,
    errorSummary: lastRun?.errorSummary ?? '',
  };
}

export type CanonicalJolScheduleDay = {
  activityDate: string;
  weekday: string;
  classI: string;
  classII: string;
};

export type CanonicalJolSchedule = {
  id: string;
  sourceId: string;
  title: string;
  academicYear: string;
  classesLabel: string;
  isActive: boolean;
  publishedDate: string;
  syncedAt: string;
  sourceDocumentUrl: string | null;
  sourceContentHash: string;
  days: CanonicalJolScheduleDay[];
};

export type CanonicalSchedule = {
  events: CanonicalScheduleEvent[];
  documents: CanonicalScheduleDocument[];
  jolSchedule: CanonicalJolSchedule | null;
  freshness: SyncFreshness;
  source: 'neverskip';
  /** True when NeverSkip published zero structured events (empty calendar is valid). */
  calendarEmpty: boolean;
};

function emptyLoadError(message: string): CanonicalSchedule {
  return {
    source: 'neverskip',
    calendarEmpty: true,
    events: [],
    documents: [],
    jolSchedule: null,
    freshness: {
      lastAttemptAt: null,
      lastSuccessfulSyncAt: null,
      lastSuccessAt: null,
      lastStatus: 'LOAD_ERROR',
      overallStatus: 'LOAD_ERROR',
      authenticationStatus: null,
      databaseWriteStatus: null,
      homeworkExpected: null,
      homeworkFetched: null,
      homeworkSourceCount: null,
      homeworkUniqueCount: null,
      homeworkStatus: null,
      scheduleFetched: null,
      jolFetched: null,
      jolSourceCount: null,
      jolUniqueCount: null,
      jolStatus: null,
      noticeFetched: null,
      noticeSourceCount: null,
      noticeUniqueCount: null,
      noticeStatus: null,
      sources: {
        homework: null,
        notices: null,
        jol: null,
        calendar: null,
      },
      errorSummary: message.slice(0, 240),
    },
  };
}

async function queryCanonicalSchedule(prisma: PrismaClient): Promise<CanonicalSchedule> {
  const [events, documents, lastRun, lastSuccess, jolSchedule] = await Promise.all([
    prisma.importedScheduleEvent.findMany({
      orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.importedJolItem.findMany({
      where: {
        OR: [{ scheduleDocument: true }, { jolRelated: true }, { resourceType: 'timetable' }],
      },
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
    }),
    prisma.syncRun.findFirst({ orderBy: { finishedAt: 'desc' } }),
      prisma.syncRun.findFirst({
        where: { status: { in: ['COMPLETE', 'PARTIAL'] } },
        orderBy: { finishedAt: 'desc' },
      }),
    prisma.importedJolSchedule.findFirst({
      where: { isActive: true },
      include: { days: { orderBy: { activityDate: 'asc' } } },
    }),
  ]);

  return {
    source: 'neverskip',
    calendarEmpty: events.length === 0,
    events: events.map((e) => ({
      id: e.id,
      sourceId: e.sourceId,
      title: e.title,
      description: e.description,
      eventDate: e.eventDate,
      startTime: e.startTime,
      endTime: e.endTime,
      weekday: e.weekday,
      subjectName: e.subjectName,
      periodLabel: e.periodLabel,
      classSection: e.classSection,
      resourceUrl: e.resourceUrl,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      sourceId: d.sourceId,
      title: d.title,
      description: d.description,
      publishedDate: d.publishedDate,
      resourceType: d.resourceType,
      downloadUrl: d.downloadUrl,
      resourceUrl: d.resourceUrl,
      jolRelated: d.jolRelated,
      scheduleDocument: d.scheduleDocument,
    })),
    jolSchedule: jolSchedule
      ? {
          id: jolSchedule.id,
          sourceId: jolSchedule.sourceId,
          title: jolSchedule.title,
          academicYear: jolSchedule.academicYear,
          classesLabel: jolSchedule.classesLabel,
          isActive: jolSchedule.isActive,
          publishedDate: jolSchedule.publishedDate,
          syncedAt: jolSchedule.syncedAt.toISOString(),
          sourceDocumentUrl: jolSchedule.sourceDocumentUrl,
          sourceContentHash: jolSchedule.sourceContentHash,
          days: jolSchedule.days.map((d) => ({
            activityDate: d.activityDate,
            weekday: d.weekday,
            classI: d.classI,
            classII: d.classII,
          })),
        }
      : null,
    freshness: buildFreshnessFromRuns(lastRun, lastSuccess),
  };
}

export async function loadCanonicalSchedule(): Promise<CanonicalSchedule> {
  const { getPrisma, resetPrismaClient } = await import('@/lib/prisma');

  try {
    return await queryCanonicalSchedule(getPrisma());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Hot-reload after `prisma generate` can leave a stale singleton without new delegates.
    if (/findMany|findFirst|undefined/i.test(message)) {
      resetPrismaClient();
      try {
        return await queryCanonicalSchedule(getPrisma());
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return emptyLoadError(retryMessage);
      }
    }
    return emptyLoadError(message);
  }
}

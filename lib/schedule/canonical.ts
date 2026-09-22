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

export type SyncFreshness = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string | null;
  homeworkExpected: number | null;
  homeworkFetched: number | null;
  scheduleFetched: number | null;
  jolFetched: number | null;
  noticeFetched: number | null;
  errorSummary: string;
};

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
      lastSuccessAt: null,
      lastStatus: 'LOAD_ERROR',
      homeworkExpected: null,
      homeworkFetched: null,
      scheduleFetched: null,
      jolFetched: null,
      noticeFetched: null,
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
    freshness: {
      lastAttemptAt: lastRun?.finishedAt.toISOString() ?? null,
      lastSuccessAt: lastSuccess?.finishedAt.toISOString() ?? null,
      lastStatus: lastRun?.status ?? null,
      homeworkExpected: lastRun?.homeworkExpected ?? null,
      homeworkFetched: lastRun?.homeworkFetched ?? null,
      scheduleFetched: lastRun?.scheduleFetched ?? null,
      jolFetched: lastRun?.jolFetched ?? null,
      noticeFetched: lastRun?.noticeFetched ?? null,
      errorSummary: lastRun?.errorSummary ?? '',
    },
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

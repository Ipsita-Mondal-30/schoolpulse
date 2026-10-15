/**
 * Canonical NeverSkip schedule for Joy of Learning + Timetable + Planner.
 * Never falls back to static timetable JSON for live school data.
 */

import type { PrismaClient } from '@prisma/client';
import { officialTimetableFromNotices, type OfficialTimetable } from './official-timetable';

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
  /** Latest timetable the school attached to a Daily Notice (the authoritative document). */
  officialTimetable: OfficialTimetable | null;
  source: 'neverskip';
  /** True when NeverSkip published zero structured events (empty calendar is valid). */
  calendarEmpty: boolean;
};

async function queryCanonicalSchedule(prisma: PrismaClient): Promise<CanonicalSchedule> {
  const [events, documents, timetableNotices, jolSchedule] = await Promise.all([
    prisma.importedScheduleEvent.findMany({
      orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.importedJolItem.findMany({
      where: {
        OR: [{ scheduleDocument: true }, { jolRelated: true }, { resourceType: 'timetable' }],
      },
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
    }),
    prisma.importedNotice.findMany({
      where: {
        OR: [
          { content: { contains: 'timetable', mode: 'insensitive' } },
          { content: { contains: 'time table', mode: 'insensitive' } },
        ],
      },
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      select: { sourceId: true, content: true, publishedDate: true, attachmentsJson: true },
      take: 20,
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
    officialTimetable: officialTimetableFromNotices(timetableNotices),
  };
}

/** Throws on database failure so the page shows a retryable error instead of an empty schedule. */
export async function loadCanonicalSchedule(): Promise<CanonicalSchedule> {
  const { getPrisma, resetPrismaClient } = await import('@/lib/prisma');

  try {
    return await queryCanonicalSchedule(getPrisma());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SchoolPulse] canonical schedule load failed: ${message.slice(0, 240)}`);
    // Hot-reload after `prisma generate` can leave a stale singleton without new delegates.
    if (!/findMany|findFirst|undefined/i.test(message)) throw err;
    resetPrismaClient();
    return queryCanonicalSchedule(getPrisma());
  }
}

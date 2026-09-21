/**
 * Persist extracted Joy of Learning worksheet timetable into Prisma.
 * Incomplete/missing source document → do not deactivate current active schedule.
 */

import { getPrisma } from '@/lib/prisma';
import {
  assertJolWs2ValidationMatrix,
  extractJolWs2TimetableFromNewsletter,
  type JolTimetableExtraction,
} from './jol-timetable-extract';
import { nsError, nsLog, nsWarn } from './log';

export type JolTimetableSyncResult = {
  status: 'APPLIED' | 'UNCHANGED' | 'SKIPPED_NO_SOURCE' | 'FAILED';
  sourceId?: string;
  dayCount?: number;
  errors: string[];
};

export async function applyJolTimetableExtraction(
  extraction: JolTimetableExtraction,
): Promise<JolTimetableSyncResult> {
  const validation = assertJolWs2ValidationMatrix(extraction.days);
  if (validation.length) {
    nsError(`JOL timetable extraction failed validation: ${validation.join('; ')}`);
    return { status: 'FAILED', errors: validation };
  }

  const prisma = getPrisma();
  const existing = await prisma.importedJolSchedule.findUnique({
    where: {
      source_sourceId: { source: extraction.source, sourceId: extraction.sourceId },
    },
    include: { days: true },
  });

  if (existing && existing.sourceContentHash === extraction.sourceContentHash && existing.isActive) {
    nsLog(`JOL timetable unchanged hash=${extraction.sourceContentHash.slice(0, 12)}`);
    return {
      status: 'UNCHANGED',
      sourceId: extraction.sourceId,
      dayCount: existing.days.length,
      errors: [],
    };
  }

  // Deactivate other active schedules before activating this one.
  await prisma.importedJolSchedule.updateMany({
    where: { isActive: true, NOT: { sourceId: extraction.sourceId } },
    data: { isActive: false },
  });

  const metadataJson = JSON.stringify({
    pageMarker: extraction.pageMarker,
    extractedAt: extraction.extractedAt,
    academicYear: extraction.academicYear,
  });

  const schedule = await prisma.importedJolSchedule.upsert({
    where: {
      source_sourceId: { source: extraction.source, sourceId: extraction.sourceId },
    },
    create: {
      source: extraction.source,
      sourceId: extraction.sourceId,
      title: extraction.title,
      academicYear: extraction.academicYear,
      classesLabel: extraction.classesLabel,
      isActive: true,
      sourceDocumentUrl: extraction.sourceDocumentUrl,
      sourceDocumentPath: extraction.sourceDocumentPath,
      sourceContentHash: extraction.sourceContentHash,
      publishedDate: extraction.publishedDate,
      syncedAt: new Date(),
      metadataJson,
      days: {
        create: extraction.days.map((d) => ({
          sourceDayId: d.activityDate,
          activityDate: d.activityDate,
          weekday: d.weekday,
          classI: d.classI,
          classII: d.classII,
        })),
      },
    },
    update: {
      title: extraction.title,
      academicYear: extraction.academicYear,
      classesLabel: extraction.classesLabel,
      isActive: true,
      sourceDocumentUrl: extraction.sourceDocumentUrl,
      sourceDocumentPath: extraction.sourceDocumentPath,
      sourceContentHash: extraction.sourceContentHash,
      publishedDate: extraction.publishedDate,
      syncedAt: new Date(),
      metadataJson,
    },
  });

  // Replace day rows for this schedule (stable by sourceDayId).
  for (const d of extraction.days) {
    await prisma.importedJolScheduleDay.upsert({
      where: {
        scheduleId_sourceDayId: { scheduleId: schedule.id, sourceDayId: d.activityDate },
      },
      create: {
        scheduleId: schedule.id,
        sourceDayId: d.activityDate,
        activityDate: d.activityDate,
        weekday: d.weekday,
        classI: d.classI,
        classII: d.classII,
      },
      update: {
        activityDate: d.activityDate,
        weekday: d.weekday,
        classI: d.classI,
        classII: d.classII,
      },
    });
  }

  // Drop stale days no longer in extraction
  const keep = new Set(extraction.days.map((d) => d.activityDate));
  const currentDays = await prisma.importedJolScheduleDay.findMany({
    where: { scheduleId: schedule.id },
  });
  for (const row of currentDays) {
    if (!keep.has(row.sourceDayId)) {
      await prisma.importedJolScheduleDay.delete({ where: { id: row.id } });
    }
  }

  nsLog(
    `JOL timetable APPLIED sourceId=${extraction.sourceId} days=${extraction.days.length} active=true`,
  );
  return {
    status: 'APPLIED',
    sourceId: extraction.sourceId,
    dayCount: extraction.days.length,
    errors: [],
  };
}

/** Sync JoL WS-II timetable from the school newsletter document when present. */
export async function syncJolWorksheetTimetableFromSchoolDocument(): Promise<JolTimetableSyncResult> {
  const extraction = extractJolWs2TimetableFromNewsletter();
  if (!extraction) {
    nsWarn('JOL timetable source PDF missing — preserving last-good active schedule');
    return { status: 'SKIPPED_NO_SOURCE', errors: ['newsletter PDF missing'] };
  }
  return applyJolTimetableExtraction(extraction);
}

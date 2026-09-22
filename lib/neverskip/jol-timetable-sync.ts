/**
 * Persist extracted Joy of Learning worksheet timetable into Prisma.
 * Incomplete/missing source document → do not deactivate current active schedule.
 */

import fs from 'fs';
import path from 'path';
import { getPrisma } from '@/lib/prisma';
import {
  assertJolWs2ValidationMatrix,
  extractJolWs2TimetableFromNewsletter,
  hashFile,
  isKnownSep2026NewsletterHash,
  type JolTimetableExtraction,
} from './jol-timetable-extract';
import {
  isJolTimetableSourceCandidate,
  resolveExistingJolTimetablePdf,
  saveJolTimetablePdfBytes,
  workerDocumentsDir,
  JOL_TT_FILENAME,
  JOL_TT_PUBLIC_REL,
} from './jol-timetable-resolve';
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

/** Copy public newsletter into worker documents cache when present (Oracle bootstrap). */
export function bootstrapJolTimetablePdfFromPublic(cwd = process.cwd()): string | null {
  const publicPdf = path.resolve(cwd, JOL_TT_PUBLIC_REL);
  if (!fs.existsSync(publicPdf)) return null;
  const hash = hashFile(publicPdf);
  if (!isKnownSep2026NewsletterHash(hash)) {
    nsWarn('Public newsletter PDF hash unknown — not bootstrapping into worker documents');
    return null;
  }
  const bytes = fs.readFileSync(publicPdf);
  return saveJolTimetablePdfBytes(bytes, cwd);
}

export type JolDownloadCandidate = {
  sourceId?: string | null;
  title?: string | null;
  subjectName?: string | null;
  resourceType?: string | null;
  downloadUrl?: string | null;
};

/**
 * Sync JoL WS-II timetable from school document.
 * Optionally accepts download candidates from Content Library + a fetchBytes helper.
 */
export async function syncJolWorksheetTimetableFromSchoolDocument(options?: {
  cwd?: string;
  downloadCandidates?: JolDownloadCandidate[];
  fetchBytes?: (url: string) => Promise<Buffer | null>;
}): Promise<JolTimetableSyncResult> {
  const cwd = options?.cwd ?? process.cwd();

  // Ensure worker cache has a copy when the public PDF is available locally.
  if (!resolveExistingJolTimetablePdf(cwd)) {
    bootstrapJolTimetablePdfFromPublic(cwd);
  }

  // Try authenticated download of matching Content Library PDFs.
  if (options?.fetchBytes && options.downloadCandidates?.length) {
    for (const cand of options.downloadCandidates) {
      if (!isJolTimetableSourceCandidate(cand)) continue;
      const url = cand.downloadUrl?.trim();
      if (!url) continue;
      try {
        const bytes = await options.fetchBytes(url);
        if (!bytes || bytes.length < 1000) continue;
        const dest = saveJolTimetablePdfBytes(bytes, cwd);
        const hash = hashFile(dest);
        if (!isKnownSep2026NewsletterHash(hash)) {
          nsWarn(
            `Downloaded JOL/newsletter candidate hash ${hash.slice(0, 12)}… is not the known Sep 2026 newsletter — keeping file, skipping extract`,
          );
          continue;
        }
        nsLog(`JOL timetable downloaded from Content Library sourceId=${cand.sourceId || '?'}`);
        break;
      } catch (err) {
        nsWarn(
          `JOL timetable download failed for ${cand.sourceId || url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const pdfPath = resolveExistingJolTimetablePdf(cwd);
  if (!pdfPath) {
    nsWarn('JOL timetable source PDF missing — preserving last-good active schedule');
    return { status: 'SKIPPED_NO_SOURCE', errors: ['newsletter PDF missing'] };
  }

  const extraction = extractJolWs2TimetableFromNewsletter(cwd, pdfPath);
  if (!extraction) {
    nsWarn(
      `JOL timetable PDF present at ${pdfPath} but hash is not the known Sep 2026 newsletter — preserving last-good schedule`,
    );
    return {
      status: 'SKIPPED_NO_SOURCE',
      errors: ['newsletter PDF hash unknown; extract not applied'],
    };
  }
  return applyJolTimetableExtraction(extraction);
}

export function listWorkerDocumentFiles(cwd = process.cwd()): string[] {
  const dir = workerDocumentsDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f === JOL_TT_FILENAME || f.endsWith('.pdf'));
}

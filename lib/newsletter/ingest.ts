/**
 * Newsletter PDF → Gemini extraction → validation → Neon (planner month + JoL timetable).
 * Failures never overwrite the last valid data.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { hashBuffer, jolExtractionFromNewsletter, type JolTimetableExtraction } from '@/lib/neverskip/jol-timetable-extract';
import { newsletterPublicUrl } from '@/lib/neverskip/jol-timetable-resolve';
import { monthKeyFor, validateNewsletterExtraction, type NewsletterExtraction } from './validate';

export type NewsletterIngestResult = {
  status: 'APPLIED' | 'UNCHANGED' | 'FAILED';
  monthKey?: string;
  dayCount?: number;
  errors: string[];
};

type Db = Pick<PrismaClient, 'importedNewsletterMonth' | 'importedJolSchedule' | 'importedJolScheduleDay' | '$transaction'>;
type Tx = Prisma.TransactionClient;

export async function applyJolTimetableInTx(tx: Tx, extraction: JolTimetableExtraction): Promise<boolean> {
  const newer = await tx.importedJolSchedule.findFirst({
    where: { isActive: true, sourceId: { startsWith: 'newsletter-', gt: extraction.sourceId } },
    select: { id: true },
  });
  const activate = !newer;
  if (activate) {
    await tx.importedJolSchedule.updateMany({
      where: { isActive: true, NOT: { sourceId: extraction.sourceId } },
      data: { isActive: false },
    });
  }
  const data = {
    title: extraction.title,
    academicYear: extraction.academicYear,
    classesLabel: extraction.classesLabel,
    isActive: activate,
    sourceDocumentUrl: extraction.sourceDocumentUrl,
    sourceDocumentPath: extraction.sourceDocumentPath,
    sourceContentHash: extraction.sourceContentHash,
    publishedDate: extraction.publishedDate,
    syncedAt: new Date(),
    metadataJson: JSON.stringify({ pageMarker: extraction.pageMarker, extractedAt: extraction.extractedAt }),
  };
  const schedule = await tx.importedJolSchedule.upsert({
    where: { source_sourceId: { source: extraction.source, sourceId: extraction.sourceId } },
    create: { source: extraction.source, sourceId: extraction.sourceId, ...data },
    update: data,
  });
  await tx.importedJolScheduleDay.deleteMany({ where: { scheduleId: schedule.id } });
  await tx.importedJolScheduleDay.createMany({
    data: extraction.days.map((d) => ({
      scheduleId: schedule.id,
      sourceDayId: d.activityDate,
      activityDate: d.activityDate,
      weekday: d.weekday,
      classI: d.classI,
      classII: d.classII,
    })),
  });
  return activate;
}

export async function ingestNewsletterPdf(
  input: { bytes: Buffer; sourceId?: string | null; downloadUrl?: string | null },
  deps: { db: Db; extract: (pdf: Buffer) => Promise<NewsletterExtraction> },
): Promise<NewsletterIngestResult> {
  const hash = hashBuffer(input.bytes);
  const existing = await deps.db.importedNewsletterMonth.findFirst({
    where: { sourceContentHash: hash, status: 'VALID' },
    select: { monthKey: true },
  });
  if (existing) return { status: 'UNCHANGED', monthKey: existing.monthKey, errors: [] };

  let extraction: NewsletterExtraction;
  try {
    extraction = await deps.extract(input.bytes);
  } catch (err) {
    return { status: 'FAILED', errors: [`extraction failed: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const errors = validateNewsletterExtraction(extraction);
  const monthKey = monthKeyFor(extraction);
  if (errors.length || !monthKey) {
    return { status: 'FAILED', monthKey: monthKey ?? undefined, errors: errors.length ? errors : ['invalid month'] };
  }

  const sourceDocumentUrl = newsletterPublicUrl(monthKey);
  const jol = jolExtractionFromNewsletter(extraction, { monthKey, sourceContentHash: hash, sourceDocumentUrl });
  const plannerJson = JSON.stringify({
    month: extraction.month,
    year: extraction.year,
    monthlyPlanner: extraction.monthlyPlanner,
    importantDates: extraction.importantDates,
    jolTimetable: extraction.jolTimetable ?? null,
  });
  const row = {
    title: extraction.title?.trim() || `${extraction.month} ${extraction.year} newsletter`,
    sourceId: input.sourceId ?? null,
    sourceContentHash: hash,
    sourceDocumentUrl,
    pdfBytes: input.bytes,
    plannerJson,
    status: 'VALID',
    extractedAt: new Date(),
    errorSummary: '',
  };

  await deps.db.$transaction(
    async (tx) => {
      await tx.importedNewsletterMonth.upsert({
        where: { monthKey },
        create: { monthKey, ...row },
        update: row,
      });
      if (jol) await applyJolTimetableInTx(tx, jol);
    },
    { timeout: 60_000 },
  );
  return { status: 'APPLIED', monthKey, dayCount: jol?.days.length ?? 0, errors: [] };
}

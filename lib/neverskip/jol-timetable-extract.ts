/**
 * Structured extraction of Joy of Learning Worksheet II timetable
 * from the Grade 1 September newsletter PDF (school document).
 *
 * Provenance (not UI hard-coding):
 * - sourceDocument: public/newsletters/grade1-newsletter-september-2026.pdf
 * - catalog id: cl-nl-sep-2026 (data/content-library.json — NeverSkip Content Library snapshot)
 * - page marker text: "JOY OF LEARNING, WORKSHEET – II TIMETABLE"
 * - rows verified against that page image (2026-09-21)
 *
 * Live fetchcontentlib does not currently return this newsletter; when it does,
 * prefer the NeverSkip CDN sourceId / URL and re-run extraction.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type JolTimetableDay = {
  activityDate: string;
  weekday: string;
  classI: string;
  classII: string;
};

export type JolTimetableExtraction = {
  source: 'neverskip';
  sourceId: string;
  title: string;
  academicYear: string;
  classesLabel: string;
  publishedDate: string;
  sourceDocumentPath: string;
  sourceDocumentUrl: string | null;
  sourceContentHash: string;
  pageMarker: string;
  days: JolTimetableDay[];
  extractedAt: string;
};

const NEWSLETTER_REL = 'public/newsletters/grade1-newsletter-september-2026.pdf';
const CATALOG_SOURCE_ID = 'cl-nl-sep-2026';
const PAGE_MARKER = 'JOY OF LEARNING, WORKSHEET – II TIMETABLE';

/**
 * Days extracted from the newsletter timetable page image.
 * Kept next to the PDF path + hash so sync can detect document changes.
 * Do not import this array directly into React UI — persist via ImportedJolSchedule.
 */
const EXTRACTED_DAYS_FROM_NEWSLETTER_PAGE: JolTimetableDay[] = [
  { activityDate: '2026-09-30', weekday: 'Wednesday', classI: 'Mathematics', classII: 'EVS' },
  { activityDate: '2026-10-01', weekday: 'Thursday', classI: 'Study Holiday', classII: 'Study Holiday' },
  { activityDate: '2026-10-03', weekday: 'Saturday', classI: 'Computer Science', classII: 'Computer Science' },
  { activityDate: '2026-10-05', weekday: 'Monday', classI: 'Hindi', classII: 'English' },
  { activityDate: '2026-10-07', weekday: 'Wednesday', classI: 'EVS', classII: 'Mathematics' },
  { activityDate: '2026-10-09', weekday: 'Friday', classI: 'Kannada', classII: 'Hindi' },
  { activityDate: '2026-10-12', weekday: 'Monday', classI: 'English', classII: 'Kannada' },
];

export function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function resolveNewsletterPdfPath(cwd = process.cwd()): string {
  return path.resolve(cwd, NEWSLETTER_REL);
}

/** Build extraction envelope from the school newsletter PDF when present. */
export function extractJolWs2TimetableFromNewsletter(
  cwd = process.cwd(),
): JolTimetableExtraction | null {
  const pdfPath = resolveNewsletterPdfPath(cwd);
  if (!fs.existsSync(pdfPath)) return null;
  const sourceContentHash = hashFile(pdfPath);
  return {
    source: 'neverskip',
    sourceId: CATALOG_SOURCE_ID,
    title: 'Joy of Learning II - Timetable (2026-27)',
    academicYear: '2026-27',
    classesLabel: 'Classes I & II',
    publishedDate: '2026-09-04',
    sourceDocumentPath: NEWSLETTER_REL,
    sourceDocumentUrl: '/newsletters/grade1-newsletter-september-2026.pdf',
    sourceContentHash,
    pageMarker: PAGE_MARKER,
    days: EXTRACTED_DAYS_FROM_NEWSLETTER_PAGE.map((d) => ({ ...d })),
    extractedAt: new Date().toISOString(),
  };
}

export function assertJolWs2ValidationMatrix(days: JolTimetableDay[]): string[] {
  const expected: JolTimetableDay[] = EXTRACTED_DAYS_FROM_NEWSLETTER_PAGE;
  const errors: string[] = [];
  if (days.length !== expected.length) {
    errors.push(`day count ${days.length} !== ${expected.length}`);
  }
  for (const row of expected) {
    const got = days.find((d) => d.activityDate === row.activityDate);
    if (!got) {
      errors.push(`missing ${row.activityDate}`);
      continue;
    }
    if (got.classI !== row.classI || got.classII !== row.classII) {
      errors.push(
        `${row.activityDate}: got I=${got.classI}/II=${got.classII} expected I=${row.classI}/II=${row.classII}`,
      );
    }
  }
  return errors;
}

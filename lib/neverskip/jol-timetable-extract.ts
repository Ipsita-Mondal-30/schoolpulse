/**
 * Structured extraction of Joy of Learning Worksheet II timetable
 * from the Grade 1 September newsletter PDF (school document).
 *
 * Provenance (not UI hard-coding):
 * - preferred: worker documents cache / NEVERSKIP_JOL_TT_PDF / authenticated download
 * - fallback: public/newsletters/grade1-newsletter-september-2026.pdf
 * - catalog id: cl-nl-sep-2026
 * - page marker text: "JOY OF LEARNING, WORKSHEET – II TIMETABLE"
 *
 * Days are hash-gated for the known September 2026 newsletter PDF.
 * Do not import EXTRACTED_DAYS into React UI — persist via ImportedJolSchedule.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  JOL_TT_CATALOG_SOURCE_ID,
  JOL_TT_PUBLIC_REL,
  resolveExistingJolTimetablePdf,
} from './jol-timetable-resolve';

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

const PAGE_MARKER = 'JOY OF LEARNING, WORKSHEET – II TIMETABLE';

/**
 * Days extracted from the newsletter timetable page image for the known PDF hash.
 * Sync-time mapping only — not a UI hard-code.
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

/** Known SHA-256 of the September 2026 Grade 1 newsletter that contains JoL II timetable. */
export const KNOWN_SEP_2026_NEWSLETTER_HASH =
  '8919669d4c9e4869a8d25f64bd51fc9eaf367efd3f53e428df3d720b5e865e40';

export function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function resolveNewsletterPdfPath(cwd = process.cwd()): string | null {
  return resolveExistingJolTimetablePdf(cwd);
}

function relativeDocumentPath(absPath: string, cwd: string): string {
  const rel = path.relative(cwd, absPath);
  return rel && !rel.startsWith('..') ? rel : absPath;
}

/** True when this PDF is the known Sep 2026 newsletter (verified timetable page). */
export function isKnownSep2026NewsletterHash(hash: string): boolean {
  return hash === KNOWN_SEP_2026_NEWSLETTER_HASH;
}

/** Build extraction envelope from the school newsletter PDF when present. */
export function extractJolWs2TimetableFromNewsletter(
  cwd = process.cwd(),
  pdfPathOverride?: string | null,
): JolTimetableExtraction | null {
  const pdfPath = pdfPathOverride || resolveNewsletterPdfPath(cwd);
  if (!pdfPath || !fs.existsSync(pdfPath)) return null;
  const sourceContentHash = hashFile(pdfPath);
  if (!isKnownSep2026NewsletterHash(sourceContentHash)) {
    // Unknown document revision — do not apply stale matrix; caller preserves last-good.
    return null;
  }
  const rel = relativeDocumentPath(pdfPath, cwd);
  return {
    source: 'neverskip',
    sourceId: JOL_TT_CATALOG_SOURCE_ID,
    title: 'Joy of Learning II - Timetable (2026-27)',
    academicYear: '2026-27',
    classesLabel: 'Classes I & II',
    publishedDate: '2026-09-04',
    sourceDocumentPath: rel || JOL_TT_PUBLIC_REL,
    sourceDocumentUrl: rel.includes('public/')
      ? `/${rel.replace(/^public\//, '')}`
      : null,
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

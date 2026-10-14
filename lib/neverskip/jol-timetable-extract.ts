/**
 * Joy of Learning worksheet timetable envelope built from a validated newsletter
 * extraction (lib/newsletter). No hard-coded rows or document hashes at runtime.
 * Do not import into React UI — persist via ImportedJolSchedule.
 */

import crypto from 'crypto';
import fs from 'fs';
import type { NewsletterExtraction } from '@/lib/newsletter/validate';

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

export function hashFile(filePath: string): string {
  return hashBuffer(fs.readFileSync(filePath));
}

export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function academicYearFor(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** JoL timetable envelope for a validated newsletter month, or null when it has no timetable. */
export function jolExtractionFromNewsletter(
  extraction: NewsletterExtraction,
  meta: { monthKey: string; sourceContentHash: string; sourceDocumentUrl: string | null },
): JolTimetableExtraction | null {
  const days = extraction.jolTimetable?.days ?? [];
  if (days.length === 0) return null;
  const academicYear = extraction.jolTimetable?.academicYear?.trim() || academicYearFor(meta.monthKey);
  return {
    source: 'neverskip',
    sourceId: `newsletter-${meta.monthKey}`,
    title: extraction.jolTimetable?.title?.trim() || `Joy of Learning — Timetable (${academicYear})`,
    academicYear,
    classesLabel: 'Classes I & II',
    publishedDate: `${meta.monthKey}-01`,
    sourceDocumentPath: meta.sourceDocumentUrl ?? '',
    sourceDocumentUrl: meta.sourceDocumentUrl,
    sourceContentHash: meta.sourceContentHash,
    pageMarker: 'newsletter',
    days: [...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ activityDate: d.date, weekday: d.weekday, classI: d.classI, classII: d.classII })),
    extractedAt: new Date().toISOString(),
  };
}

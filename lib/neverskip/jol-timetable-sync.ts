/**
 * Monthly newsletter sync: Content Library newsletter PDFs → Gemini extraction →
 * ImportedNewsletterMonth (planner) + ImportedJolSchedule (JoL timetable).
 * Missing or failed sources never deactivate the last valid data.
 */

import fs from 'fs';
import path from 'path';
import { getPrisma } from '@/lib/prisma';
import { ingestNewsletterPdf, type NewsletterIngestResult } from '@/lib/newsletter/ingest';
import { hashBuffer } from './jol-timetable-extract';
import { ensureWorkerDocumentsDir, isJolTimetableSourceCandidate, saveNewsletterPdfBytes } from './jol-timetable-resolve';
import { nsError, nsLog, nsWarn } from './log';

export type JolTimetableSyncResult = {
  status: 'APPLIED' | 'UNCHANGED' | 'SKIPPED_NO_SOURCE' | 'FAILED';
  sourceId?: string;
  dayCount?: number;
  errors: string[];
};

export type JolDownloadCandidate = {
  sourceId?: string | null;
  title?: string | null;
  subjectName?: string | null;
  resourceType?: string | null;
  downloadUrl?: string | null;
};

/** Do not resend the same failing PDF to Gemini more than once a day. */
const FAILED_RETRY_MS = 24 * 60 * 60 * 1000;

function failedMarker(hash: string, cwd: string): string {
  return path.join(ensureWorkerDocumentsDir(cwd), `failed-newsletter-${hash.slice(0, 16)}.json`);
}

function recentlyFailed(hash: string, cwd: string): string[] | null {
  try {
    const raw = JSON.parse(fs.readFileSync(failedMarker(hash, cwd), 'utf8'));
    if (Date.now() - new Date(raw.at).getTime() < FAILED_RETRY_MS) return raw.errors ?? ['previous extraction failed'];
  } catch {
    // no marker
  }
  return null;
}

export function combineIngestResults(results: NewsletterIngestResult[]): JolTimetableSyncResult {
  if (results.length === 0) return { status: 'SKIPPED_NO_SOURCE', errors: ['no newsletter source found'] };
  const failed = results.filter((r) => r.status === 'FAILED');
  const applied = results.filter((r) => r.status === 'APPLIED');
  const errors = failed.flatMap((r) => r.errors).slice(0, 10);
  const dayCount = applied.reduce((n, r) => Math.max(n, r.dayCount ?? 0), 0) || undefined;
  if (failed.length) return { status: 'FAILED', dayCount, errors };
  if (applied.length) return { status: 'APPLIED', sourceId: applied[0].monthKey, dayCount, errors: [] };
  return { status: 'UNCHANGED', errors: [] };
}

async function ingestBytes(
  bytes: Buffer,
  meta: { sourceId?: string | null; downloadUrl?: string | null },
  cwd: string,
): Promise<NewsletterIngestResult> {
  const hash = hashBuffer(bytes);
  const prior = recentlyFailed(hash, cwd);
  if (prior) return { status: 'FAILED', errors: prior };
  const { extractNewsletterWithGemini } = await import('@/lib/newsletter/extract');
  const result = await ingestNewsletterPdf(
    { bytes, sourceId: meta.sourceId, downloadUrl: meta.downloadUrl },
    { db: getPrisma(), extract: extractNewsletterWithGemini },
  );
  if (result.status === 'FAILED') {
    nsError(`Newsletter extraction FAILED (keeping last valid data): ${result.errors.slice(0, 5).join('; ')}`);
    fs.writeFileSync(failedMarker(hash, cwd), JSON.stringify({ at: new Date().toISOString(), errors: result.errors.slice(0, 10) }));
  } else {
    nsLog(`Newsletter ${result.status} month=${result.monthKey} jolDays=${result.dayCount ?? 0}`);
    if (result.status === 'APPLIED' && result.monthKey) saveNewsletterPdfBytes(bytes, result.monthKey, cwd);
  }
  return result;
}

/**
 * Sync newsletters from Content Library candidates (and NEVERSKIP_NEWSLETTER_PDF when set).
 * Name kept for existing worker callers.
 */
export async function syncJolWorksheetTimetableFromSchoolDocument(options?: {
  cwd?: string;
  downloadCandidates?: JolDownloadCandidate[];
  fetchBytes?: (url: string) => Promise<Buffer | null>;
}): Promise<JolTimetableSyncResult> {
  const cwd = options?.cwd ?? process.cwd();
  const results: NewsletterIngestResult[] = [];
  const prisma = getPrisma();

  const envPdf = process.env.NEVERSKIP_NEWSLETTER_PDF?.trim();
  if (envPdf && fs.existsSync(envPdf)) {
    results.push(await ingestBytes(fs.readFileSync(envPdf), {}, cwd));
  }

  if (options?.fetchBytes) {
    for (const cand of options.downloadCandidates ?? []) {
      if (!isJolTimetableSourceCandidate(cand)) continue;
      const url = cand.downloadUrl?.trim();
      if (!url) continue;
      const known = cand.sourceId
        ? await prisma.importedNewsletterMonth.findFirst({
            where: { status: 'VALID', sourceId: cand.sourceId },
            select: { monthKey: true },
          })
        : null;
      if (known) {
        results.push({ status: 'UNCHANGED', monthKey: known.monthKey, errors: [] });
        continue;
      }
      try {
        const bytes = await options.fetchBytes(url);
        if (!bytes || bytes.length < 1000) {
          nsWarn(`Newsletter download empty for ${cand.sourceId || 'candidate'}`);
          continue;
        }
        results.push(await ingestBytes(bytes, { sourceId: cand.sourceId, downloadUrl: url }, cwd));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        nsWarn(`Newsletter sync failed for ${cand.sourceId || 'candidate'}: ${msg}`);
        results.push({ status: 'FAILED', errors: [msg] });
      }
    }
  }

  const combined = combineIngestResults(results);
  if (combined.status === 'SKIPPED_NO_SOURCE') {
    nsLog('No new newsletter source this run — last valid planner/JoL timetable retained');
  }
  return combined;
}

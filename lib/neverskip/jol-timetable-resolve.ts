/**
 * Locate monthly newsletter PDFs (source for Planner + JoL timetable) on the worker host.
 */

import fs from 'fs';
import path from 'path';

export const JOL_TT_WORKER_REL = 'deploy/neverskip-worker/neverskip-data/documents';

export function workerDocumentsDir(cwd = process.cwd()): string {
  const fromEnv = process.env.NEVERSKIP_DOCUMENTS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(cwd, JOL_TT_WORKER_REL);
}

export function ensureWorkerDocumentsDir(cwd = process.cwd()): string {
  const dir = workerDocumentsDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Public URL path for a newsletter month, served by /api/newsletters/[file]. */
export function newsletterPublicUrl(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    .toLowerCase();
  return `/newsletters/grade1-newsletter-${name}-${y}.pdf`;
}

/** Content Library item that looks like a monthly school newsletter (any month). */
export function isJolTimetableSourceCandidate(opts: {
  title?: string | null;
  subjectName?: string | null;
  resourceType?: string | null;
  downloadUrl?: string | null;
  sourceId?: string | null;
}): boolean {
  const blob = `${opts.title || ''} ${opts.subjectName || ''} ${opts.resourceType || ''}`.toLowerCase();
  const url = (opts.downloadUrl || '').toLowerCase();
  // Practice papers / answer keys are never the newsletter.
  if (/practice\s*paper|answer\s*key|revision\s*paper/.test(blob) && !/newsletter/.test(blob)) {
    return false;
  }
  if (/news\s*letter/.test(blob) || /newsletter/.test(url)) return true;
  if (/joy of learning|worksheet\s*[-–]?\s*i{1,3}\b/.test(blob) && /time\s*table/.test(blob)) return true;
  return false;
}

/** Cache newsletter bytes on the worker as newsletter-YYYY-MM.pdf (Neon holds the canonical copy). */
export function saveNewsletterPdfBytes(bytes: Buffer, monthKey: string, cwd = process.cwd()): string {
  const dest = path.join(ensureWorkerDocumentsDir(cwd), `newsletter-${monthKey}.pdf`);
  fs.writeFileSync(dest, bytes);
  return dest;
}

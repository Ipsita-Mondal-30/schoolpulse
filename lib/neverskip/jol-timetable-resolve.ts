/**
 * Resolve Joy of Learning Worksheet II timetable PDF on the worker host.
 * Prefer authenticated downloads / worker document cache over gitignored public/newsletters.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { nsLog, nsWarn } from './log';

export const JOL_TT_WORKER_REL = 'deploy/neverskip-worker/neverskip-data/documents';
export const JOL_TT_PUBLIC_REL = 'public/newsletters/grade1-newsletter-september-2026.pdf';
export const JOL_TT_FILENAME = 'grade1-newsletter-september-2026.pdf';
export const JOL_TT_CATALOG_SOURCE_ID = 'cl-nl-sep-2026';

/** Known SHA-256 of the September 2026 Grade 1 newsletter that contains JoL II timetable. */
export const KNOWN_SEP_2026_NEWSLETTER_HASH =
  '8919669d4c9e4869a8d25f64bd51fc9eaf367efd3f53e428df3d720b5e865e40';

export function isKnownSep2026NewsletterHash(hash: string): boolean {
  return hash === KNOWN_SEP_2026_NEWSLETTER_HASH;
}

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

/** Candidate PDF paths in priority order (first existing wins). */
export function resolveJolTimetablePdfCandidates(cwd = process.cwd()): string[] {
  const envPath = process.env.NEVERSKIP_JOL_TT_PDF?.trim();
  const workerPdf = path.join(workerDocumentsDir(cwd), JOL_TT_FILENAME);
  const publicPdf = path.resolve(cwd, JOL_TT_PUBLIC_REL);
  const out: string[] = [];
  if (envPath) out.push(path.resolve(envPath));
  out.push(workerPdf, publicPdf);
  return out;
}

export function resolveExistingJolTimetablePdf(cwd = process.cwd()): string | null {
  for (const p of resolveJolTimetablePdfCandidates(cwd)) {
    if (!fs.existsSync(p)) continue;
    try {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      if (!isKnownSep2026NewsletterHash(hash)) {
        nsWarn(
          `JOL timetable candidate at ${p} hash ${hash.slice(0, 12)}… is not the known Sep 2026 newsletter — skipping`,
        );
        continue;
      }
    } catch {
      continue;
    }
    nsLog(`JOL timetable PDF found: ${p}`);
    return p;
  }
  nsWarn('JOL timetable PDF not found in worker documents, env path, or public/newsletters');
  return null;
}

export function isJolTimetableSourceCandidate(opts: {
  title?: string | null;
  subjectName?: string | null;
  resourceType?: string | null;
  downloadUrl?: string | null;
  sourceId?: string | null;
}): boolean {
  if (opts.sourceId && String(opts.sourceId).includes('nl-sep-2026')) return true;
  const blob = `${opts.title || ''} ${opts.subjectName || ''} ${opts.resourceType || ''}`.toLowerCase();
  // Practice papers / answer keys are not the newsletter timetable source.
  if (/practice\s*paper|answer\s*key|revision\s*paper|worksheet\s*[-–]?\s*ii.*,/.test(blob) && !/newsletter|timetable|time\s*table/.test(blob)) {
    return false;
  }
  if (/practice\s*paper|answer\s*key/.test(blob) && !/newsletter/.test(blob)) {
    return false;
  }
  if (/newsletter/.test(blob) && /september|sep[-\s]?2026|grade\s*1|class\s*i\b/.test(blob)) {
    return true;
  }
  if (/joy of learning/.test(blob) && /timetable|time\s*table/.test(blob)) {
    return true;
  }
  if (/worksheet\s*[-–]?\s*ii/.test(blob) && /timetable|time\s*table/.test(blob)) return true;
  const url = (opts.downloadUrl || '').toLowerCase();
  if (/newsletter/i.test(url) && /sep|september|2026/i.test(url)) return true;
  return false;
}

/**
 * Persist known Sep 2026 newsletter bytes into the worker documents cache.
 * Unknown PDFs are written beside the cache — never overwrite the known filename.
 */
export function saveJolTimetablePdfBytes(
  bytes: Buffer,
  cwd = process.cwd(),
): string {
  const dir = ensureWorkerDocumentsDir(cwd);
  const dest = path.join(dir, JOL_TT_FILENAME);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!isKnownSep2026NewsletterHash(hash)) {
    const rejectPath = path.join(dir, `rejected-newsletter-${hash.slice(0, 12)}.pdf`);
    fs.writeFileSync(rejectPath, bytes);
    nsWarn(
      `JOL timetable candidate hash ${hash.slice(0, 12)}… is not the known Sep 2026 newsletter — saved as ${path.basename(rejectPath)}; not overwriting ${JOL_TT_FILENAME}`,
    );
    return dest;
  }
  fs.writeFileSync(dest, bytes);
  nsLog(`JOL timetable PDF saved (${bytes.length} bytes) → ${dest}`);
  return dest;
}

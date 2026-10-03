#!/usr/bin/env tsx
/**
 * One-time / manual newsletter backfill: same extract → validate → Neon path as the worker.
 * Usage: npx tsx scripts/ingest-newsletter.ts --file public/newsletters/grade1-newsletter-september-2026.pdf [--source-id cl-nl-sep-2026]
 * Requires DATABASE_URL and GOOGLE_GENERATIVE_AI_API_KEY. Never prints secrets.
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import { getPrisma } from '../lib/prisma';
import { ingestNewsletterPdf } from '../lib/newsletter/ingest';
import { extractNewsletterWithGemini } from '../lib/newsletter/extract';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const file = arg('--file');
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npx tsx scripts/ingest-newsletter.ts --file <pdf> [--source-id <id>]');
    return 1;
  }
  const result = await ingestNewsletterPdf(
    { bytes: fs.readFileSync(file), sourceId: arg('--source-id') ?? null },
    { db: getPrisma(), extract: extractNewsletterWithGemini },
  );
  console.log(
    `Newsletter ingest: status=${result.status} month=${result.monthKey ?? '?'} jolDays=${result.dayCount ?? 0}`,
  );
  for (const e of result.errors) console.log(`  error: ${e}`);
  if (result.status === 'APPLIED') {
    const { invalidateSchoolPulseCaches } = await import('../lib/cache/schoolpulse');
    await invalidateSchoolPulseCaches('newsletter-ingest').catch(() => undefined);
  }
  return result.status === 'FAILED' ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect().catch(() => undefined));

#!/usr/bin/env tsx
/**
 * Live Gemini check against the September 2026 acceptance fixture. Read-only (no DB writes).
 * Usage: npx tsx scripts/verify-newsletter-extraction.ts --file public/newsletters/grade1-newsletter-september-2026.pdf
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import fixture from '../tests/fixtures/newsletter-sep-2026-jol.json';
import { extractNewsletterWithGemini, newsletterModelId } from '../lib/newsletter/extract';
import { monthKeyFor, validateNewsletterExtraction } from '../lib/newsletter/validate';

async function main(): Promise<number> {
  const i = process.argv.indexOf('--file');
  const file = i >= 0 ? process.argv[i + 1] : undefined;
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npx tsx scripts/verify-newsletter-extraction.ts --file <pdf>');
    return 1;
  }
  console.log(`Model: ${newsletterModelId()}`);
  const x = await extractNewsletterWithGemini(fs.readFileSync(file));
  const errors = validateNewsletterExtraction(x);
  console.log(`Month: ${monthKeyFor(x)} planner subjects=${x.monthlyPlanner.length} dates=${x.importantDates.length} jolDays=${x.jolTimetable?.days.length ?? 0}`);
  for (const e of errors) console.log(`  validation: ${e}`);

  if (monthKeyFor(x) !== fixture.monthKey) {
    console.log(`Not the fixture month (${fixture.monthKey}); skipping JoL comparison.`);
    return errors.length ? 1 : 0;
  }
  const got = new Map((x.jolTimetable?.days ?? []).map((d) => [d.date, d]));
  let mismatches = 0;
  for (const want of fixture.days) {
    const d = got.get(want.date);
    const ok = d && d.classI === want.classI && d.classII === want.classII && d.weekday === want.weekday;
    if (!ok) mismatches += 1;
    console.log(`${ok ? 'OK  ' : 'DIFF'} ${want.date} expected ${want.classI}/${want.classII} got ${d ? `${d.classI}/${d.classII}` : '(missing)'}`);
  }
  if (got.size !== fixture.days.length) {
    console.log(`Row count ${got.size} != expected ${fixture.days.length}`);
    mismatches += 1;
  }
  console.log(mismatches || errors.length ? 'RESULT: MISMATCH' : 'RESULT: MATCH');
  return mismatches || errors.length ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });

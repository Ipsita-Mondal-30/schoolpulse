/**
 * Read-only NeverSkip module audit: opens each parent-portal module with the saved
 * session and records which API endpoints it calls, item counts, key names and the
 * newest date seen. Writes nothing to the database; never prints values or tokens.
 *
 * Run on the worker (takes the sync lock):
 *   flock -n deploy/neverskip-worker/neverskip-data/sync.lock xvfb-run -a npm run --silent neverskip:discover-modules
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  DEFAULT_PORTAL_BASE,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import {
  PORTAL_MODULES,
  SYNCED_MODULES,
  requestBodyKeys,
  summarizePortalResponse,
  type PortalModule,
  type ResponseSummary,
} from '../lib/neverskip/module-discovery';

type Capture = { module: PortalModule; method: string; path: string; status: number; bodyKeys: string[] } & ResponseSummary;

async function main(): Promise<number> {
  const profileDir = resolveNeverSkipProfileDir();
  if (!neverSkipProfileExists(profileDir)) {
    console.log(`MODULE DISCOVERY: PROFILE_MISSING (${profileDir})`);
    return 3;
  }
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const captures: Capture[] = [];
  const domHints: Record<string, { pdfLinks: number; newsletterLinks: number }> = {};
  let current: PortalModule = PORTAL_MODULES[0];

  page.on('response', async (response) => {
    const url = response.url();
    if (!/nskapi\.neverskip\.com/i.test(url)) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return;
      captures.push({
        module: current,
        method: response.request().method(),
        path: new URL(url).pathname,
        status: response.status(),
        bodyKeys: requestBodyKeys(response.request().postData()),
        ...summarizePortalResponse(JSON.parse(text)),
      });
    } catch {
      // non-JSON or body unavailable
    }
  });

  try {
    for (const mod of PORTAL_MODULES) {
      current = mod;
      await page.goto(`${DEFAULT_PORTAL_BASE}/default/${mod}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(2500);
      if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
        console.log(`MODULE DISCOVERY: AUTHENTICATION_REQUIRED (landed on ${new URL(page.url()).pathname} for ${mod})`);
        return 3;
      }
      domHints[mod] = await page.$$eval('a[href]', (as) => {
        const hrefs = as.map((a) => `${(a as HTMLAnchorElement).href} ${(a.textContent || '').trim()}`);
        return {
          pdfLinks: hrefs.filter((h) => /\.pdf\b/i.test(h)).length,
          newsletterLinks: hrefs.filter((h) => /news\s*letter/i.test(h)).length,
        };
      });
    }
  } finally {
    await context.close();
  }

  console.log(`Profile: ${profileDir}`);
  for (const mod of PORTAL_MODULES) {
    const rows = captures.filter((c) => c.module === mod && c.largestListLength > 0);
    const synced = SYNCED_MODULES[mod] ? `synced → ${SYNCED_MODULES[mod]}` : 'NOT synced by SchoolPulse';
    console.log(`\n== ${mod} (${synced}) dom: pdfLinks=${domHints[mod]?.pdfLinks ?? 0} newsletterLinks=${domHints[mod]?.newsletterLinks ?? 0}`);
    if (rows.length === 0) console.log('   (no list data returned by the API on this page)');
    for (const c of rows) {
      console.log(
        `   ${c.method} ${c.path} status=${c.status} items=${c.largestListLength} newest=${c.newestDate ?? '-'} ` +
          `pdf=${c.pdfLinks} newsletter=${c.newsletterMentions} paging=[${c.paginationKeys.join(',')}] body=[${c.bodyKeys.join(',')}]`,
      );
      console.log(`      item keys: ${c.itemKeys.join(',')}`);
    }
  }

  const outPath = path.join(process.cwd(), 'deploy/neverskip-worker/neverskip-data/module-discovery.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ capturedAt: new Date().toISOString(), captures, domHints }, null, 2));
  console.log(`\nMODULE DISCOVERY: DONE (details: ${outPath})`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`MODULE DISCOVERY: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });

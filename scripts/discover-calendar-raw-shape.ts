import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import * as browser from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  const profileDir = browser.resolveNeverSkipProfileDir(
    process.env.NEVERSKIP_PROFILE_DIR || browser.DEFAULT_PROFILE_DIR,
  );
  if (!browser.neverSkipProfileExists(profileDir)) {
    nsError('No profile');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const dumps: Array<Record<string, unknown>> = [];

  page.on('request', (req) => {
    if (!req.url().includes('fetchcalenderapi')) return;
    const p = req.postData() || '';
    dumps.push({
      kind: 'request',
      method: req.method(),
      contentType: req.headers()['content-type'] || null,
      postDataLen: p.length,
      postDataPreview: /token|password|cookie/i.test(p) ? '[redacted]' : p.slice(0, 500),
    });
  });

  page.on('response', async (response) => {
    if (!response.url().includes('fetchcalenderapi')) return;
    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    const D = parsed?.D;
    dumps.push({
      kind: 'response',
      status: response.status(),
      textLen: text.length,
      topKeys: parsed ? Object.keys(parsed) : [],
      S: parsed?.S ?? null,
      F: parsed?.F ?? null,
      Dtype: D === null ? 'null' : Array.isArray(D) ? `array:${D.length}` : typeof D,
      Dkeys: D && typeof D === 'object' && !Array.isArray(D) ? Object.keys(D as object) : [],
      Dpreview:
        typeof D === 'string'
          ? D.slice(0, 400)
          : D && typeof D === 'object'
            ? JSON.stringify(D).slice(0, 1200)
            : String(D),
    });
    nsLog(`cal response Dtype=${dumps[dumps.length - 1].Dtype} len=${text.length}`);
  });

  await page.goto('https://parent.neverskip.com/default/calendar', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(8000);
  nsLog(
    `session=${browser.assessSessionUrl(page.url(), { expectAppRoute: true })} path=${new URL(page.url()).pathname}`,
  );

  await context.close();
  const out = path.join(process.cwd(), 'lib/neverskip/calendar-api-raw-shape.json');
  fs.writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), dumps }, null, 2));
  nsLog(`Wrote ${out}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

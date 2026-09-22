/**
 * Search NeverSkip Content Library + notices for Joy of Learning II timetable.
 * Safe logging only — no tokens.
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import * as browser from '../lib/neverskip/browser';
import { buildContentLibPayload, JOL_CONTENT_LIBRARY_PATH } from '../lib/neverskip/jol';
import { nsError, nsLog } from '../lib/neverskip/log';

const MARKERS = [
  '30 September',
  '30-Sep',
  '30/09',
  '2026-09-30',
  '1 October',
  'Study Holiday',
  'Joy of Learning II',
  'Joy of Learning  II',
  'WORKSHEET – II TIMETABLE',
  'Worksheet II Timetable',
  'Timetable',
  '2026-27',
];

function blobMatches(text: string): string[] {
  const lower = text.toLowerCase();
  return MARKERS.filter((m) => lower.includes(m.toLowerCase()));
}

async function main() {
  const profileDir = browser.resolveNeverSkipProfileDir(
    process.env.NEVERSKIP_PROFILE_DIR || browser.DEFAULT_PROFILE_DIR,
  );
  if (!browser.neverSkipProfileExists(profileDir)) {
    nsError('No profile — run neverskip:login');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const hits: Array<Record<string, unknown>> = [];
  const allTitles: string[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (!/nskapi\.neverskip\.com\/parentweb\//i.test(url)) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{')) return;
      const json = JSON.parse(text) as Record<string, unknown>;
      const matched = blobMatches(text);
      if (matched.length) {
        hits.push({
          path: new URL(url).pathname,
          status: response.status(),
          matched,
          preview: text.slice(0, 400).replace(/token|password|cookie/gi, '[redacted]'),
        });
        nsLog(`HIT ${new URL(url).pathname} markers=${matched.join(',')}`);
      }
      // collect content lib titles
      const D = json.D && typeof json.D === 'object' ? (json.D as Record<string, unknown>) : null;
      const list = Array.isArray(D?.item_list) ? (D!.item_list as Array<Record<string, unknown>>) : [];
      for (const item of list) {
        const title = String(item.con_tit ?? item.title ?? '');
        if (title) allTitles.push(title);
        const itemBlob = JSON.stringify(item);
        const m = blobMatches(itemBlob);
        if (m.length) {
          hits.push({
            kind: 'content-item',
            title,
            matched: m,
            sch_dt: item.sch_dt,
            media: item.media,
            refid: item.refid,
          });
          nsLog(`ITEM HIT title=${title.slice(0, 80)} markers=${m.join(',')}`);
        }
      }
    } catch {
      /* ignore */
    }
  });

  // Warm + paginate content library via session
  await page.goto('https://parent.neverskip.com/default/content-library', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(4000);
  if (browser.looksLikeLoginUrl(page.url())) {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  // Search UI
  for (const q of ['timetable', 'Joy of Learning', 'newsletter', 'Worksheet II', '2026-27']) {
    try {
      const input = page.locator('input').first();
      if (await input.count()) {
        await input.fill(q);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);
        nsLog(`searched UI for ${q}`);
      }
    } catch {
      /* ignore */
    }
  }

  // Paginate all contentlib pages via request
  const api = `https://nskapi.neverskip.com${JOL_CONTENT_LIBRARY_PATH}`;
  let pageCount = 20;
  for (let i = 0; i < pageCount; i++) {
    const res = await context.request.post(api, {
      data: buildContentLibPayload(i),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 60_000,
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) break;
    const json = JSON.parse(text) as Record<string, unknown>;
    if (json.S === false) {
      nsLog(`page ${i} S:false`);
      break;
    }
    const D = json.D && typeof json.D === 'object' ? (json.D as Record<string, unknown>) : null;
    if (typeof D?.page_count === 'number') pageCount = Math.min(D.page_count as number, 50);
    const list = Array.isArray(D?.item_list) ? (D!.item_list as Array<Record<string, unknown>>) : [];
    nsLog(`contentlib page ${i} items=${list.length}`);
    if (!list.length) break;
    for (const item of list) {
      const title = String(item.con_tit ?? '');
      allTitles.push(title);
      const m = blobMatches(JSON.stringify(item));
      if (m.length || /timetable|newsletter|joy of learning ii|worksheet\s*[-–]?\s*ii\s*timetable/i.test(title)) {
        hits.push({
          kind: 'paged-item',
          title,
          matched: m,
          sch_dt: item.sch_dt,
          refid: item.refid,
          mediaTypes: Array.isArray(item.media)
            ? (item.media as Array<Record<string, unknown>>).map((x) => x.media_type)
            : [],
          dwn: Array.isArray(item.media)
            ? (item.media as Array<Record<string, unknown>>).map((x) => String(x.dwn_url ?? x.media_url ?? '').slice(0, 120))
            : [],
        });
        nsLog(`PAGED HIT ${title}`);
      }
    }
  }

  // Notices page
  await page.goto('https://parent.neverskip.com/default/dailynotice', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);

  // Calendar
  await page.goto('https://parent.neverskip.com/default/calendar', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(4000);

  await context.close();

  const out = {
    capturedAt: new Date().toISOString(),
    uniqueTitles: [...new Set(allTitles)].sort(),
    titleCount: [...new Set(allTitles)].length,
    timetableLikeTitles: [...new Set(allTitles)].filter((t) =>
      /timetable|newsletter|schedule|joy of learning ii/i.test(t),
    ),
    hits,
  };
  const outPath = path.join(process.cwd(), 'lib/neverskip/jol2-timetable-search.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  nsLog(`Wrote ${outPath} titles=${out.titleCount} hits=${hits.length}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

/**
 * Read-only diagnostic: opens the Daily Notice and Lounge pages with the saved session
 * and saves the raw JSON responses (no request bodies, headers or cookies) under
 * neverskip-data/raw/ for parser development. Writes nothing to the database.
 *
 *   NEVERSKIP_HEADLESS=false npx tsx scripts/capture-neverskip-raw.ts
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  DEFAULT_PORTAL_BASE,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';

/** Override with NEVERSKIP_RAW_MODULES=class-diary,assignment to inspect homework paging. */
const MODULES = (process.env.NEVERSKIP_RAW_MODULES || 'dailynotice,lounge')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const ENDPOINT_RE = /\/parentweb\/(?:connect|lms)\/(fetchdailynoticeinfo|fetchloungeinfo|getassignmentsapi)/i;
const PAGING_FIELDS = ['page', 'filter_date', 'pg_key', 'limt', 'limit', 'sub_id', 'assignment_date', 'works'];

async function main(): Promise<number> {
  const profileDir = resolveNeverSkipProfileDir();
  if (!neverSkipProfileExists(profileDir)) {
    console.log(`RAW CAPTURE: PROFILE_MISSING (${profileDir})`);
    return 3;
  }
  const outDir = path.join(process.cwd(), 'deploy/neverskip-worker/neverskip-data/raw');
  fs.mkdirSync(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  let n = 0;
  page.on('request', (request) => {
    const m = request.url().match(ENDPOINT_RE);
    if (!m || request.method() !== 'POST') return;
    try {
      const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
      const paging = PAGING_FIELDS.filter((k) => k in body)
        .map((k) => `${k}=${JSON.stringify(body[k])}`)
        .join(' ');
      console.log(`request ${m[1]} ${paging} keys=${Object.keys(body).join(',')}`);
    } catch {
      console.log(`request ${m[1]} (non-JSON body)`);
    }
  });
  page.on('response', async (response) => {
    const m = response.url().match(ENDPOINT_RE);
    if (!m) return;
    try {
      const text = await response.text();
      n += 1;
      const file = path.join(outDir, `${m[1]}-${n}.json`);
      fs.writeFileSync(file, text);
      let shape = '';
      try {
        const d = (JSON.parse(text) as { D?: unknown }).D;
        if (d && typeof d === 'object' && !Array.isArray(d)) {
          const o = d as Record<string, unknown>;
          const list = Array.isArray(o.item_list) ? o.item_list.length : '-';
          shape = ` D.keys=${Object.keys(o).join(',')} items=${list} page_count=${JSON.stringify(o.page_count)} total_count=${JSON.stringify(o.total_count)}`;
        } else if (Array.isArray(d)) shape = ` D=array(${d.length})`;
      } catch {
        shape = ` non-JSON prefix=${JSON.stringify(text.slice(0, 20))}`;
      }
      console.log(`saved ${path.basename(file)} (${text.length} bytes)${shape}`);
    } catch {
      // body unavailable
    }
  });

  try {
    for (const mod of MODULES) {
      await page.goto(`${DEFAULT_PORTAL_BASE}/default/${mod}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      if (looksLikeLoginUrl(page.url())) {
        console.log(`RAW CAPTURE: AUTHENTICATION_REQUIRED (${mod})`);
        return 3;
      }
      console.log(`module ${mod} landed path=${new URL(page.url()).pathname}`);
      for (let i = 0; i < 2; i += 1) {
        const next = page.getByText(/^\s*(Next|Load more|View more|Show more)\b/i).first();
        if (await next.isVisible().catch(() => false)) {
          await next.click();
        } else {
          await page.mouse.wheel(0, 20_000);
        }
        await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(2500);
      }
    }
  } finally {
    await context.close();
  }
  console.log(`RAW CAPTURE: DONE files=${n} dir=${outDir}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);

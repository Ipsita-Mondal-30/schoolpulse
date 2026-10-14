/**
 * Capture the EXACT NeverSkip portal Daily Notice XHR (fetchdailynoticeinfo).
 * Does not invent payloads — only records what the SPA posts.
 *
 * Usage:
 *   NEVERSKIP_PROFILE_DIR=.playwright-profile NEVERSKIP_HEADLESS=false \
 *     npx tsx scripts/discover-neverskip-notices-api.ts
 *
 * Never logs Token / cookies / Authorization values.
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  DEFAULT_PROFILE_DIR,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { NOTICES_PATH, parseNoticesPortalBody } from '../lib/neverskip/notices';
import { nsError, nsLog, nsWarn } from '../lib/neverskip/log';
import { extractNotices } from '../lib/neverskip/normalizers';
import type { NeverSkipNoticesResponse } from '../lib/neverskip/types';

const OUT_JSON = path.join(process.cwd(), 'lib/neverskip/notices-api-discovery.json');

type Captured = {
  seq: number;
  method: string;
  bodyKeys: string[];
  body: Record<string, unknown> | null;
  status: number;
  itemCount: number;
  pageCount: number | null;
  totalCount: number | null;
  sfileLimit: number | null;
  newestDate: string;
  sampleDates: string[];
};

function isNoticesApi(url: string): boolean {
  return url.includes(NOTICES_PATH) || /fetchdailynoticeinfo/i.test(url);
}

function toFiniteInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

async function main() {
  const profileDir = resolveNeverSkipProfileDir() || DEFAULT_PROFILE_DIR;
  if (!neverSkipProfileExists(profileDir)) {
    nsError(`Profile missing: ${profileDir}. Run npm run neverskip:login first.`);
    process.exit(1);
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  const portal = process.env.NEVERSKIP_PORTAL_URL?.trim() || 'https://parent.neverskip.com';
  const noticesUrl =
    process.env.NEVERSKIP_NOTICES_PAGE_URL?.trim() || `${portal}/default/dailynotice`;

  const captures: Captured[] = [];
  let seq = 0;

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || (await context.newPage());

  page.on('request', (req) => {
    if (!isNoticesApi(req.url()) || req.method() !== 'POST') return;
    // Body logged only after response so we can pair — store pending by seq below via response.
  });

  page.on('response', async (res) => {
    if (!isNoticesApi(res.url())) return;
    const req = res.request();
    if (req.method() !== 'POST') return;
    seq += 1;
    let body: Record<string, unknown> | null = null;
    const raw = req.postData();
    try {
      body = raw?.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = null;
    }
    let json: NeverSkipNoticesResponse | null = null;
    try {
      json = (await res.json()) as NeverSkipNoticesResponse;
    } catch {
      nsWarn(`Notice response non-JSON status=${res.status()} len preview skipped`);
    }
    const items = json ? extractNotices(json) : [];
    const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
    const D =
      root?.D && typeof root.D === 'object' && !Array.isArray(root.D)
        ? (root.D as Record<string, unknown>)
        : null;
    let newestDate = '';
    const sampleDates: string[] = [];
    for (const item of items) {
      const d = String(item.date ?? '').trim();
      if (d) {
        sampleDates.push(d);
        if (d > newestDate) newestDate = d;
      }
    }
    captures.push({
      seq,
      method: req.method(),
      bodyKeys: body ? Object.keys(body) : [],
      body,
      status: res.status(),
      itemCount: items.length,
      pageCount: toFiniteInt(D?.page_count ?? root?.page_count),
      totalCount: toFiniteInt(D?.total_count ?? root?.total_count),
      sfileLimit: toFiniteInt(D?.sfile_limit ?? root?.sfile_limit),
      newestDate,
      sampleDates: sampleDates.slice(0, 8),
    });
    nsLog(
      `Captured notice XHR #${seq} status=${res.status()} keys=${body ? Object.keys(body).join(',') || '(empty)' : 'null'} items=${items.length} newest=${newestDate || '(none)'} total=${toFiniteInt(D?.total_count ?? root?.total_count) ?? 'null'}`,
    );
  });

  await page.goto(noticesUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);

  if (looksLikeLoginUrl(page.url())) {
    nsError('Session expired — landed on login. Re-run npm run neverskip:login.');
    await context.close();
    process.exit(1);
  }

  // Try clicking Next / pagination if present (do not invent clicks that aren't there).
  const next = page.getByRole('button', { name: /next|>/i }).first();
  if (await next.isVisible().catch(() => false)) {
    nsLog('Clicking Next pagination control');
    await next.click().catch(() => undefined);
    await page.waitForTimeout(3000);
  }

  await page.waitForTimeout(2000);
  await context.close();

  const template = captures[0]?.body != null ? parseNoticesPortalBody(captures[0].body) : null;
  const out = {
    capturedAt: new Date().toISOString(),
    captures,
    parsedTemplate: template,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  nsLog(`Wrote ${OUT_JSON} (${captures.length} capture(s))`);
  if (captures.length === 0) {
    nsWarn('No fetchdailynoticeinfo XHR captured — check session / page URL');
    process.exit(2);
  }
}

main().catch((err) => {
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

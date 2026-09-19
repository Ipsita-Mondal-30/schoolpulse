/**
 * Safe NeverSkip JOL / Content Library discovery.
 * Captures XHR URL paths + envelope keys only — never tokens/cookies/bodies with secrets.
 *
 * Usage:
 *   NEVERSKIP_PROFILE_DIR=.playwright-profile NEVERSKIP_HEADLESS=false \
 *     npx tsx scripts/discover-neverskip-jol.ts
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium, type Response } from 'playwright';
import {
  DEFAULT_PORTAL_BASE,
  DEFAULT_PROFILE_DIR,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

const CONTENT_LIBRARY_PAGE =
  process.env.NEVERSKIP_CONTENT_LIBRARY_URL ||
  `${DEFAULT_PORTAL_BASE}/default/content-library`;

type SafeCapture = {
  urlPath: string;
  method: string;
  status: number;
  topKeys: string[];
  dKeys: string[];
  itemListLength: number | null;
  sampleItemKeys: string[];
  dateLikeFields: string[];
  urlLikeFields: string[];
};

function safeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split('?')[0] || url;
  }
}

function collectKeys(obj: unknown, prefix = '', depth = 0, out: string[] = []): string[] {
  if (depth > 2 || !obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    if (obj[0]) collectKeys(obj[0], `${prefix}[]`, depth + 1, out);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push(p);
    if (v && typeof v === 'object') collectKeys(v, p, depth + 1, out);
  }
  return out;
}

function findFieldsByHint(obj: unknown, hint: RegExp, prefix = '', depth = 0, out: string[] = []): string[] {
  if (depth > 3 || !obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    if (obj[0]) findFieldsByHint(obj[0], hint, `${prefix}[]`, depth + 1, out);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (hint.test(k)) out.push(p);
    if (v && typeof v === 'object') findFieldsByHint(v, hint, p, depth + 1, out);
  }
  return out;
}

async function inspectResponse(response: Response): Promise<SafeCapture | null> {
  const url = response.url();
  if (!/neverskip|nskapi/i.test(url)) return null;
  if (/\.(png|jpg|jpeg|gif|svg|woff2?|css|js)(\?|$)/i.test(url)) return null;

  let body: unknown = null;
  try {
    const text = await response.text();
    if (!text.trim() || (text[0] !== '{' && text[0] !== '[')) return null;
    body = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  const root = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const D =
    root?.D && typeof root.D === 'object' && !Array.isArray(root.D)
      ? (root.D as Record<string, unknown>)
      : null;
  let itemListLength: number | null = null;
  let sampleItemKeys: string[] = [];
  if (D && Array.isArray(D.item_list)) {
    itemListLength = D.item_list.length;
    const first = D.item_list[0];
    if (first && typeof first === 'object') sampleItemKeys = Object.keys(first as object);
  } else if (Array.isArray(root?.data)) {
    itemListLength = (root!.data as unknown[]).length;
    const first = (root!.data as unknown[])[0];
    if (first && typeof first === 'object') sampleItemKeys = Object.keys(first as object);
  }

  return {
    urlPath: safeUrlPath(url),
    method: response.request().method(),
    status: response.status(),
    topKeys: root ? Object.keys(root) : Array.isArray(body) ? ['(array)'] : [],
    dKeys: D ? Object.keys(D) : [],
    itemListLength,
    sampleItemKeys,
    dateLikeFields: findFieldsByHint(body, /date|dt|time|day/i).slice(0, 20),
    urlLikeFields: findFieldsByHint(body, /url|file|pdf|img|image|download|link|media|path/i).slice(0, 20),
  };
}

async function main() {
  const profileDir = resolveNeverSkipProfileDir(process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No Playwright profile — run npm run neverskip:login first');
    process.exit(1);
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  nsLog(`JOL discovery start profile=${path.basename(profileDir)} headless=${headless}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1280, height: 800 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const captures: SafeCapture[] = [];
  const seen = new Set<string>();

  page.on('response', (response) => {
    void inspectResponse(response).then((cap) => {
      if (!cap) return;
      const key = `${cap.method} ${cap.urlPath} ${cap.status}`;
      if (seen.has(key)) return;
      seen.add(key);
      captures.push(cap);
      nsLog(`CAPTURE ${cap.method} ${cap.urlPath} status=${cap.status} items=${cap.itemListLength ?? 'n/a'}`);
      if (cap.sampleItemKeys.length) nsLog(`  itemKeys=${cap.sampleItemKeys.join(',')}`);
      if (cap.dKeys.length) nsLog(`  DKeys=${cap.dKeys.join(',')}`);
    });
  });

  const pagesToVisit = [
    CONTENT_LIBRARY_PAGE,
    `${DEFAULT_PORTAL_BASE}/default/dailynotice`,
    `${DEFAULT_PORTAL_BASE}/default/assignment`,
    `${DEFAULT_PORTAL_BASE}/default/planner`,
    `${DEFAULT_PORTAL_BASE}/default/calendar`,
  ];

  for (const url of pagesToVisit) {
    nsLog(`Opening ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(4000);
      const assessment = assessSessionUrl(page.url(), { expectAppRoute: true });
      nsLog(`path=${new URL(page.url()).pathname} session=${assessment}`);
      if (looksLikeLoginUrl(page.url()) || assessment === 'login') {
        nsError('AUTHENTICATION_REQUIRED — session expired during discovery');
        await context.close();
        process.exit(1);
      }
      // Soft click first few interactive tiles if present (no secrets).
      const clickables = page.locator('a, button, [role="button"]').filter({ hasText: /joy|jol|library|resource|print/i });
      const n = Math.min(await clickables.count(), 3);
      for (let i = 0; i < n; i++) {
        try {
          await clickables.nth(i).click({ timeout: 2000 });
          await page.waitForTimeout(1500);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      nsLog(`page visit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await context.close();

  const outPath = path.join(process.cwd(), 'lib/neverskip/jol-discovery.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        pagesVisited: pagesToVisit,
        captures,
      },
      null,
      2,
    ),
  );
  nsLog(`Wrote safe discovery dump: ${outPath}`);
  nsLog(`Total unique API captures: ${captures.length}`);
}

main().catch((err) => {
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

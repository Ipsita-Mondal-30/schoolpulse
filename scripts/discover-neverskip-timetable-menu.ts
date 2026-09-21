/**
 * Capture NeverSkip parent menu labels + probe likely timetable routes.
 * Safe output only (labels/paths) — never tokens.
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  DEFAULT_PORTAL_BASE,
  DEFAULT_PROFILE_DIR,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

async function main() {
  const profileDir = resolveNeverSkipProfileDir(process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No Playwright profile — run npm run neverskip:login first');
    process.exit(1);
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  const menuPayloads: unknown[] = [];
  const navHrefs: string[] = [];
  const captures: Array<{ method: string; path: string; status: number; titles: string[] }> = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (!/nskapi\.neverskip\.com/i.test(url)) return;
    if (!/getppschmenupermission|fetchcontentlib|planner|calendar|timetable|schedule|diary/i.test(url)) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{')) return;
      const json = JSON.parse(text) as Record<string, unknown>;
      if (/getppschmenupermission/i.test(url)) menuPayloads.push(json.D ?? json);
      const titles: string[] = [];
      const walk = (n: unknown, d: number) => {
        if (d > 4 || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.slice(0, 30).forEach((x) => walk(x, d + 1));
        const o = n as Record<string, unknown>;
        for (const k of ['con_tit', 'title', 'name', 'label', 'menu_name', 'menuname', 'route', 'url', 'path']) {
          if (typeof o[k] === 'string') titles.push(String(o[k]).slice(0, 120));
        }
        Object.values(o).forEach((v) => walk(v, d + 1));
      };
      walk(json, 0);
      captures.push({
        method: response.request().method(),
        path: new URL(url).pathname,
        status: response.status(),
        titles: [...new Set(titles)].slice(0, 40),
      });
    } catch {
      /* ignore */
    }
  });

  nsLog('Opening content-library to load menu…');
  await page.goto(`${DEFAULT_PORTAL_BASE}/default/content-library`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);
  if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  // Collect sidebar / topnav hrefs from DOM
  const hrefs = await page.$$eval('a[href]', (as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || '').filter(Boolean),
  );
  for (const h of hrefs) {
    if (/default|planner|calendar|timetable|schedule|diary|library|notice|assign/i.test(h)) {
      navHrefs.push(h);
    }
  }

  const uniqueHrefs = [...new Set(navHrefs)].sort();
  nsLog(`Nav hrefs (${uniqueHrefs.length}): ${uniqueHrefs.slice(0, 40).join(' | ')}`);

  // Visit unique default/* routes from nav
  const candidates = uniqueHrefs
    .map((h) => {
      try {
        if (h.startsWith('http')) return h;
        if (h.startsWith('/')) return `${DEFAULT_PORTAL_BASE}${h}`;
        return `${DEFAULT_PORTAL_BASE}/${h.replace(/^\.\//, '')}`;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => Boolean(u && /parent\.neverskip\.com/i.test(u)));

  const extra = [
    `${DEFAULT_PORTAL_BASE}/default/planner`,
    `${DEFAULT_PORTAL_BASE}/default/calendar`,
    `${DEFAULT_PORTAL_BASE}/default/timetable`,
    `${DEFAULT_PORTAL_BASE}/default/mytimetable`,
    `${DEFAULT_PORTAL_BASE}/default/studenttimetable`,
    `${DEFAULT_PORTAL_BASE}/default/classtimetable`,
    `${DEFAULT_PORTAL_BASE}/default/time-table`,
  ];

  const toVisit = [...new Set([...candidates, ...extra])].slice(0, 40);
  const visitResults: Array<{ url: string; path: string; session: string; hints: string[] }> = [];

  for (const url of toVisit) {
    nsLog(`Visit ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(2500);
      const assessment = assessSessionUrl(page.url(), { expectAppRoute: true });
      if (looksLikeLoginUrl(page.url()) || assessment === 'login') {
        nsLog('session lost — stopping visits');
        visitResults.push({ url, path: new URL(page.url()).pathname, session: 'login', hints: [] });
        break;
      }
      const body = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
      const hints = ['timetable', 'schedule', 'planner', 'calendar', 'period', 'joy of learning', 'newsletter'].filter(
        (h) => body.includes(h),
      );
      visitResults.push({ url, path: new URL(page.url()).pathname, session: String(assessment), hints });
      nsLog(`  -> ${new URL(page.url()).pathname} hints=[${hints.join(',')}]`);
    } catch (err) {
      visitResults.push({
        url,
        path: '(error)',
        session: 'error',
        hints: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  await context.close();

  const out = {
    capturedAt: new Date().toISOString(),
    navHrefs: uniqueHrefs,
    visitResults,
    captures,
    menuPayloadsSafe: menuPayloads.map((m) => {
      // Strip any unexpected secrets; keep only keys/string labels
      const s = JSON.stringify(m);
      if (/token|password|cookie/i.test(s)) return { redacted: true, keys: Object.keys((m as object) || {}) };
      return m;
    }),
  };

  const outPath = path.join(process.cwd(), 'lib/neverskip/timetable-menu-discovery.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  nsLog(`Wrote ${outPath}`);
}

main().catch((err) => {
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

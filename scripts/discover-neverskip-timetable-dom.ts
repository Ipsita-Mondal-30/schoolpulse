/**
 * Stay on authenticated Content Library; dump menu DOM text + permission API labels.
 * Click in-app menu items that mention timetable/planner/calendar/newsletter.
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
    nsError('No profile');
    process.exit(1);
  }
  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  const apiCaptures: Array<{ path: string; status: number; dKeys: string[]; labels: string[] }> = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (!/nskapi\.neverskip\.com\/parentweb\//i.test(url)) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{')) return;
      const json = JSON.parse(text) as Record<string, unknown>;
      const D =
        json.D && typeof json.D === 'object' && !Array.isArray(json.D)
          ? (json.D as Record<string, unknown>)
          : null;
      const labels: string[] = [];
      const walk = (n: unknown, d: number) => {
        if (d > 5 || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
        const o = n as Record<string, unknown>;
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'string' && /menu|label|name|title|route|path|url/i.test(k)) {
            labels.push(`${k}=${v.slice(0, 100)}`);
          }
        }
        Object.values(o).forEach((v) => walk(v, d + 1));
      };
      walk(json, 0);
      apiCaptures.push({
        path: new URL(url).pathname,
        status: response.status(),
        dKeys: D ? Object.keys(D) : Object.keys(json),
        labels: [...new Set(labels)].slice(0, 80),
      });
    } catch {
      /* ignore */
    }
  });

  nsLog('Goto content-library');
  await page.goto(`${DEFAULT_PORTAL_BASE}/default/content-library`, {
    waitUntil: 'networkidle',
    timeout: 90_000,
  });
  await page.waitForTimeout(4000);
  if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  const menuText = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('a, button, [role="menuitem"], li, .menu, nav *'));
    const texts: string[] = [];
    for (const n of nodes) {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 80 && t.length > 1) texts.push(t);
    }
    return [...new Set(texts)].slice(0, 200);
  });

  const interesting = menuText.filter((t) =>
    /time|table|plan|calendar|schedule|diary|library|notice|assign|joy|newsletter|class/i.test(t),
  );
  nsLog(`Interesting menu texts (${interesting.length}): ${interesting.slice(0, 50).join(' || ')}`);

  // Click interesting items that might open timetable without leaving app shell
  const clickTargets = interesting.filter((t) =>
    /timetable|time table|planner|calendar|schedule|newsletter|joy of learning/i.test(t),
  );
  const clickResults: Array<{ text: string; pathAfter: string; session: string }> = [];
  for (const text of clickTargets.slice(0, 12)) {
    try {
      const loc = page.getByText(text, { exact: true }).first();
      if ((await loc.count()) === 0) continue;
      await loc.click({ timeout: 2000 });
      await page.waitForTimeout(2500);
      const session = String(assessSessionUrl(page.url(), { expectAppRoute: true }));
      clickResults.push({ text, pathAfter: new URL(page.url()).pathname, session });
      nsLog(`Clicked "${text}" -> ${new URL(page.url()).pathname} session=${session}`);
      if (session === 'login' || looksLikeLoginUrl(page.url())) break;
      // return to content library if navigated away
      if (!page.url().includes('content-library')) {
        await page.goto(`${DEFAULT_PORTAL_BASE}/default/content-library`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        await page.waitForTimeout(2000);
      }
    } catch (err) {
      clickResults.push({
        text,
        pathAfter: '(error)',
        session: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Subject filter: try selecting NEWSLETTER-like subject if present in subject list
  try {
    const subjectHit = page.getByText(/newsletter|all/i).first();
    if (await subjectHit.count()) {
      await subjectHit.click({ timeout: 2000 });
      await page.waitForTimeout(3000);
    }
  } catch {
    /* ignore */
  }

  // Search box
  try {
    const input = page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]').first();
    if (await input.count()) {
      await input.fill('timetable');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      await input.fill('newsletter');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      await input.fill('Joy of Learning');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
  } catch {
    /* ignore */
  }

  // List visible card titles on content library
  const cardTitles = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('h1,h2,h3,h4,.title,.card-title,[class*="title"]'));
    return [...new Set(els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 3 && t.length < 160))].slice(0, 80);
  });

  await context.close();

  const outPath = path.join(process.cwd(), 'lib/neverskip/timetable-dom-discovery.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        interestingMenuTexts: interesting,
        clickResults,
        cardTitles,
        apiCaptures,
      },
      null,
      2,
    ),
  );
  nsLog(`Wrote ${outPath}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

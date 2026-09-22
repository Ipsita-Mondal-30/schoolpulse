/**
 * Force-open Calendar + Class Diary menus and capture XHR (safe keys/titles only).
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import {
  DEFAULT_PROFILE_DIR,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

const PORTAL = 'https://parent.neverskip.com';

async function main() {
  const profileDir = resolveNeverSkipProfileDir(process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No profile');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const captures: Array<Record<string, unknown>> = [];

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
      const titles: string[] = [];
      const walk = (n: unknown, d = 0) => {
        if (d > 4 || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.slice(0, 25).forEach((x) => walk(x, d + 1));
        const o = n as Record<string, unknown>;
        for (const k of ['con_tit', 'title', 'name', 'subject_name', 'assign_title', 'event', 'label', 'ntc_title']) {
          if (typeof o[k] === 'string') titles.push(String(o[k]).slice(0, 140));
        }
        Object.values(o).forEach((v) => walk(v, d + 1));
      };
      walk(json);
      captures.push({
        path: new URL(url).pathname,
        status: response.status(),
        dKeys: D ? Object.keys(D) : Object.keys(json),
        itemLen: Array.isArray(D?.item_list) ? D.item_list.length : null,
        titles: [...new Set(titles)].slice(0, 20),
        pageUrl: page.url(),
      });
      nsLog(`CAPTURE ${new URL(url).pathname} items=${Array.isArray(D?.item_list) ? D.item_list.length : 'n/a'}`);
    } catch {
      /* ignore */
    }
  });

  nsLog('Open home/content-library');
  await page.goto(`${PORTAL}/default/content-library`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);
  if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  // Expand Student menu if collapsed
  try {
    await page.getByText('Student', { exact: true }).first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch {
    /* ignore */
  }

  for (const label of ['Calendar', 'Class Diary', 'Daily notices', 'Content Library', 'Assignments']) {
    try {
      nsLog(`Force-click ${label}`);
      await page.locator('a.menunm', { hasText: label }).first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(5000);
      const assessment = assessSessionUrl(page.url(), { expectAppRoute: true });
      nsLog(`after ${label}: path=${new URL(page.url()).pathname} session=${assessment}`);
      if (looksLikeLoginUrl(page.url()) || assessment === 'login') {
        nsError('session lost');
        break;
      }
    } catch (err) {
      nsLog(`click ${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Direct calendar URL after warming session
  try {
    nsLog('Direct /default/calendar');
    await page.goto(`${PORTAL}/default/calendar`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5000);
    nsLog(`calendar path=${new URL(page.url()).pathname} session=${assessSessionUrl(page.url(), { expectAppRoute: true })}`);
  } catch (err) {
    nsLog(`calendar goto failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await context.close();
  const out = path.join(process.cwd(), 'lib/neverskip/timetable-calendar-discovery.json');
  fs.writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), captures }, null, 2));
  nsLog(`Wrote ${out} captures=${captures.length}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

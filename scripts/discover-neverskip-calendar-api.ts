/**
 * Capture safe structure of NeverSkip fetchcalenderapi (+ probe timetable-ish payloads).
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
const CAL_API = 'https://nskapi.neverskip.com/parentweb/lms/fetchcalenderapi';

function summarize(json: unknown): Record<string, unknown> {
  const root = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  const D =
    root?.D && typeof root.D === 'object' && !Array.isArray(root.D)
      ? (root.D as Record<string, unknown>)
      : null;
  const titles: string[] = [];
  const dateFields: string[] = [];
  const scheduleFields: string[] = [];
  let itemCount: number | null = null;
  let sampleKeys: string[] = [];
  let sampleRows: Array<Record<string, unknown>> = [];

  const walk = (n: unknown, prefix: string, d: number) => {
    if (d > 4 || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      if (itemCount == null && n.length) itemCount = n.length;
      if (!sampleKeys.length && n[0] && typeof n[0] === 'object') {
        sampleKeys = Object.keys(n[0] as object);
        sampleRows = (n as unknown[])
          .slice(0, 5)
          .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
          .map((row) => {
            const safe: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(row)) {
              if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v == null) {
                safe[k] = typeof v === 'string' ? v.slice(0, 160) : v;
              } else if (Array.isArray(v)) {
                safe[k] = `array(${v.length})`;
              } else if (typeof v === 'object') {
                safe[k] = `object(${Object.keys(v as object).join(',')})`;
              }
            }
            return safe;
          });
      }
      n.slice(0, 30).forEach((x, i) => walk(x, `${prefix}[${i}]`, d + 1));
      return;
    }
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (/date|dt|day|time|month|year|week/i.test(k)) dateFields.push(p);
      if (/timetable|schedule|period|subject|slot|class|event|title/i.test(k)) scheduleFields.push(p);
      if (
        typeof v === 'string' &&
        /title|name|subject|event|label|desc/i.test(k) &&
        v.trim()
      ) {
        titles.push(v.trim().slice(0, 140));
      }
      if (v && typeof v === 'object') walk(v, p, d + 1);
    }
  };
  walk(json, '', 0);

  return {
    topKeys: root ? Object.keys(root) : [],
    dKeys: D ? Object.keys(D) : [],
    S: root?.S ?? null,
    itemCount,
    sampleKeys,
    sampleRows,
    titles: [...new Set(titles)].slice(0, 30),
    dateFields: [...new Set(dateFields)].slice(0, 40),
    scheduleFields: [...new Set(scheduleFields)].slice(0, 40),
  };
}

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
  let interceptedBody: unknown = null;
  let interceptedPostData: string | null = null;

  page.on('request', (req) => {
    if (req.url().includes('fetchcalenderapi') && req.method() === 'POST') {
      interceptedPostData = req.postData();
    }
  });
  page.on('response', async (response) => {
    if (!response.url().includes('fetchcalenderapi')) return;
    try {
      interceptedBody = JSON.parse(await response.text());
      nsLog('Intercepted fetchcalenderapi response');
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${PORTAL}/default/calendar`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);
  if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  // Click month navigation a couple times to trigger more calendar fetches
  for (const label of ['Next', 'Previous', '>', '<', 'Today']) {
    try {
      const loc = page.getByText(label, { exact: true }).first();
      if (await loc.count()) {
        await loc.click({ timeout: 1500 });
        await page.waitForTimeout(2000);
      }
    } catch {
      /* ignore */
    }
  }

  const probes: Array<{ label: string; body: Record<string, unknown> }> = [
    { label: 'empty', body: {} },
    { label: 'month-now', body: { month: '9', year: '2026' } },
    { label: 'month-10', body: { month: '10', year: '2026' } },
    { label: 'values-cd', body: { values: '', page: '0', pg_key: 'CD', works: '', limit: 0 } },
  ];
  // If we intercepted post data, replay it and variants
  if (interceptedPostData) {
    try {
      const parsed = JSON.parse(interceptedPostData) as Record<string, unknown>;
      probes.unshift({ label: 'intercepted-payload', body: parsed });
      nsLog(`Intercepted payload keys: ${Object.keys(parsed).join(',')}`);
    } catch {
      nsLog('Intercepted postData was not JSON');
    }
  }

  const probeResults: Array<Record<string, unknown>> = [];
  for (const probe of probes) {
    try {
      const res = await context.request.post(CAL_API, {
        data: probe.body,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 60_000,
      });
      const text = await res.text();
      let summary: Record<string, unknown> = { status: res.status(), parseError: true };
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        summary = { status: res.status(), ...summarize(JSON.parse(text)) };
      } else {
        summary = { status: res.status(), nonJsonPrefix: text.slice(0, 40) };
      }
      probeResults.push({ label: probe.label, payloadKeys: Object.keys(probe.body), ...summary });
      nsLog(`PROBE ${probe.label} status=${res.status()} items=${summary.itemCount ?? 'n/a'} titles=${(summary.titles as string[] | undefined)?.length ?? 0}`);
    } catch (err) {
      probeResults.push({
        label: probe.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await context.close();

  const out = {
    capturedAt: new Date().toISOString(),
    api: CAL_API,
    interceptedPostDataKeys: interceptedPostData
      ? Object.keys(JSON.parse(interceptedPostData) as object)
      : [],
    // Do not store raw post body (may include tokens in some portals)
    interceptedSummary: interceptedBody ? summarize(interceptedBody) : null,
    probeResults,
  };

  const jsonPath = path.join(process.cwd(), 'lib/neverskip/calendar-api-discovery.json');
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  nsLog(`Wrote ${jsonPath}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

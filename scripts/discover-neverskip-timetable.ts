/**
 * Safe NeverSkip timetable / planner / calendar discovery.
 * Captures XHR paths + envelope keys only — never tokens/cookies/bodies with secrets.
 *
 * Usage:
 *   NEVERSKIP_PROFILE_DIR=.playwright-profile NEVERSKIP_HEADLESS=false \
 *     npx tsx scripts/discover-neverskip-timetable.ts
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium, type Page, type Response } from 'playwright';
import {
  DEFAULT_PORTAL_BASE,
  DEFAULT_PROFILE_DIR,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { nsError, nsLog } from '../lib/neverskip/log';

type SafeCapture = {
  urlPath: string;
  method: string;
  status: number;
  pageContext: string;
  topKeys: string[];
  dKeys: string[];
  itemListLength: number | null;
  sampleItemKeys: string[];
  sampleTitles: string[];
  dateLikeFields: string[];
  urlLikeFields: string[];
  scheduleLikeFields: string[];
};

type PageVisit = {
  url: string;
  finalPath: string;
  session: string;
  title: string;
  visibleTextHints: string[];
};

function safeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split('?')[0] || url;
  }
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

function extractSampleTitles(body: unknown): string[] {
  const titles: string[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 4 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 12)) visit(item, depth + 1);
      return;
    }
    const o = node as Record<string, unknown>;
    for (const key of ['con_tit', 'title', 'name', 'subject_name', 'assign_title', 'event_title', 'label']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) titles.push(v.trim().slice(0, 160));
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') visit(v, depth + 1);
    }
  };
  visit(body, 0);
  return [...new Set(titles)].slice(0, 20);
}

async function inspectResponse(
  response: Response,
  pageContext: string,
): Promise<SafeCapture | null> {
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
  } else if (D) {
    for (const key of ['list', 'rows', 'events', 'schedule', 'timetable', 'periods', 'days']) {
      const v = D[key];
      if (Array.isArray(v)) {
        itemListLength = v.length;
        if (v[0] && typeof v[0] === 'object') sampleItemKeys = Object.keys(v[0] as object);
        break;
      }
    }
  }

  return {
    urlPath: safeUrlPath(url),
    method: response.request().method(),
    status: response.status(),
    pageContext,
    topKeys: root ? Object.keys(root) : Array.isArray(body) ? ['(array)'] : [],
    dKeys: D ? Object.keys(D) : [],
    itemListLength,
    sampleItemKeys,
    sampleTitles: extractSampleTitles(body),
    dateLikeFields: findFieldsByHint(body, /date|dt|time|day|week|month/i).slice(0, 25),
    urlLikeFields: findFieldsByHint(body, /url|file|pdf|img|image|download|link|media|path/i).slice(0, 20),
    scheduleLikeFields: findFieldsByHint(
      body,
      /timetable|schedule|period|subject|slot|period|weekday|class_sec|cls_sec/i,
    ).slice(0, 25),
  };
}

async function softClickHints(page: Page, patterns: RegExp[]) {
  for (const re of patterns) {
    const clickables = page.locator('a, button, [role="button"], [role="tab"], label, span').filter({ hasText: re });
    const n = Math.min(await clickables.count(), 4);
    for (let i = 0; i < n; i++) {
      try {
        await clickables.nth(i).click({ timeout: 2000 });
        await page.waitForTimeout(1800);
      } catch {
        /* ignore */
      }
    }
  }
}

async function collectVisibleHints(page: Page): Promise<string[]> {
  const text = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  const hints = [
    'timetable',
    'time table',
    'schedule',
    'planner',
    'calendar',
    'joy of learning',
    'newsletter',
    'worksheet',
    'period',
    'class diary',
  ];
  return hints.filter((h) => text.includes(h));
}

async function main() {
  const profileDir = resolveNeverSkipProfileDir(process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No Playwright profile — run npm run neverskip:login first');
    process.exit(1);
  }

  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  nsLog(`Timetable discovery start profile=${path.basename(profileDir)} headless=${headless}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const captures: SafeCapture[] = [];
  const visits: PageVisit[] = [];
  let pageContext = 'boot';
  const seen = new Set<string>();

  page.on('response', (response) => {
    void inspectResponse(response, pageContext).then((cap) => {
      if (!cap) return;
      const key = `${cap.method} ${cap.urlPath} ${cap.status} ${cap.pageContext}`;
      if (seen.has(key)) return;
      seen.add(key);
      captures.push(cap);
      nsLog(
        `CAPTURE [${cap.pageContext}] ${cap.method} ${cap.urlPath} status=${cap.status} items=${cap.itemListLength ?? 'n/a'}`,
      );
      if (cap.sampleItemKeys.length) nsLog(`  itemKeys=${cap.sampleItemKeys.join(',')}`);
      if (cap.dKeys.length) nsLog(`  DKeys=${cap.dKeys.join(',')}`);
      if (cap.sampleTitles.length) nsLog(`  titles=${cap.sampleTitles.slice(0, 5).join(' | ')}`);
      if (cap.scheduleLikeFields.length) nsLog(`  scheduleFields=${cap.scheduleLikeFields.join(',')}`);
    });
  });

  const pagesToVisit = [
    `${DEFAULT_PORTAL_BASE}/default/content-library`,
    `${DEFAULT_PORTAL_BASE}/default/planner`,
    `${DEFAULT_PORTAL_BASE}/default/calendar`,
    `${DEFAULT_PORTAL_BASE}/default/dailynotice`,
    `${DEFAULT_PORTAL_BASE}/default/assignment`,
    `${DEFAULT_PORTAL_BASE}/default/classdiary`,
    `${DEFAULT_PORTAL_BASE}/default/class-diary`,
    `${DEFAULT_PORTAL_BASE}/default/timetable`,
    `${DEFAULT_PORTAL_BASE}/default/time-table`,
    `${DEFAULT_PORTAL_BASE}/default/schedule`,
  ];

  for (const url of pagesToVisit) {
    pageContext = new URL(url).pathname;
    nsLog(`Opening ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(4500);
      const finalPath = new URL(page.url()).pathname;
      const assessment = assessSessionUrl(page.url(), { expectAppRoute: true });
      nsLog(`path=${finalPath} session=${assessment}`);
      if (looksLikeLoginUrl(page.url()) || assessment === 'login') {
        nsError('AUTHENTICATION_REQUIRED — session expired during discovery');
        await context.close();
        process.exit(1);
      }

      const visibleTextHints = await collectVisibleHints(page);
      visits.push({
        url,
        finalPath,
        session: String(assessment),
        title: await page.title().catch(() => ''),
        visibleTextHints,
      });

      await softClickHints(page, [
        /newsletter/i,
        /timetable|time\s*table/i,
        /joy\s*of\s*learning|\bjol\b/i,
        /planner|calendar|schedule/i,
        /worksheet/i,
      ]);
      await page.waitForTimeout(2000);
    } catch (err) {
      nsLog(`page visit failed: ${err instanceof Error ? err.message : String(err)}`);
      visits.push({
        url,
        finalPath: '(failed)',
        session: 'error',
        title: '',
        visibleTextHints: [],
      });
    }
  }

  // Probe content-library with alternate payloads via page.request (reuses cookies; never log Token).
  pageContext = 'contentlib-probe';
  const api = 'https://nskapi.neverskip.com/parentweb/lms/fetchcontentlib';
  const probes: Array<Record<string, unknown>> = [
    { values: '', page: '0', pg_key: 'CD', works: '', limit: 0 },
    { values: 'NEWSLETTER', page: '0', pg_key: 'CD', works: '', limit: 0 },
    { values: 'timetable', page: '0', pg_key: 'CD', works: '', limit: 0 },
    { values: 'Joy of Learning', page: '0', pg_key: 'CD', works: '', limit: 0 },
    { values: 'TIMETABLE', page: '0', pg_key: 'CD', works: '', limit: 0 },
    { category: 'NEWSLETTER', page: '0', limit: 10 },
    { subject: 'NEWSLETTER', page: '0', limit: 10 },
  ];
  const probeResults: Array<{ bodyKeys: string[]; itemCount: number; titles: string[]; status: number }> = [];
  for (const body of probes) {
    try {
      const res = await context.request.post(api, {
        data: body,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 60_000,
      });
      const text = await res.text();
      let titles: string[] = [];
      let itemCount = 0;
      let bodyKeys: string[] = [];
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text) as Record<string, unknown>;
        bodyKeys = Object.keys(json);
        const D =
          json.D && typeof json.D === 'object' && !Array.isArray(json.D)
            ? (json.D as Record<string, unknown>)
            : null;
        const list = Array.isArray(D?.item_list) ? (D!.item_list as unknown[]) : [];
        itemCount = list.length;
        titles = extractSampleTitles(json).filter((t) =>
          /timetable|newsletter|joy|jol|schedule|planner/i.test(t),
        );
      }
      probeResults.push({ status: res.status(), bodyKeys, itemCount, titles });
      nsLog(
        `PROBE values=${JSON.stringify(body.values ?? body.category ?? body.subject)} status=${res.status()} items=${itemCount} hitTitles=${titles.length}`,
      );
    } catch (err) {
      nsLog(`probe failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await context.close();

  const outJson = path.join(process.cwd(), 'lib/neverskip/timetable-discovery.json');
  const outMd = path.join(process.cwd(), 'lib/neverskip/timetable-discovery.md');
  const apiPaths = [...new Set(captures.map((c) => `${c.method} ${c.urlPath}`))].sort();
  const scheduleApis = captures.filter(
    (c) =>
      /timetable|schedule|planner|calendar|period/i.test(c.urlPath) ||
      c.scheduleLikeFields.length > 0 ||
      c.sampleTitles.some((t) => /timetable|schedule|period/i.test(t)),
  );

  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        pagesVisited: pagesToVisit,
        visits,
        apiPaths,
        scheduleRelatedCaptureCount: scheduleApis.length,
        captures,
        contentLibProbes: probeResults,
      },
      null,
      2,
    ),
  );

  const md = `# NeverSkip timetable discovery (observed)

CapturedAt: ${new Date().toISOString()}

## Pages visited

${visits
  .map(
    (v) =>
      `- \`${v.url}\` → path=\`${v.finalPath}\` session=\`${v.session}\` hints=[${v.visibleTextHints.join(', ')}]`,
  )
  .join('\n')}

## Unique API paths

${apiPaths.map((p) => `- \`${p}\``).join('\n') || '- (none)'}

## Schedule-related captures

${
  scheduleApis.length
    ? scheduleApis
        .map(
          (c) =>
            `- [${c.pageContext}] \`${c.method} ${c.urlPath}\` items=${c.itemListLength ?? 'n/a'} titles=${c.sampleTitles.slice(0, 3).join(' | ') || '(none)'} fields=${c.scheduleLikeFields.join(',') || '(none)'}`,
        )
        .join('\n')
    : '- **None** — no timetable/schedule-named XHR and no sample titles containing timetable/schedule/period.'
}

## Content Library filter probes

${probeResults
  .map(
    (p, i) =>
      `- probe#${i + 1} status=${p.status} items=${p.itemCount} titles=${p.titles.slice(0, 5).join(' | ') || '(no timetable/newsletter/jol titles in sample)'}`,
  )
  .join('\n')}

## Classification

${
  scheduleApis.some((c) => /timetable|schedule|planner|calendar/i.test(c.urlPath))
    ? '**Structured timetable/schedule API likely present** — see captures above.'
    : '**No dedicated timetable API observed.** Next: treat Content Library / notice PDF (newsletter or titled timetable) as document source if present; otherwise portal may only render image grids without JSON.'
}

Safe dump: \`lib/neverskip/timetable-discovery.json\`
`;

  fs.writeFileSync(outMd, md);
  nsLog(`Wrote ${outJson}`);
  nsLog(`Wrote ${outMd}`);
  nsLog(`Total unique captures: ${captures.length}; schedule-related: ${scheduleApis.length}`);
}

main().catch((err) => {
  nsError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

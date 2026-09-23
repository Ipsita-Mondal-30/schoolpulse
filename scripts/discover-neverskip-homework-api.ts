/**
 * Capture the EXACT NeverSkip portal homework XHR (getassignmentsapi).
 * Does not invent payloads — only records what the SPA posts.
 *
 * Usage:
 *   NEVERSKIP_PROFILE_DIR=.playwright-profile npx tsx scripts/discover-neverskip-homework-api.ts
 *
 * Never logs Token / cookies / Authorization values.
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { chromium, type Request, type Response } from 'playwright';
import {
  DEFAULT_HOMEWORK_PAGE,
  DEFAULT_PROFILE_DIR,
  assessSessionUrl,
  looksLikeLoginUrl,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { HOMEWORK_PAYLOAD, HOMEWORK_PATH } from '../lib/neverskip/homework';
import { nsError, nsLog, nsWarn } from '../lib/neverskip/log';
import { extractAssignments } from '../lib/neverskip/normalizers';
import type { NeverSkipHomeworkResponse, NeverSkipRawAssignment } from '../lib/neverskip/types';

const HW_API = 'https://nskapi.neverskip.com/parentweb/lms/getassignmentsapi';
const OUT_JSON = path.join(process.cwd(), 'lib/neverskip/homework-api-discovery.json');
const OUT_MD = path.join(process.cwd(), 'lib/neverskip/homework-api-discovery.md');

type CapturedRequest = {
  seq: number;
  url: string;
  method: string;
  query: string;
  headerNames: string[];
  /** Parsed JSON body when present — safe field values only (no tokens). */
  body: Record<string, unknown> | null;
  rawBodyPreview: string;
};

type CapturedResponse = {
  seq: number;
  url: string;
  status: number;
  pageCount: number | null;
  totalCount: number | null;
  sfileLimit: number | null;
  itemCount: number;
  sampleKeys: string[];
  dateHints: Array<{ assign_id: string; refid: string; ass_dt: string; assign_dt: string; due_dt: string }>;
  newestAssDt: string;
  newestAssignDt: string;
};

function isHomeworkApi(url: string): boolean {
  return /\/parentweb\/lms\/getassignmentsapi/i.test(url);
}

function safeHeaderNames(headers: Record<string, string>): string[] {
  return Object.keys(headers)
    .filter((k) => !/cookie|authorization|token|set-cookie/i.test(k))
    .sort();
}

function parseBody(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toFiniteInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function summarizeResponse(seq: number, url: string, status: number, json: NeverSkipHomeworkResponse): CapturedResponse {
  const items = extractAssignments(json);
  const root = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  const D =
    root?.D && typeof root.D === 'object' && !Array.isArray(root.D)
      ? (root.D as Record<string, unknown>)
      : null;
  const sampleKeys = items[0] ? Object.keys(items[0]).slice(0, 40) : [];
  const dateHints = items.slice(0, 15).map((r: NeverSkipRawAssignment) => ({
    assign_id: String(r.assign_id ?? ''),
    refid: String(r.refid ?? ''),
    ass_dt: String(r.ass_dt ?? ''),
    assign_dt: String(r.assign_dt ?? ''),
    due_dt: String(r.due_dt ?? ''),
  }));

  let newestAssDt = '';
  let newestAssignDt = '';
  for (const r of items) {
    const a = String(r.ass_dt ?? '').trim();
    const b = String(r.assign_dt ?? '').trim();
    if (a && a > newestAssDt) newestAssDt = a;
    if (b && b > newestAssignDt) newestAssignDt = b;
  }

  return {
    seq,
    url,
    status,
    pageCount: toFiniteInt(D?.page_count ?? root?.page_count),
    totalCount: toFiniteInt(D?.total_count ?? root?.total_count),
    sfileLimit: toFiniteInt(D?.sfile_limit ?? root?.sfile_limit),
    itemCount: items.length,
    sampleKeys,
    dateHints,
    newestAssDt,
    newestAssignDt,
  };
}

function dedupeKey(item: NeverSkipRawAssignment): string | null {
  if (item.assign_id != null && String(item.assign_id).trim() !== '') {
    return `id:${String(item.assign_id)}`;
  }
  if (item.refid != null && String(item.refid).trim() !== '') {
    return `ref:${String(item.refid)}`;
  }
  return null;
}

function analyzeDuplicates(pages: NeverSkipRawAssignment[][]): {
  crossPageDuplicates: string[];
  uniqueCount: number;
  rawCount: number;
} {
  const pageHits = new Map<string, number>();
  let rawCount = 0;
  const unique = new Set<string>();
  for (const page of pages) {
    rawCount += page.length;
    const onPage = new Set<string>();
    for (const item of page) {
      const key = dedupeKey(item);
      if (!key) continue;
      unique.add(key);
      if (onPage.has(key)) continue;
      onPage.add(key);
      pageHits.set(key, (pageHits.get(key) ?? 0) + 1);
    }
  }
  return {
    crossPageDuplicates: [...pageHits.entries()]
      .filter(([, n]) => n > 1)
      .map(([id]) => id)
      .sort(),
    uniqueCount: unique.size,
    rawCount,
  };
}

async function main() {
  const profileDir = resolveNeverSkipProfileDir(
    process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR,
  );
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No NeverSkip Playwright profile — run npm run neverskip:login first');
    process.exit(1);
  }

  const requests: CapturedRequest[] = [];
  const responses: CapturedResponse[] = [];
  const responsePages: NeverSkipRawAssignment[][] = [];
  let seq = 0;
  /** Captured from portal XHR — never logged. */
  let sessionToken: string | null = null;

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1360, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  page.on('request', (req: Request) => {
    const headers = req.headers();
    const token = headers['token'] || headers['Token'];
    if (token && !sessionToken) sessionToken = token;

    if (!isHomeworkApi(req.url()) || req.method() !== 'POST') return;
    const raw = req.postData();
    const body = parseBody(raw);
    requests.push({
      seq: ++seq,
      url: req.url().split('?')[0],
      method: req.method(),
      query: req.url().includes('?') ? req.url().slice(req.url().indexOf('?') + 1) : '',
      headerNames: safeHeaderNames(req.headers()),
      body,
      rawBodyPreview: (raw || '').slice(0, 400),
    });
    nsLog(
      `HW REQUEST #${seq} bodyKeys=${body ? Object.keys(body).join(',') : '(none)'} page=${String(body?.page ?? '')} limt=${String(body?.limt ?? body?.limit ?? '')} pg_key=${String(body?.pg_key ?? '')} values=${JSON.stringify(body?.values ?? '')} works=${JSON.stringify(body?.works ?? '')} sub_id=${JSON.stringify(body?.sub_id ?? '')} assignment_date=${JSON.stringify(body?.assignment_date ?? '')}`,
    );
  });

  page.on('response', async (response: Response) => {
    if (!isHomeworkApi(response.url())) return;
    if (response.status() < 200 || response.status() >= 300) return;
    try {
      const text = await response.text();
      if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
        nsWarn(`HW RESPONSE non-JSON status=${response.status()} prefix=${text.slice(0, 40)}`);
        return;
      }
      const json = JSON.parse(text) as NeverSkipHomeworkResponse;
      const items = extractAssignments(json);
      responsePages.push(items);
      const summary = summarizeResponse(responses.length + 1, response.url().split('?')[0], response.status(), json);
      responses.push(summary);
      nsLog(
        `HW RESPONSE #${summary.seq} items=${summary.itemCount} total=${summary.totalCount} page_count=${summary.pageCount} newestAss=${summary.newestAssDt || '(none)'} newestAssign=${summary.newestAssignDt || '(none)'}`,
      );
    } catch (err) {
      nsWarn(`HW RESPONSE parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  nsLog(`Opening homework page ${DEFAULT_HOMEWORK_PAGE}`);
  // Warm notices first — assignment route sometimes redirects to `/` even when session is valid.
  await page.goto('https://parent.neverskip.com/default/dailynotice', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(3000);

  const noticesOk =
    !looksLikeLoginUrl(page.url()) &&
    assessSessionUrl(page.url(), { expectAppRoute: true }) === 'authenticated';

  await page.goto(DEFAULT_HOMEWORK_PAGE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(5000);

  // Try Class Diary route if assignment bounced off /default/*
  if (assessSessionUrl(page.url(), { expectAppRoute: true }) !== 'authenticated') {
    nsWarn(`Assignment route landed on ${page.url()} — trying classdiary`);
    await page
      .goto('https://parent.neverskip.com/default/classdiary', {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      .catch(() => undefined);
    await page.waitForTimeout(5000);
  }

  if (
    !noticesOk &&
    (looksLikeLoginUrl(page.url()) ||
      assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login')
  ) {
    nsError('AUTHENTICATION_REQUIRED — re-run neverskip:login');
    await context.close();
    process.exit(1);
  }

  if (assessSessionUrl(page.url(), { expectAppRoute: true }) !== 'authenticated') {
    nsWarn(
      `Homework SPA route unsettled (path=${page.url()}) — continuing; will replay via session if a body was captured or use SPA-default CD body`,
    );
  }

  // Mild UI interactions that may trigger more homework fetches (no invented API bodies).
  for (const label of ['Refresh', 'Reload', 'Next', 'Previous', 'Load more', 'More']) {
    try {
      const loc = page.getByText(label, { exact: false }).first();
      if ((await loc.count()) > 0) {
        await loc.click({ timeout: 1500 });
        await page.waitForTimeout(2500);
      }
    } catch {
      /* ignore */
    }
  }

  // Scroll to encourage lazy pagination if present
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1500);
  }

  // Also open Class Diary route if present in nav (some schools use it for assignments).
  try {
    const diary = page.locator('a[href*="classdiary"], a[href*="class-diary"], a[href*="diary"]').first();
    if ((await diary.count()) > 0) {
      await diary.click({ timeout: 2000 });
      await page.waitForTimeout(4000);
    }
  } catch {
    /* ignore */
  }

  // Replay intercepted bodies (or SPA-default CD body when assignment route did not fire XHR).
  const firstBody =
    requests.find((r) => r.body)?.body ??
    ({
      values: '',
      page: '0',
      sub_id: '',
      assignment_date: 0,
      pg_key: 'CD',
      works: '',
      limt: 0,
    } as Record<string, unknown>);
  const replayResults: Array<Record<string, unknown>> = [];
  if (firstBody) {
    // Prefer session cookies via context.request — do not invent Token headers.
    for (const pageIndex of [0, 1, 2]) {
      const body: Record<string, unknown> = { ...firstBody, page: String(pageIndex) };
      // AG pagination advances limt; CD keeps limt:0
      if (String(body.pg_key) === 'AG') {
        body.limt = pageIndex * 10;
      }
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (sessionToken) headers.Token = sessionToken;
        const res = await context.request.post(HW_API, {
          data: body,
          headers,
          timeout: 60_000,
        });
        const text = await res.text();
        let itemCount = 0;
        let newestAssDt = '';
        let totalCount: number | null = null;
        if (text.trim().startsWith('{')) {
          const json = JSON.parse(text) as NeverSkipHomeworkResponse;
          const items = extractAssignments(json);
          itemCount = items.length;
          responsePages.push(items);
          const root = json as Record<string, unknown>;
          const D =
            root.D && typeof root.D === 'object' && !Array.isArray(root.D)
              ? (root.D as Record<string, unknown>)
              : null;
          totalCount = toFiniteInt(D?.total_count ?? root.total_count);
          for (const r of items) {
            const a = String(r.ass_dt ?? '').trim();
            if (a && a > newestAssDt) newestAssDt = a;
          }
        }
        replayResults.push({
          page: pageIndex,
          status: res.status(),
          itemCount,
          totalCount,
          newestAssDt,
          bodyKeys: Object.keys(body),
          body,
        });
        nsLog(
          `REPLAY page=${pageIndex} status=${res.status()} items=${itemCount} newestAss=${newestAssDt || '(none)'} pg_key=${String(body.pg_key)} limt=${String(body.limt)}`,
        );
      } catch (err) {
        replayResults.push({
          page: pageIndex,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Also probe AG page-0 (Assignments SPA) for a newer window than CD.
    const agBody = {
      values: '',
      page: '0',
      limt: 0,
      sub_id: '',
      assignment_date: 0,
      pg_key: 'AG',
    };
    try {
      const agHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (sessionToken) agHeaders.Token = sessionToken;
      const res = await context.request.post(HW_API, {
        data: agBody,
        headers: agHeaders,
        timeout: 60_000,
      });
      const text = await res.text();
      let itemCount = 0;
      let newestAssDt = '';
      let totalCount: number | null = null;
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text) as NeverSkipHomeworkResponse;
        const items = extractAssignments(json);
        itemCount = items.length;
        responsePages.push(items);
        const root = json as Record<string, unknown>;
        const D =
          root.D && typeof root.D === 'object' && !Array.isArray(root.D)
            ? (root.D as Record<string, unknown>)
            : null;
        totalCount = toFiniteInt(D?.total_count ?? root.total_count);
        for (const r of items) {
          const a = String(r.ass_dt ?? '').trim();
          if (a && a > newestAssDt) newestAssDt = a;
        }
      }
      replayResults.push({
        page: 'AG-0',
        status: res.status(),
        itemCount,
        totalCount,
        newestAssDt,
        body: agBody,
      });
      nsLog(
        `REPLAY AG page=0 status=${res.status()} items=${itemCount} newestAss=${newestAssDt || '(none)'}`,
      );
    } catch (err) {
      replayResults.push({
        page: 'AG-0',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    nsWarn('No portal homework POST body intercepted — cannot replay');
  }

  await context.close();

  const dupes = analyzeDuplicates(responsePages);
  const ourDefault = HOMEWORK_PAYLOAD;
  const portalBodies = requests.map((r) => r.body).filter(Boolean) as Record<string, unknown>[];
  const firstPortal = portalBodies[0] ?? null;
  const diffVsDefault: Record<string, { ours: unknown; portal: unknown }> = {};
  if (firstPortal) {
    const keys = new Set([...Object.keys(ourDefault), ...Object.keys(firstPortal)]);
    for (const k of keys) {
      const ours = (ourDefault as Record<string, unknown>)[k];
      const portal = firstPortal[k];
      if (JSON.stringify(ours) !== JSON.stringify(portal)) {
        diffVsDefault[k] = { ours: ours ?? null, portal: portal ?? null };
      }
    }
  }

  const newestAcross =
    responses.map((r) => r.newestAssDt).filter(Boolean).sort().reverse()[0] ||
    responses.map((r) => r.newestAssignDt).filter(Boolean).sort().reverse()[0] ||
    '';

  const report = {
    capturedAt: new Date().toISOString(),
    homeworkPage: DEFAULT_HOMEWORK_PAGE,
    apiPath: HOMEWORK_PATH,
    apiUrl: HW_API,
    ourDefaultPayload: ourDefault,
    requestCount: requests.length,
    responseCount: responses.length,
    requests,
    responses,
    replayResults,
    duplicates: dupes,
    firstPortalBody: firstPortal,
    diffVsDefault,
    newestAssignedDateSeen: newestAcross,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const md = `# NeverSkip homework API discovery

Captured: ${report.capturedAt}

## Portal page
\`${DEFAULT_HOMEWORK_PAGE}\`

## API
\`POST ${HW_API}\`

## Our default payload
\`\`\`json
${JSON.stringify(ourDefault, null, 2)}
\`\`\`

## First portal POST body
\`\`\`json
${JSON.stringify(firstPortal, null, 2)}
\`\`\`

## Diff vs our default
\`\`\`json
${JSON.stringify(diffVsDefault, null, 2)}
\`\`\`

## Requests captured: ${requests.length}
${requests
  .map(
    (r) =>
      `- #${r.seq} ${r.method} page=${String(r.body?.page ?? '')} limt=${String(r.body?.limt ?? r.body?.limit ?? '')} pg_key=${String(r.body?.pg_key ?? '')} values=${JSON.stringify(r.body?.values ?? '')} works=${JSON.stringify(r.body?.works ?? '')} sub_id=${JSON.stringify(r.body?.sub_id ?? '')} assignment_date=${JSON.stringify(r.body?.assignment_date ?? '')}`,
  )
  .join('\n') || '(none)'}

## Responses: ${responses.length}
${responses
  .map(
    (r) =>
      `- #${r.seq} items=${r.itemCount} total=${r.totalCount} page_count=${r.pageCount} sfile_limit=${r.sfileLimit} newestAss=${r.newestAssDt || '(none)'} newestAssign=${r.newestAssignDt || '(none)'}`,
  )
  .join('\n') || '(none)'}

## Newest assigned date seen
\`${newestAcross || '(none)'}\`

## Duplicates
- raw=${dupes.rawCount} unique=${dupes.uniqueCount}
- cross-page duplicate keys (${dupes.crossPageDuplicates.length}): ${dupes.crossPageDuplicates.slice(0, 40).join(', ') || '(none)'}

## Replay of intercepted body
\`\`\`json
${JSON.stringify(replayResults, null, 2)}
\`\`\`
`;

  fs.writeFileSync(OUT_MD, md);
  nsLog(`Wrote ${OUT_JSON}`);
  nsLog(`Wrote ${OUT_MD}`);
  nsLog(`Newest assigned date seen: ${newestAcross || '(none)'}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

/**
 * Fetch Content Library pages via authenticated Playwright session.
 * Safe logs only — no tokens. Writes sample shapes to lib/neverskip/jol-discovery-contentlib.json
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

const API = 'https://nskapi.neverskip.com/parentweb/lms/fetchcontentlib';
const PAGE = `${DEFAULT_PORTAL_BASE}/default/content-library`;

async function main() {
  const profileDir = resolveNeverSkipProfileDir(process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  if (!neverSkipProfileExists(profileDir)) {
    nsError('No profile');
    process.exit(1);
  }
  const headless = process.env.NEVERSKIP_HEADLESS !== 'false';
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    viewport: { width: 1280, height: 800 },
  });
  const page = context.pages()[0] || (await context.newPage());

  let token: string | null = null;
  page.on('request', (req) => {
    if (!req.url().includes('nskapi.neverskip.com')) return;
    const h = req.headers();
    const t = h.token || h.Token;
    if (t && !token) token = t; // keep in memory only — never log
  });

  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);
  if (looksLikeLoginUrl(page.url()) || assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
    nsError('AUTHENTICATION_REQUIRED');
    await context.close();
    process.exit(1);
  }

  const pages: Array<{
    page: number;
    status: number;
    page_count: unknown;
    item_count: number;
    first: Record<string, unknown> | null;
    mediaSample: unknown;
  }> = [];

  for (let p = 0; p < 20; p++) {
    const payloadCandidates = [
      { values: '', page: String(p), pg_key: 'CD', works: '', limit: 0 },
      { page: String(p), limit: 10 },
      { page: p, limit: 10 },
      {},
    ];
    let got = false;
    for (const body of payloadCandidates) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers.Token = token;
      const res = await context.request.post(API, {
        data: body,
        headers,
        timeout: 60_000,
      });
      const status = res.status();
      const text = await res.text();
      if (!text.trim() || text.startsWith('SQLSTATE') || (text[0] !== '{' && text[0] !== '[')) {
        continue;
      }
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (json.S === false) continue;
      const D = json.D && typeof json.D === 'object' && !Array.isArray(json.D) ? (json.D as Record<string, unknown>) : null;
      const list = Array.isArray(D?.item_list) ? (D!.item_list as unknown[]) : [];
      if (p === 0 && list.length === 0 && Object.keys(body).length > 0) continue;

      const first = list[0] && typeof list[0] === 'object' ? (list[0] as Record<string, unknown>) : null;
      // Strip long content for sample — keep keys + media shape only
      const firstSafe = first
        ? {
            keys: Object.keys(first),
            refid: first.refid,
            subject_name: first.subject_name,
            con_tit: typeof first.con_tit === 'string' ? String(first.con_tit).slice(0, 80) : first.con_tit,
            sch_dt: first.sch_dt,
            sch_fdt: first.sch_fdt,
            is_sch: first.is_sch,
            cls_sec: first.cls_sec,
            mediaType: Array.isArray(first.media)
              ? 'array'
              : typeof first.media === 'string'
                ? 'string'
                : typeof first.media,
          }
        : null;
      let mediaSample: unknown = null;
      if (first?.media != null) {
        if (typeof first.media === 'string') {
          try {
            const parsed = JSON.parse(first.media) as unknown;
            mediaSample = Array.isArray(parsed) ? parsed.slice(0, 2) : parsed;
          } catch {
            mediaSample = { stringLen: first.media.length };
          }
        } else if (Array.isArray(first.media)) {
          mediaSample = first.media.slice(0, 2);
        } else {
          mediaSample = first.media;
        }
      }

      pages.push({
        page: p,
        status,
        page_count: D?.page_count ?? null,
        item_count: list.length,
        first: firstSafe as Record<string, unknown> | null,
        mediaSample,
      });
      nsLog(
        `contentlib page=${p} status=${status} items=${list.length} page_count=${D?.page_count ?? 'n/a'} payloadKeys=${Object.keys(body).join(',') || '(empty)'}`,
      );
      got = true;
      if (list.length === 0) {
        await context.close();
        const out = path.join(process.cwd(), 'lib/neverskip/jol-discovery-contentlib.json');
        fs.writeFileSync(out, JSON.stringify({ pages, note: 'empty page — stop' }, null, 2));
        nsLog(`Wrote ${out}`);
        return;
      }
      break;
    }
    if (!got) {
      nsLog(`page ${p}: no usable response for tried payloads`);
      break;
    }
    const last = pages[pages.length - 1];
    const pc = typeof last?.page_count === 'number' ? last.page_count : Number(last?.page_count);
    if (Number.isFinite(pc) && p + 1 >= pc) break;
    if ((last?.item_count ?? 0) < 5 && p > 0) break;
  }

  await context.close();
  const out = path.join(process.cwd(), 'lib/neverskip/jol-discovery-contentlib.json');
  fs.writeFileSync(out, JSON.stringify({ pages }, null, 2));
  nsLog(`Wrote ${out}`);
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

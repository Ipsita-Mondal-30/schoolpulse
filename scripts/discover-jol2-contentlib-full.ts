import { config } from 'dotenv';
config();
import fs from 'fs';
import { chromium } from 'playwright';
import * as b from '../lib/neverskip/browser';
import { buildContentLibPayload, JOL_CONTENT_LIBRARY_PATH } from '../lib/neverskip/jol';
import { nsLog, nsError } from '../lib/neverskip/log';

async function main() {
  const profileDir = b.resolveNeverSkipProfileDir(
    process.env.NEVERSKIP_PROFILE_DIR || b.DEFAULT_PROFILE_DIR,
  );
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    viewport: { width: 1280, height: 800 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://parent.neverskip.com/default/content-library', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);
  if (b.looksLikeLoginUrl(page.url())) {
    nsError('AUTHENTICATION_REQUIRED');
    process.exit(1);
  }

  const titles: string[] = [];
  const interesting: Array<Record<string, unknown>> = [];
  let pageCount = 20;
  for (let i = 0; i < pageCount; i++) {
    const res = await context.request.post(`https://nskapi.neverskip.com${JOL_CONTENT_LIBRARY_PATH}`, {
      data: buildContentLibPayload(i),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 60_000,
    });
    const text = await res.text();
    if (!text.startsWith('{')) break;
    const json = JSON.parse(text) as {
      S?: boolean;
      D?: { item_list?: Array<Record<string, unknown>>; page_count?: number };
    };
    nsLog(`page ${i} S=${json.S} items=${json.D?.item_list?.length ?? 0}`);
    if (json.S === false) break;
    if (typeof json.D?.page_count === 'number') pageCount = json.D.page_count;
    const list = json.D?.item_list ?? [];
    if (!list.length) break;
    for (const item of list) {
      const title = String(item.con_tit ?? '');
      titles.push(title);
      const blob = JSON.stringify(item);
      if (/timetable|newsletter|schedule|study holiday|30.?sep|joy of learning ii|worksheet.?ii.?time/i.test(blob)) {
        interesting.push({
          title,
          sch_dt: item.sch_dt,
          refid: item.refid,
          subject: item.subject_name,
          media: Array.isArray(item.media)
            ? (item.media as Array<Record<string, unknown>>).map((m) => ({
                type: m.media_type,
                url: String(m.dwn_url ?? m.media_url ?? '').slice(0, 180),
              }))
            : [],
        });
      }
    }
  }

  // Also dump recent notices text for timetable markers
  await page.goto('https://parent.neverskip.com/default/dailynotice', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);
  const noticeHits: string[] = [];
  page.on('response', async (response) => {
    if (!response.url().includes('fetchdailynoticeinfo')) return;
    try {
      const t = await response.text();
      if (/timetable|study holiday|30 september|joy of learning ii/i.test(t)) {
        noticeHits.push(t.slice(0, 500));
      }
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  fs.writeFileSync(
    'lib/neverskip/jol2-contentlib-full-titles.json',
    JSON.stringify({ titles, interesting, noticeHits, count: titles.length }, null, 2),
  );
  nsLog(`titles=${titles.length} interesting=${interesting.length} noticeHits=${noticeHits.length}`);
  await context.close();
}

main().catch((e) => {
  nsError(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

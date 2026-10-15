/**
 * Move an authenticated NeverSkip session from a machine where the parent logged in
 * normally (e.g. a Mac) into the worker's persistent profile. Only neverskip.com cookies
 * and localStorage are kept. Callers must never print the state; files are mode 0600.
 */
import fs from 'fs';
import { chromium } from 'playwright';
import {
  DEFAULT_NOTICES_PAGE,
  assessSessionUrl,
  resolveNeverSkipProfileDir,
  safeUrlPath,
} from './browser';

type Cookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
};
type OriginState = { origin: string; localStorage: { name: string; value: string }[] };
export type NeverSkipSessionState = { cookies: Cookie[]; origins: OriginState[] };

const isNeverSkipHost = (host: string) => /(^|\.)neverskip\.com$/i.test(host.replace(/^\./, ''));

/** Keep only neverskip.com cookies/origins; throws when nothing usable remains. */
export function filterNeverSkipState(raw: unknown): NeverSkipSessionState {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<NeverSkipSessionState>;
  const cookies = (Array.isArray(obj.cookies) ? obj.cookies : []).filter(
    (c) => c && typeof c.name === 'string' && typeof c.domain === 'string' && isNeverSkipHost(c.domain),
  );
  const origins = (Array.isArray(obj.origins) ? obj.origins : []).filter((o) => {
    try {
      return Array.isArray(o.localStorage) && isNeverSkipHost(new URL(o.origin).hostname);
    } catch {
      return false;
    }
  });
  if (cookies.length === 0 && origins.every((o) => o.localStorage.length === 0)) {
    throw new Error('session file has no NeverSkip cookies or storage');
  }
  return { cookies, origins };
}

export function sessionStateCounts(state: NeverSkipSessionState): string {
  const storageKeys = state.origins.reduce((n, o) => n + o.localStorage.length, 0);
  return `cookies=${state.cookies.length} origins=${state.origins.length} storageKeys=${storageKeys}`;
}

/** Export from an already-logged-in profile. Returns the landed path; writes only when authenticated. */
export async function exportNeverSkipSession(outFile: string, profileDir?: string): Promise<string> {
  const dir = resolveNeverSkipProfileDir(profileDir);
  const context = await chromium.launchPersistentContext(dir, { headless: true });
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(DEFAULT_NOTICES_PAGE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const landed = safeUrlPath(page.url());
    if (assessSessionUrl(page.url(), { expectAppRoute: true }) !== 'authenticated') return landed;
    const state = filterNeverSkipState(await context.storageState());
    fs.writeFileSync(outFile, JSON.stringify(state), { mode: 0o600 });
    fs.chmodSync(outFile, 0o600);
    return landed;
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Load cookies + localStorage into the worker profile without running portal scripts. */
export async function importNeverSkipSession(state: NeverSkipSessionState, profileDir?: string): Promise<void> {
  const dir = resolveNeverSkipProfileDir(profileDir);
  fs.mkdirSync(dir, { recursive: true });
  const context = await chromium.launchPersistentContext(dir, { headless: true });
  try {
    if (state.cookies.length) await context.addCookies(state.cookies);
    const page = context.pages()[0] || (await context.newPage());
    for (const origin of state.origins) {
      if (origin.localStorage.length === 0) continue;
      // Serve a blank page so the portal cannot clear storage while we write it.
      await page.route(`${origin.origin}/**`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }),
      );
      await page.goto(`${origin.origin}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.evaluate((items) => {
        for (const { name, value } of items) window.localStorage.setItem(name, value);
      }, origin.localStorage);
      await page.unroute(`${origin.origin}/**`);
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}

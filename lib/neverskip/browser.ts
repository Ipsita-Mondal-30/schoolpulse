import path from 'path';
import fs from 'fs';
import { chromium, type BrowserContext, type Page, type Response } from 'playwright';
import { DEFAULT_NEVERSKIP_BASE_URL } from './client';
import {
  HOMEWORK_PATH,
  HOMEWORK_PAYLOAD,
  fetchAllHomeworkPages,
  type HomeworkPayload,
} from './homework';
import { nsDebugApiEnvelope, nsError, nsLog, nsWarn } from './log';
import { extractNotices } from './normalizers';
import { NOTICES_PATH, fetchAllNoticePages, type NoticesPayload } from './notices';
import type {
  CollectedNeverSkipData,
  NeverSkipHomeworkResponse,
  NeverSkipNoticesResponse,
  NeverSkipRawNotice,
} from './types';

export const HOMEWORK_API_MATCH = '/parentweb/lms/getassignmentsapi';
export const NOTICES_API_MATCH = '/parentweb/connect/fetchdailynoticeinfo';

export const DEFAULT_PORTAL_BASE = 'https://parent.neverskip.com';
export const DEFAULT_NOTICES_PAGE = 'https://parent.neverskip.com/default/dailynotice';
export const DEFAULT_HOMEWORK_PAGE = 'https://parent.neverskip.com/default/assignment';
export const DEFAULT_PROFILE_DIR = '.playwright-profile';

export class NeverSkipSessionExpiredError extends Error {
  constructor(message = 'NeverSkip session expired') {
    super(message);
    this.name = 'NeverSkipSessionExpiredError';
  }
}

export interface CollectNeverSkipOptions {
  headless?: boolean;
  profileDir?: string;
  portalBaseUrl?: string;
  homeworkPageUrl?: string;
  noticesPageUrl?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
  /**
   * When true (browser sync), fail immediately if the persisted session is missing
   * or redirects to login — do not wait for interactive CAPTCHA/login.
   */
  requireAuthenticatedSession?: boolean;
  /** For tests: inject a pre-built page/context instead of launching Chromium. */
  page?: Page;
  context?: BrowserContext;
  /** Skip waiting for interactive login (tests / requireAuthenticatedSession). */
  skipLoginWait?: boolean;
}

export interface LoginNeverSkipOptions {
  profileDir?: string;
  portalBaseUrl?: string;
  noticesPageUrl?: string;
  /** Max time to wait for the developer to finish portal login (ms). */
  timeoutMs?: number;
}

export function isHomeworkApiUrl(url: string): boolean {
  return url.includes(HOMEWORK_API_MATCH);
}

export function isNoticesApiUrl(url: string): boolean {
  return url.includes(NOTICES_API_MATCH);
}

export function matchNeverSkipApiKind(url: string): 'homework' | 'notices' | null {
  if (isHomeworkApiUrl(url)) return 'homework';
  if (isNoticesApiUrl(url)) return 'notices';
  return null;
}

/** True when the URL looks like a NeverSkip/portal login or auth challenge page. */
export function looksLikeLoginUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('login') ||
    u.includes('signin') ||
    u.includes('sign-in') ||
    u.includes('/auth') ||
    u.includes('captcha')
  );
}

export type SessionUrlAssessment = 'login' | 'authenticated';

export interface AssessSessionUrlOptions {
  /**
   * When true, only `/default/...` app routes count as authenticated.
   * Portal root `/` alone is NOT proof of login (expired sessions often land there).
   */
  expectAppRoute?: boolean;
}

export function assessSessionUrl(
  url: string,
  options: AssessSessionUrlOptions = {},
): SessionUrlAssessment {
  if (looksLikeLoginUrl(url)) return 'login';
  if (options.expectAppRoute) {
    try {
      const pathName = new URL(url).pathname.replace(/\/+$/, '') || '/';
      if (!pathName.startsWith('/default')) return 'login';
    } catch {
      return 'login';
    }
  }
  return 'authenticated';
}

/** NeverSkip API failure envelope: { S: false, M, F } with no data payload. */
export function isNeverSkipFailureEnvelope(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const root = body as Record<string, unknown>;
  return root.S === false;
}

export function resolveNeverSkipProfileDir(profileDir?: string): string {
  return path.resolve(
    process.cwd(),
    profileDir || process.env.NEVERSKIP_PROFILE_DIR || DEFAULT_PROFILE_DIR,
  );
}

export function neverSkipProfileExists(profileDir: string): boolean {
  try {
    return fs.existsSync(profileDir) && fs.statSync(profileDir).isDirectory();
  } catch {
    return false;
  }
}

/** Safe log lines used when the persisted session is no longer valid. */
export function logSessionExpired(): void {
  nsError('NeverSkip session expired');
  nsError('Manual re-authentication required');
  nsLog('Run: npm run neverskip:login');
}

async function readJsonBody(response: Response): Promise<unknown | null> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function waitForCapture<T>(
  getValue: () => T | null,
  timeoutMs: number,
  pollMs = 250,
): Promise<T | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const v = getValue();
      if (v != null) {
        resolve(v);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, pollMs);
    };
    tick();
  });
}

async function fetchViaSession(
  context: BrowserContext,
  apiBaseUrl: string,
  pathSuffix: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ body: unknown; status: number; url: string } | null> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
  try {
    const res = await context.request.post(url, {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
      },
      timeout: 60_000,
    });
    const status = res.status();
    if (!res.ok()) {
      nsWarn(`Session API POST returned HTTP ${status} for ${pathSuffix}`);
      return { body: null, status, url };
    }
    const text = await res.text();
    if (!text.trim()) return { body: null, status, url };
    return { body: JSON.parse(text) as unknown, status, url };
  } catch (err) {
    nsWarn(
      `Session API POST failed for ${pathSuffix}: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return null;
  }
}

/** Safe pathname for logs — never includes query strings (may contain tokens). */
export function safeUrlPath(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '(unparseable)';
  }
}

function throwSessionExpired(detail?: string): never {
  if (detail) nsError(detail);
  logSessionExpired();
  throw new NeverSkipSessionExpiredError();
}

/**
 * Headed first-time login: open NeverSkip, wait for normal manual auth (CAPTCHA OK),
 * persist the Chromium profile under NEVERSKIP_PROFILE_DIR / .playwright-profile.
 * Never logs tokens, cookies, or storage state.
 */
export async function loginNeverSkipSession(
  options: LoginNeverSkipOptions = {},
): Promise<{ profileDir: string }> {
  const profileDir = resolveNeverSkipProfileDir(options.profileDir);
  const portalBaseUrl = (
    options.portalBaseUrl ||
    process.env.NEVERSKIP_PORTAL_URL ||
    DEFAULT_PORTAL_BASE
  ).replace(/\/$/, '');
  const noticesPageUrl =
    options.noticesPageUrl ||
    process.env.NEVERSKIP_NOTICES_PAGE_URL ||
    DEFAULT_NOTICES_PAGE;
  const timeoutMs = options.timeoutMs ?? 600_000;

  fs.mkdirSync(profileDir, { recursive: true });

  nsLog('Opening NeverSkip Parent Portal for manual login (headed)…');
  nsLog('Complete the normal portal login, including CAPTCHA if shown.');
  nsLog('Waiting until authentication succeeds…');

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    const isAppAuthenticated = (url: string) =>
      assessSessionUrl(url, { expectAppRoute: true }) === 'authenticated';

    await page.goto(`${portalBaseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    // Warm an authenticated app route so cookies/session stick in the profile.
    // Wait for SPA redirects (expired profiles often briefly hit /default/* then bounce).
    await page.goto(noticesPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    if (!isAppAuthenticated(page.url())) {
      nsWarn('Login required — complete NeverSkip login (and CAPTCHA if shown) in the browser…');
      await page.waitForURL((url) => isAppAuthenticated(url.toString()), {
        timeout: timeoutMs,
      });
      await page.goto(noticesPageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    }

    if (!isAppAuthenticated(page.url())) {
      throwSessionExpired();
    }

    nsLog('Session appears authenticated');
    nsLog('Authenticated NeverSkip browser profile persisted locally (gitignored — never commit)');
    return { profileDir };
  } finally {
    await context.close().catch(() => undefined);
  }
}

/**
 * Collect homework + notices JSON via an authenticated Playwright browser session.
 * Does not bypass CAPTCHA or log secrets. Reuses `.playwright-profile` when present.
 * Homework pages are fetched until NeverSkip pagination metadata says there are no more.
 */
export async function collectNeverSkipData(
  options: CollectNeverSkipOptions = {},
): Promise<CollectedNeverSkipData> {
  const requireAuth = options.requireAuthenticatedSession === true;
  const headless = options.headless ?? requireAuth;
  const profileDir = resolveNeverSkipProfileDir(options.profileDir);
  const portalBaseUrl = (
    options.portalBaseUrl ||
    process.env.NEVERSKIP_PORTAL_URL ||
    DEFAULT_PORTAL_BASE
  ).replace(/\/$/, '');
  const noticesPageUrl =
    options.noticesPageUrl ||
    process.env.NEVERSKIP_NOTICES_PAGE_URL ||
    DEFAULT_NOTICES_PAGE;
  const homeworkPageUrl =
    options.homeworkPageUrl ||
    process.env.NEVERSKIP_HOMEWORK_PAGE_URL ||
    DEFAULT_HOMEWORK_PAGE;
  const apiBaseUrl =
    options.apiBaseUrl || process.env.NEVERSKIP_BASE_URL || DEFAULT_NEVERSKIP_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const skipLoginWait = options.skipLoginWait ?? requireAuth;

  nsLog('NeverSkip browser sync started');

  if (requireAuth) {
    nsLog('Using persisted NeverSkip session');
    // Safe path diagnostic: basename + absolute flag only (no cookie/storage dump).
    nsLog(
      `Using NeverSkip profile directory: ${path.basename(profileDir)} (absolute=${path.isAbsolute(profileDir)})`,
    );
    if (!options.page && !neverSkipProfileExists(profileDir)) {
      nsError('NeverSkip session expired');
      nsError('Manual re-authentication required');
      nsLog('No persisted Playwright profile found. Run: npm run neverskip:login');
      throw new NeverSkipSessionExpiredError('NeverSkip session profile missing');
    }
  }

  let homeworkRaw: NeverSkipHomeworkResponse | null = null;
  let noticesRaw: NeverSkipNoticesResponse | null = null;
  let homeworkMeta: { url: string; status: number } | null = null;
  /** In-memory Token from intercepted portal XHR — never logged. */
  let sessionTokenHeader: string | null = null;

  const ownsBrowser = !options.page;
  let context: BrowserContext | undefined = options.context;
  let page: Page;

  if (options.page) {
    page = options.page;
    context = options.context ?? page.context();
  } else {
    context = await chromium.launchPersistentContext(profileDir, {
      headless,
      viewport: { width: 1280, height: 800 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    page = context.pages()[0] || (await context.newPage());
  }

  page.on('request', (request) => {
    const kind = matchNeverSkipApiKind(request.url());
    if (!kind) return;
    const headers = request.headers();
    const token = headers['token'] || headers['Token'];
    if (token && !sessionTokenHeader) {
      sessionTokenHeader = token;
    }
  });

  const onResponse = async (response: Response) => {
    const kind = matchNeverSkipApiKind(response.url());
    if (!kind) return;
    if (response.status() < 200 || response.status() >= 300) return;
    const body = await readJsonBody(response);
    if (body == null) return;
    // Do not treat Access Denied / S:false envelopes as successful captures.
    if (isNeverSkipFailureEnvelope(body)) {
      nsWarn(
        `${kind} API returned failure envelope (HTTP ${response.status()}) — session may be expired`,
      );
      return;
    }
    if (kind === 'homework' && !homeworkRaw) {
      homeworkRaw = body as NeverSkipHomeworkResponse;
      homeworkMeta = { url: response.url(), status: response.status() };
      nsLog('Homework response captured');
    }
    if (kind === 'notices' && !noticesRaw) {
      noticesRaw = body as NeverSkipNoticesResponse;
      nsLog('Notices response captured');
    }
  };

  page.on('response', onResponse);

  try {
    // Warm the portal origin (helps session cookies / login redirect detection)
    await page.goto(`${portalBaseUrl}/`, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined);

    // Notices first
    nsLog(`Opening notices page`);
    await page.goto(noticesPageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // SPA may client-redirect to /auth/login after first paint
    await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15_000) }).catch(() => undefined);

    if (requireAuth && assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
      throwSessionExpired(`Notices page not authenticated (path=${safeUrlPath(page.url())})`);
    }

    if (!skipLoginWait && assessSessionUrl(page.url()) === 'login') {
      nsLog(
        'Login required. Complete the normal NeverSkip Parent Portal login in the browser (including CAPTCHA if shown). Waiting up to 3 minutes…',
      );
      await page.waitForURL((url) => assessSessionUrl(url.toString()) === 'authenticated', {
        timeout: 180_000,
      }).catch(() => {
        nsWarn('Still on login page after wait — continuing to try capture');
      });
      await page.goto(noticesPageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    }

    if (requireAuth && assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
      throwSessionExpired(`Notices page still unauthenticated (path=${safeUrlPath(page.url())})`);
    }

    if (requireAuth) {
      nsLog('Session appears authenticated');
    }

    await waitForCapture(() => noticesRaw, Math.min(timeoutMs, 30_000));

    // Homework page
    nsLog(`Opening homework page`);
    await page.goto(homeworkPageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15_000) }).catch(() => undefined);

    // Incapsula / SPA may briefly leave /default/* after navigation; wait to settle.
    if (requireAuth && assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
      nsWarn(
        `Homework page not yet on app route (path=${safeUrlPath(page.url())}) — waiting for portal to settle…`,
      );
      await page
        .waitForURL((url) => assessSessionUrl(url.toString(), { expectAppRoute: true }) === 'authenticated', {
          timeout: Math.min(timeoutMs, 45_000),
        })
        .catch(() => undefined);
      if (assessSessionUrl(page.url(), { expectAppRoute: true }) === 'login') {
        // If notices already prove the session works, continue and fetch homework via session API.
        if (noticesRaw) {
          nsWarn(
            `Homework page path=${safeUrlPath(page.url())} — continuing with session API for homework`,
          );
        } else {
          throwSessionExpired(`Homework page unauthenticated (path=${safeUrlPath(page.url())})`);
        }
      }
    }

    await waitForCapture(() => homeworkRaw, Math.min(timeoutMs, 30_000));

    // Session cookie fallback (authorized browser context — not NEVERSKIP_TOKEN env)
    if (!noticesRaw && context) {
      nsLog('Notices not intercepted; retrying via authenticated browser session request');
      const result = await fetchViaSession(
        context,
        apiBaseUrl,
        NOTICES_PATH,
        {},
        sessionTokenHeader ? { Token: sessionTokenHeader } : undefined,
      );
      if (result?.body) {
        if (requireAuth && isNeverSkipFailureEnvelope(result.body)) {
          throwSessionExpired();
        }
        noticesRaw = result.body as NeverSkipNoticesResponse;
        nsLog('Notices response captured');
      }
    }

    if (!homeworkRaw && context) {
      nsLog('Homework not intercepted; retrying via authenticated browser session request');
      const result = await fetchViaSession(
        context,
        apiBaseUrl,
        HOMEWORK_PATH,
        { ...HOMEWORK_PAYLOAD },
        sessionTokenHeader ? { Token: sessionTokenHeader } : undefined,
      );
      if (result?.body) {
        if (requireAuth && isNeverSkipFailureEnvelope(result.body)) {
          throwSessionExpired();
        }
        homeworkRaw = result.body as NeverSkipHomeworkResponse;
        homeworkMeta = { url: result.url, status: result.status };
        nsLog('Homework response captured');
      }
    }

    if (requireAuth && homeworkRaw && isNeverSkipFailureEnvelope(homeworkRaw)) {
      throwSessionExpired();
    }
    if (requireAuth && noticesRaw && isNeverSkipFailureEnvelope(noticesRaw)) {
      throwSessionExpired();
    }

    if (!homeworkRaw && !noticesRaw) {
      if (requireAuth) {
        throwSessionExpired();
      }
      nsError(
        'No NeverSkip API responses captured. Run npm run neverskip:login, then re-run sync:neverskip:browser.',
      );
    }

    if (homeworkRaw) {
      nsDebugApiEnvelope('Homework', {
        url: homeworkMeta?.url,
        status: homeworkMeta?.status,
        body: homeworkRaw,
      });
    }

    if (noticesRaw) {
      nsDebugApiEnvelope('Notices', {
        url: noticesPageUrl,
        body: noticesRaw,
      });
    }

    let notices: NeverSkipRawNotice[] = [];
    let noticePagesFetched = 0;
    let noticeFetchIncomplete = false;
    let noticeFetchErrors: string[] = [];

    if (noticesRaw && context) {
      const tokenHeaders = sessionTokenHeader ? { Token: sessionTokenHeader } : undefined;
      const paged = await fetchAllNoticePages(
        async (pageIndex, payload: NoticesPayload) => {
          if (pageIndex === 0) return noticesRaw;
          const result = await fetchViaSession(
            context!,
            apiBaseUrl,
            NOTICES_PATH,
            payload,
            tokenHeaders,
          );
          if (!result?.body) {
            throw new Error(`notice session page ${pageIndex} failed (HTTP ${result?.status ?? 'n/a'})`);
          }
          return result.body as NeverSkipNoticesResponse;
        },
        { firstPage: noticesRaw },
      );
      notices = paged.items;
      noticePagesFetched = paged.pagesFetched;
      noticeFetchIncomplete = paged.incomplete;
      noticeFetchErrors = paged.errors;
    } else if (noticesRaw) {
      notices = extractNotices(noticesRaw);
      noticePagesFetched = notices.length > 0 ? 1 : 0;
    }

    let homeworkPagesFetched = 0;
    let homeworkFetchIncomplete = false;
    let homeworkFetchErrors: string[] = [];
    let homework: CollectedNeverSkipData['homework'] = [];

    if (homeworkRaw && context) {
      const firstPage = homeworkRaw;
      const tokenHeaders = sessionTokenHeader ? { Token: sessionTokenHeader } : undefined;

      const paged = await fetchAllHomeworkPages(async (pageIndex, payload: HomeworkPayload) => {
        if (pageIndex === 0) return firstPage;
        const result = await fetchViaSession(
          context!,
          apiBaseUrl,
          HOMEWORK_PATH,
          payload,
          tokenHeaders,
        );
        if (!result?.body) {
          throw new Error(`session page ${pageIndex} failed (HTTP ${result?.status ?? 'n/a'})`);
        }
        return result.body as NeverSkipHomeworkResponse;
      });

      homework = paged.items;
      homeworkPagesFetched = paged.pagesFetched;
      homeworkFetchIncomplete = paged.incomplete;
      homeworkFetchErrors = paged.errors;
    } else if (homeworkRaw) {
      // No browser context (tests) — still run pagination helper so page-0 metadata is logged;
      // additional pages cannot be fetched without a session.
      const paged = await fetchAllHomeworkPages(async (pageIndex) => {
        if (pageIndex === 0) return homeworkRaw;
        return null;
      });
      homework = paged.items;
      homeworkPagesFetched = paged.pagesFetched;
      homeworkFetchIncomplete = paged.incomplete;
      homeworkFetchErrors = paged.errors;
    }

    if (homeworkRaw && homework.length === 0) {
      nsWarn(
        'Homework response captured but extractAssignments returned 0 items (see Homework response debug above). Set NEVERSKIP_DEBUG=0 to hide debug.',
      );
    }

    if (requireAuth) {
      if (homeworkPagesFetched > 0) {
        nsLog(`Homework pages fetched: ${homeworkPagesFetched}`);
      }
      nsLog(`Homework records fetched: ${homework.length}`);
      if (noticePagesFetched > 0) {
        nsLog(`Notice pages fetched: ${noticePagesFetched}`);
      }
      nsLog(`Notices fetched: ${notices.length}`);
    }

    // Authenticated sync with notices but zero homework usually means homework API failed.
    if (
      requireAuth &&
      notices.length > 0 &&
      homework.length === 0 &&
      !homeworkFetchIncomplete
    ) {
      homeworkFetchIncomplete = true;
      homeworkFetchErrors = [
        ...homeworkFetchErrors,
        'homework fetch returned 0 records while notices succeeded',
      ];
      nsError('SYNC FAILED — INCOMPLETE SOURCE DATA (homework empty after authenticated notices fetch)');
    }

    return {
      homework,
      notices,
      homeworkPagesFetched,
      homeworkFetchIncomplete,
      homeworkFetchErrors,
      noticePagesFetched,
      noticeFetchIncomplete,
      noticeFetchErrors,
    };
  } finally {
    page.off('response', onResponse);
    if (ownsBrowser && context) {
      await context.close().catch(() => undefined);
    }
  }
}

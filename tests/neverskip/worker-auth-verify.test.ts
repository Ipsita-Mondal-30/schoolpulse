import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorkerEnv } from '@/lib/neverskip/worker-env';
import { classifySessionCheck, resolveNeverSkipProfileDir } from '@/lib/neverskip/browser';
import {
  REQUIRED_ENV,
  daysBetweenYmd,
  describeDataVersion,
  envPresence,
  summarizeSyncReport,
} from '@/lib/neverskip/verify';

const KEYS = ['NEVERSKIP_PROFILE_DIR', 'SP_TEST_ONLY_ROOT', 'SP_TEST_ONLY_WORKER'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('worker env loading (login and sync share one profile)', () => {
  function repoWith(rootEnv: string, workerEnv: string | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'sp-env-'));
    writeFileSync(join(dir, '.env'), rootEnv);
    if (workerEnv != null) {
      mkdirSync(join(dir, 'deploy/neverskip-worker'), { recursive: true });
      writeFileSync(join(dir, 'deploy/neverskip-worker/.env'), workerEnv);
    }
    return dir;
  }

  it('prefers the worker .env over the root .env', () => {
    for (const k of KEYS) delete process.env[k];
    const dir = repoWith(
      'NEVERSKIP_PROFILE_DIR=.playwright-profile\nSP_TEST_ONLY_ROOT=1\n',
      'NEVERSKIP_PROFILE_DIR=/srv/neverskip-profile\nSP_TEST_ONLY_WORKER=1\n',
    );
    loadWorkerEnv(dir);
    expect(process.env.NEVERSKIP_PROFILE_DIR).toBe('/srv/neverskip-profile');
    expect(process.env.SP_TEST_ONLY_ROOT).toBe('1');
    expect(process.env.SP_TEST_ONLY_WORKER).toBe('1');
    rmSync(dir, { recursive: true, force: true });
  });

  it('never overrides a value exported by the shell wrapper', () => {
    process.env.NEVERSKIP_PROFILE_DIR = '/exported/by/env.sh';
    const dir = repoWith('NEVERSKIP_PROFILE_DIR=.playwright-profile\n', 'NEVERSKIP_PROFILE_DIR=/other\n');
    loadWorkerEnv(dir);
    expect(process.env.NEVERSKIP_PROFILE_DIR).toBe('/exported/by/env.sh');
    rmSync(dir, { recursive: true, force: true });
  });

  it('works without a worker .env (developer laptop)', () => {
    for (const k of KEYS) delete process.env[k];
    const dir = repoWith('SP_TEST_ONLY_ROOT=1\n', null);
    loadWorkerEnv(dir);
    expect(process.env.SP_TEST_ONLY_ROOT).toBe('1');
    rmSync(dir, { recursive: true, force: true });
  });

  it('resolves the profile to an absolute path', () => {
    process.env.NEVERSKIP_PROFILE_DIR = 'deploy/neverskip-worker/neverskip-data/neverskip-profile';
    expect(resolveNeverSkipProfileDir()).toBe(
      join(process.cwd(), 'deploy/neverskip-worker/neverskip-data/neverskip-profile'),
    );
    process.env.NEVERSKIP_PROFILE_DIR = '/srv/p';
    expect(resolveNeverSkipProfileDir()).toBe('/srv/p');
  });
});

describe('worker shell scripts', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'deploy/neverskip-worker', f), 'utf8');

  it('run-sync, login and auth-check all source env.sh and share the lock', () => {
    for (const f of ['run-sync.sh', 'login.sh', 'auth-check.sh']) {
      const src = read(f);
      expect(src).toMatch(/source .*env\.sh/);
      expect(src).toMatch(/flock -n 9/);
    }
    expect(read('env.sh')).toMatch(/export NEVERSKIP_PROFILE_DIR=/);
  });

  it('VNC is bound to localhost only and the password file is removed', () => {
    const src = read('login.sh');
    expect(src).toMatch(/x11vnc[^\n]*-localhost/);
    expect(src).toMatch(/trap cleanup EXIT/);
    expect(src).toMatch(/rm -f "\$VNC_PASS_FILE"/);
  });

  it('shell scripts use LF line endings', () => {
    for (const f of ['run-sync.sh', 'login.sh', 'auth-check.sh', 'env.sh']) {
      expect(read(f).includes('\r')).toBe(false);
    }
  });
});

describe('session check classification', () => {
  it('reports a missing profile separately from an expired session', () => {
    expect(classifySessionCheck(false, null)).toBe('PROFILE_MISSING');
    expect(classifySessionCheck(true, 'https://parent.neverskip.com/auth/login')).toBe('AUTHENTICATION_REQUIRED');
    expect(classifySessionCheck(true, 'https://parent.neverskip.com/')).toBe('AUTHENTICATION_REQUIRED');
    expect(classifySessionCheck(true, null)).toBe('AUTHENTICATION_REQUIRED');
    expect(classifySessionCheck(true, 'https://parent.neverskip.com/default/dailynotice')).toBe('AUTHENTICATED');
  });
});

describe('verify:sync helpers', () => {
  it('reports env names only, never values', () => {
    const out = envPresence(REQUIRED_ENV.worker, { DATABASE_URL: 'postgres://secret', SYNCED_CHILD_SECTION: '  ' });
    expect(out.find((e) => e.name === 'DATABASE_URL')).toEqual({ name: 'DATABASE_URL', present: true });
    expect(out.find((e) => e.name === 'SYNCED_CHILD_SECTION')?.present).toBe(false);
    expect(REQUIRED_ENV.worker).not.toContain('REDIS_URL');
    expect(JSON.stringify(out)).not.toMatch(/secret/);
  });

  it('counts days between India dates', () => {
    expect(daysBetweenYmd('2026-09-24', '2026-10-14')).toBe(20);
    expect(daysBetweenYmd('', '2026-10-14')).toBeNull();
  });

  it('summarizes per-stream status from reportJson', () => {
    const lines = summarizeSyncReport(
      JSON.stringify({
        authenticationStatus: 'AUTHENTICATED',
        sources: {
          homework: { status: 'PARTIAL', fetched: 133, stored: 138, newestDate: '2026-09-24' },
          notices: { status: 'PAGE0_ONLY', fetched: 10 },
        },
        noticePage0Only: true,
      }),
    );
    expect(lines[0]).toBe('authenticationStatus=AUTHENTICATED');
    expect(lines).toContain('homework: PARTIAL fetched=133 stored=138 newest=2026-09-24');
    expect(lines).toContain('notices: only page 0 could be fetched');
    expect(summarizeSyncReport('{bad')).toEqual(['(reportJson unreadable)']);
  });

  it('describes the cache data version timestamp', () => {
    expect(describeDataVersion('1791981610330:neverskip-sync')).toMatch(/^2026-.*neverskip-sync/);
    expect(describeDataVersion(null)).toBe('(none)');
  });
});

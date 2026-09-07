import { describe, expect, it } from 'vitest';
import {
  assessSessionUrl,
  looksLikeLoginUrl,
  matchNeverSkipApiKind,
  neverSkipProfileExists,
  resolveNeverSkipProfileDir,
  DEFAULT_PROFILE_DIR,
  isNeverSkipFailureEnvelope,
} from '@/lib/neverskip/browser';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('NeverSkip session URL assessment', () => {
  it('detects login / auth URLs', () => {
    expect(looksLikeLoginUrl('https://parent.neverskip.com/login')).toBe(true);
    expect(looksLikeLoginUrl('https://parent.neverskip.com/signin')).toBe(true);
    expect(looksLikeLoginUrl('https://parent.neverskip.com/auth/callback')).toBe(true);
    expect(assessSessionUrl('https://parent.neverskip.com/login')).toBe('login');
  });

  it('treats portal app routes as authenticated', () => {
    expect(looksLikeLoginUrl('https://parent.neverskip.com/default/dailynotice')).toBe(false);
    expect(looksLikeLoginUrl('https://parent.neverskip.com/default/assignment')).toBe(false);
    expect(assessSessionUrl('https://parent.neverskip.com/default/dailynotice')).toBe(
      'authenticated',
    );
  });

  it('does not treat portal root as authenticated when an app route is required', () => {
    expect(assessSessionUrl('https://parent.neverskip.com/', { expectAppRoute: true })).toBe(
      'login',
    );
    expect(
      assessSessionUrl('https://parent.neverskip.com/default/assignment', {
        expectAppRoute: true,
      }),
    ).toBe('authenticated');
  });

  it('detects NeverSkip API failure envelopes without logging payload values', () => {
    expect(isNeverSkipFailureEnvelope({ S: false, M: 'x', F: 801 })).toBe(true);
    expect(isNeverSkipFailureEnvelope({ S: true, D: { item_list: [] }, F: 'S' })).toBe(false);
    expect(isNeverSkipFailureEnvelope(null)).toBe(false);
  });
});

describe('NeverSkip profile helpers', () => {
  it('resolves default profile dir under cwd', () => {
    const prev = process.env.NEVERSKIP_PROFILE_DIR;
    delete process.env.NEVERSKIP_PROFILE_DIR;
    expect(resolveNeverSkipProfileDir()).toBe(path.resolve(process.cwd(), DEFAULT_PROFILE_DIR));
    if (prev !== undefined) process.env.NEVERSKIP_PROFILE_DIR = prev;
  });

  it('detects whether a profile directory exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-profile-'));
    expect(neverSkipProfileExists(dir)).toBe(true);
    expect(neverSkipProfileExists(path.join(dir, 'missing-subdir'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('API URL matchers remain intact', () => {
  it('still matches homework and notices APIs', () => {
    expect(matchNeverSkipApiKind('https://nskapi.neverskip.com/parentweb/lms/getassignmentsapi')).toBe(
      'homework',
    );
    expect(
      matchNeverSkipApiKind('https://nskapi.neverskip.com/parentweb/connect/fetchdailynoticeinfo'),
    ).toBe('notices');
  });
});

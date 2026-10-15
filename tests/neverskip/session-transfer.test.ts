import { describe, expect, it } from 'vitest';
import { filterNeverSkipState, sessionStateCounts } from '@/lib/neverskip/session-transfer';

const cookie = (domain: string) => ({
  name: 'sid',
  value: 'v',
  domain,
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
});

describe('session transfer filter', () => {
  it('keeps only neverskip.com cookies and storage', () => {
    const state = filterNeverSkipState({
      cookies: [cookie('.neverskip.com'), cookie('parent.neverskip.com'), cookie('.google.com')],
      origins: [
        { origin: 'https://parent.neverskip.com', localStorage: [{ name: 'token', value: 't' }] },
        { origin: 'https://accounts.google.com', localStorage: [{ name: 'x', value: 'y' }] },
      ],
    });
    expect(state.cookies.map((c) => c.domain)).toEqual(['.neverskip.com', 'parent.neverskip.com']);
    expect(state.origins.map((o) => o.origin)).toEqual(['https://parent.neverskip.com']);
    expect(sessionStateCounts(state)).toBe('cookies=2 origins=1 storageKeys=1');
  });

  it('rejects look-alike domains and empty files', () => {
    expect(() => filterNeverSkipState({ cookies: [cookie('evilneverskip.com')], origins: [] })).toThrow();
    expect(() => filterNeverSkipState({})).toThrow();
  });
});

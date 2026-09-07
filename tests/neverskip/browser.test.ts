import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  isHomeworkApiUrl,
  isNoticesApiUrl,
  matchNeverSkipApiKind,
} from '@/lib/neverskip/browser';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { extractAssignments, extractNotices } from '@/lib/neverskip/normalizers';
import { syncNeverSkipData } from '@/lib/neverskip/sync';
import type {
  NeverSkipHomeworkResponse,
  NeverSkipNoticesResponse,
} from '@/lib/neverskip/types';

const fixturesDir = path.join(process.cwd(), 'fixtures', 'neverskip');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8')) as T;
}

describe('NeverSkip browser URL matchers', () => {
  it('recognizes homework API URL', () => {
    expect(
      isHomeworkApiUrl('https://nskapi.neverskip.com/parentweb/lms/getassignmentsapi'),
    ).toBe(true);
    expect(matchNeverSkipApiKind('https://x/parentweb/lms/getassignmentsapi?x=1')).toBe(
      'homework',
    );
  });

  it('recognizes notices API URL', () => {
    expect(
      isNoticesApiUrl('https://nskapi.neverskip.com/parentweb/connect/fetchdailynoticeinfo'),
    ).toBe(true);
    expect(matchNeverSkipApiKind('https://x/parentweb/connect/fetchdailynoticeinfo')).toBe(
      'notices',
    );
  });

  it('returns null for unrelated URLs', () => {
    expect(matchNeverSkipApiKind('https://parent.neverskip.com/default/dailynotice')).toBeNull();
    expect(isHomeworkApiUrl('https://example.com')).toBe(false);
  });
});

describe('intercepted fixture bodies → syncNeverSkipData', () => {
  it('processes captured JSON like the browser collector and is idempotent', async () => {
    const hwBody = loadFixture<NeverSkipHomeworkResponse>('homework.json');
    const noticeBody = loadFixture<NeverSkipNoticesResponse>('notices.json');

    // Simulate collector extract step after intercept
    const homework = extractAssignments(hwBody);
    const notices = extractNotices(noticeBody);
    expect(homework.length).toBe(3);
    expect(notices.length).toBe(3);

    const store = new InMemoryNeverSkipStore();
    const first = await syncNeverSkipData({
      homework,
      notices,
      store,
      label: 'browser sync',
    });
    expect(first.homeworkInserted).toBe(2);
    expect(first.homeworkSkippedType).toBe(1);
    expect(first.noticesInserted).toBe(3);

    const second = await syncNeverSkipData({
      homework,
      notices,
      store,
      label: 'browser sync',
    });
    expect(second.homeworkInserted).toBe(0);
    expect(second.noticesInserted).toBe(0);
    expect((await store.listHomework()).map((h) => h.sourceId).sort()).toEqual([
      '1198',
      '1201',
    ]);
    expect((await store.listNotices()).length).toBe(3);
  });
});

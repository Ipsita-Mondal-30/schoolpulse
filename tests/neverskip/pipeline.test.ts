import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { StaticTokenAuth, MissingAuth } from '@/lib/neverskip/auth';
import { NeverSkipClient } from '@/lib/neverskip/client';
import { classifyAssignment } from '@/lib/neverskip/classify';
import { homeworkSourceId, noticeSourceId } from '@/lib/neverskip/ids';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import {
  extractAssignments,
  extractNotices,
  normalizeDate,
  normalizeHomework,
  normalizeNotice,
} from '@/lib/neverskip/normalizers';
import { syncNeverSkip } from '@/lib/neverskip/sync';
import {
  NeverSkipAuthError,
  NeverSkipHttpError,
  NeverSkipTimeoutError,
  type NeverSkipHomeworkResponse,
  type NeverSkipNoticesResponse,
  type NeverSkipRawAssignment,
} from '@/lib/neverskip/types';

const fixturesDir = path.join(process.cwd(), 'fixtures', 'neverskip');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8')) as T;
}

describe('NeverSkip homework parsing & normalization', () => {
  const fixture = loadFixture<NeverSkipHomeworkResponse>('homework.json');

  it('extracts assignments from live S/D/F envelope even when data is empty array', () => {
    const list = extractAssignments(fixture);
    expect(list).toHaveLength(3);
    // Regression: empty top-level data:[] must not hide D.item_list
    expect(Array.isArray((fixture as { data?: unknown }).data)).toBe(true);
  });

  it('returns empty for malformed / empty responses', () => {
    expect(extractAssignments(null)).toEqual([]);
    expect(extractAssignments({})).toEqual([]);
    expect(extractAssignments({ data: 'nope' } as unknown as NeverSkipHomeworkResponse)).toEqual([]);
    expect(extractAssignments({ S: true, D: { item_list: [] }, F: 'S' })).toEqual([]);
  });

  it('parses stringified D.item_list', () => {
    const list = extractAssignments({
      S: true,
      D: {
        item_list: JSON.stringify([
          { assign_id: '99', assign_typ: 'Homework', assign_title: 'X' },
        ]),
      },
      F: 'S',
    } as unknown as NeverSkipHomeworkResponse);
    expect(list).toHaveLength(1);
    expect(String(list[0].assign_id)).toBe('99');
  });

  it('normalizes known assignment 1198', () => {
    const raw = extractAssignments(fixture).find((a) => String(a.assign_id) === '1198')!;
    const norm = normalizeHomework(raw);
    expect(norm).not.toBeNull();
    expect(norm!.sourceId).toBe('1198');
    expect(norm!.title).toBe('Chapter 9. Our School');
    expect(norm!.homeworkDate).toBe('2026-09-04');
    expect(norm!.subjectName).toBe('EVS');
    expect(norm!.sections).toEqual(['I-A', 'I-B']);
    expect(norm!.attachmentUrl).toContain('ch9.pdf');
  });

  it('parses assign_dt style dates', () => {
    expect(normalizeDate('4-Sep-2026')).toBe('2026-09-04');
    expect(normalizeDate('03-09-2026')).toBe('2026-09-03');
  });

  it('uses assign_id as stable source id', () => {
    expect(homeworkSourceId('1198', '85705')).toBe('1198');
    expect(homeworkSourceId(null, '85705')).toBe('85705');
    expect(homeworkSourceId(null, null)).toBeNull();
  });

  it('skips homework without ids', () => {
    expect(normalizeHomework({ assign_title: 'x', assign_typ: 'Homework' })).toBeNull();
  });
});

describe('NeverSkip notice parsing & normalization', () => {
  const fixture = loadFixture<NeverSkipNoticesResponse>('notices.json');

  it('extracts notices from D.item_list', () => {
    const list = extractNotices(fixture);
    expect(list).toHaveLength(3);
  });

  it('returns empty for empty response', () => {
    expect(extractNotices({})).toEqual([]);
    expect(extractNotices({ D: {} })).toEqual([]);
  });

  it('normalizes notice with explicit id and classes', () => {
    const raw = extractNotices(fixture)[0];
    const norm = normalizeNotice(raw);
    expect(norm!.sourceId).toBe('n-1001');
    expect(norm!.classes).toEqual(['I-A', 'I-B', 'I-G']);
    expect(norm!.publishedDate).toBe('2026-09-04');
    expect(norm!.publishedTime).toBe('15:39');
    expect(norm!.content).toContain('English textbook');
  });

  it('builds deterministic hash id when notice id missing', () => {
    const raw = extractNotices(fixture)[1];
    const a = normalizeNotice(raw)!;
    const b = normalizeNotice(raw)!;
    expect(a.sourceId).toBe(b.sourceId);
    expect(a.sourceId.length).toBe(32);
    expect(noticeSourceId({ date: '2026-09-03', time: '18:00', title: '', content: 'x' })).toMatch(
      /^[a-f0-9]{32}$/,
    );
  });
});

describe('classification', () => {
  it('routes Homework assign_typ to homework', () => {
    expect(classifyAssignment({ assign_typ: 'Homework' })).toBe('homework');
    expect(classifyAssignment({ assign_typ: 'homework' })).toBe('homework');
  });

  it('skips non-homework types', () => {
    expect(classifyAssignment({ assign_typ: 'Notice' })).toBe('skip');
    expect(classifyAssignment({} as NeverSkipRawAssignment)).toBe('skip');
  });
});

describe('dedupe + idempotent sync', () => {
  function mockClientFromFixtures() {
    const hw = loadFixture<NeverSkipHomeworkResponse>('homework.json');
    const notices = loadFixture<NeverSkipNoticesResponse>('notices.json');
    const fetchFn = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('getassignmentsapi')) {
        return new Response(JSON.stringify(hw), { status: 200 });
      }
      if (u.includes('fetchdailynoticeinfo')) {
        return new Response(JSON.stringify(notices), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    return new NeverSkipClient({
      auth: new StaticTokenAuth('test-token'),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
  }

  it('inserts new homework and skips duplicates on second sync', async () => {
    const store = new InMemoryNeverSkipStore();
    const client = mockClientFromFixtures();

    const first = await syncNeverSkip({ client, store });
    expect(first.homeworkFetched).toBe(3);
    expect(first.homeworkInserted).toBe(2); // Notice type skipped
    expect(first.homeworkSkippedType).toBe(1);
    expect(first.noticesInserted).toBe(3);

    const second = await syncNeverSkip({ client, store });
    expect(second.homeworkInserted).toBe(0);
    expect(second.noticesInserted).toBe(0);
    expect(second.homeworkSkipped).toBeGreaterThanOrEqual(2);
    expect(second.noticesSkipped).toBe(3);

    const hw = await store.listHomework();
    const nt = await store.listNotices();
    expect(hw).toHaveLength(2);
    expect(nt).toHaveLength(3);
    expect(hw.map((h) => h.sourceId).sort()).toEqual(['1198', '1201']);
  });

  it('updates when content changes for same sourceId', async () => {
    const store = new InMemoryNeverSkipStore();
    const base = loadFixture<NeverSkipHomeworkResponse>('homework.json');
    let payload = structuredClone(base);

    const fetchFn = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('getassignmentsapi')) {
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      return new Response(JSON.stringify({ D: { item_list: [] } }), { status: 200 });
    });

    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('test-token'),
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await syncNeverSkip({ client, store });
    payload = structuredClone(base);
    const list = (payload as { D: { item_list: NeverSkipRawAssignment[] } }).D.item_list;
    list[0].assign_details = 'Updated details from school';
    const second = await syncNeverSkip({ client, store });
    expect(second.homeworkUpdated).toBe(1);
    const hw = await store.listHomework();
    expect(hw.find((h) => h.sourceId === '1198')!.description).toContain('Updated details');
  });
});

describe('HTTP client errors', () => {
  it('throws on 401', async () => {
    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('bad'),
      fetchFn: (async () => new Response('unauthorized', { status: 401 })) as typeof fetch,
    });
    await expect(client.postJson('/x', {})).rejects.toBeInstanceOf(NeverSkipHttpError);
    await expect(client.postJson('/x', {})).rejects.toMatchObject({ status: 401 });
  });

  it('throws on 403', async () => {
    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('bad'),
      fetchFn: (async () => new Response('forbidden', { status: 403 })) as typeof fetch,
    });
    await expect(client.postJson('/x', {})).rejects.toMatchObject({ status: 403 });
  });

  it('throws on 500', async () => {
    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('tok'),
      fetchFn: (async () => new Response('err', { status: 500 })) as typeof fetch,
    });
    await expect(client.postJson('/x', {})).rejects.toMatchObject({ status: 500 });
  });

  it('throws timeout error', async () => {
    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('tok'),
      timeoutMs: 10,
      fetchFn: (async (_url, init) => {
        await new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        return new Response('{}');
      }) as typeof fetch,
    });
    await expect(client.postJson('/x', {})).rejects.toBeInstanceOf(NeverSkipTimeoutError);
  });

  it('throws when auth missing', async () => {
    const client = new NeverSkipClient({ auth: new MissingAuth() });
    await expect(client.postJson('/x', {})).rejects.toBeInstanceOf(NeverSkipAuthError);
  });

  it('handles malformed JSON body', async () => {
    const client = new NeverSkipClient({
      auth: new StaticTokenAuth('tok'),
      fetchFn: (async () => new Response('not-json{', { status: 200 })) as typeof fetch,
    });
    await expect(client.postJson('/x', {})).rejects.toBeInstanceOf(NeverSkipHttpError);
  });
});

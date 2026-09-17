import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { StaticTokenAuth, MissingAuth } from '@/lib/neverskip/auth';
import { NeverSkipClient } from '@/lib/neverskip/client';
import { CLASS1_SECTIONS } from '@/lib/class-sections';
import { classifyAssignment } from '@/lib/neverskip/classify';
import { homeworkSourceId, noticeSourceId } from '@/lib/neverskip/ids';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import {
  extractAssignments,
  extractNotices,
  inspectNoticeEnvelope,
  normalizeDate,
  normalizeHomework,
  normalizeNotice,
  normalizeTime,
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
    expect(normalizeDate('15-Sep-2026')).toBe('2026-09-15');
    expect(normalizeDate('15/09/26')).toBe('2026-09-15');
    expect(normalizeDate('15/09/2026')).toBe('2026-09-15');
  });

  it('normalizes Hindi sulekh pustika title and 15-Sep date', () => {
    const norm = normalizeHomework({
      assign_id: 'sep15-hindi',
      subject_name: 'HINDI',
      assign_title: 'उ की मात्रा sulekh pustika',
      assign_details:
        "Namaste Dear Parents and Children Jai Sri Gurudev Today's Hindi Homework (15/09/26) Do Page No 12 (उ की मात्रा) in Sulekh pustika. Submission of book -16/9/26 Thankyou.",
      ass_dt: '15-Sep-2026',
      due_dt: '16-Sep-2026',
      assign_typ: 'Homework',
      class_sec: 'I-A',
    });
    expect(norm).not.toBeNull();
    expect(norm!.homeworkDate).toBe('2026-09-15');
    expect(norm!.dueDate).toBe('2026-09-16');
    expect(norm!.title).toContain('मात्रा');
    expect(norm!.title.toLowerCase()).toContain('sulekh');
  });

  it('normalizes live 15-Sep portal title ए ki Matra sulekh pustika', () => {
    const norm = normalizeHomework({
      assign_id: '1325',
      subject_name: 'HINDI',
      assign_title: 'ए ki Matra sulekh pustika',
      assign_details:
        "Namaste Dear Parents and Children Today's Hindi Homework (15/09/26) Do Page No 12 in Sulekh pustika.",
      ass_dt: '15-Sep-2026',
      assign_typ: 'Homework',
      class_sec: 'I-A',
    });
    expect(norm).not.toBeNull();
    expect(norm!.sourceId).toBe('1325');
    expect(norm!.homeworkDate).toBe('2026-09-15');
    expect(norm!.title).toContain('Matra');
    expect(norm!.title.toLowerCase()).toContain('sulekh');
    expect(norm!.sections).toEqual(['I-A']);
  });

  it('uses assign_id as stable source id', () => {
    expect(homeworkSourceId('1198', '85705')).toBe('1198');
    expect(homeworkSourceId(null, '85705')).toBe('85705');
    expect(homeworkSourceId(null, null)).toBeNull();
  });

  it('defaults untargeted homework to every Class 1 section', () => {
    const norm = normalizeHomework({
      assign_id: 'untargeted-1',
      assign_title: 'Notebook practice',
      ass_dt: '2026-09-11',
    });
    expect(norm!.sections).toEqual([...CLASS1_SECTIONS]);
  });

  it('parses Classes: targeting from homework title', () => {
    const norm = normalizeHomework({
      assign_id: 't-1',
      assign_title: 'Classes: I-A, I-D, I-K',
      ass_dt: '2026-09-11',
    });
    expect(norm!.sections).toEqual(['I-A', 'I-D', 'I-K']);
  });

  it('ignores non-section class_name and still applies Class 1 audience', () => {
    const norm = normalizeHomework({
      assign_id: 't-2',
      assign_title: 'EVS workbook',
      class_name: 'Class 1',
      ass_dt: '2026-09-11',
    });
    expect(norm!.sections).toEqual([...CLASS1_SECTIONS]);
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

  it('parses stringified D.item_list', () => {
    const list = extractNotices({
      S: true,
      D: {
        item_list: JSON.stringify([
          {
            title: '',
            cont: 'Notes for completed chapter are shared in content library.',
            date: '16/09/2026 04:18 PM',
          },
        ]),
      },
    } as unknown as NeverSkipNoticesResponse);
    expect(list).toHaveLength(1);
    const norm = normalizeNotice(list[0]);
    expect(norm!.publishedDate).toBe('2026-09-16');
    expect(norm!.publishedTime).toBe('16:18');
  });

  it('returns empty for empty response', () => {
    expect(extractNotices({})).toEqual([]);
    expect(extractNotices({ D: {} })).toEqual([]);
  });

  it('inspectNoticeEnvelope flags failure and invalid shapes', () => {
    expect(inspectNoticeEnvelope({ S: false, M: 'x' } as NeverSkipNoticesResponse).status).toBe(
      'failure_envelope',
    );
    expect(inspectNoticeEnvelope({ S: true, D: { foo: 1 } } as NeverSkipNoticesResponse).status).toBe(
      'invalid_response',
    );
    expect(
      inspectNoticeEnvelope({ S: true, D: { item_list: [] } } as NeverSkipNoticesResponse).status,
    ).toBe('ok');
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

  it('keeps notices with empty title, missing image, and missing test_tar', () => {
    const norm = normalizeNotice({
      title: '',
      cont: 'EVS Revision paper with answer key has been shared in content library.',
      date: '16/09/2026 04:17 PM',
      image: '',
    });
    expect(norm).not.toBeNull();
    expect(norm!.publishedDate).toBe('2026-09-16');
    expect(norm!.publishedTime).toBe('16:17');
    expect(norm!.title.toLowerCase()).toContain('evs revision');
    expect(norm!.imageUrl).toBeNull();
    expect(norm!.classes).toEqual([]);
  });

  it('parses DD/MM/YYYY as day-first (not MM/DD)', () => {
    expect(normalizeDate('16/09/2026')).toBe('2026-09-16');
    expect(normalizeDate('15/09/2026')).toBe('2026-09-15');
    expect(normalizeDate('05:50 PM | 16/09/2026')).toBe('2026-09-16');
    expect(normalizeDate('16/09/2026 05:50 PM')).toBe('2026-09-16');
    expect(normalizeTime('16/09/2026 05:50 PM')).toBe('17:50');
  });

  it('normalizes multiple notices on the same date', () => {
    const a = normalizeNotice({
      cont: 'English Textbook at home',
      date: '16/09/2026 05:50 PM',
    })!;
    const b = normalizeNotice({
      cont: 'Notes for completed chapter',
      date: '16/09/2026 04:18 PM',
    })!;
    expect(a.publishedDate).toBe('2026-09-16');
    expect(b.publishedDate).toBe('2026-09-16');
    expect(a.sourceId).not.toBe(b.sourceId);
  });

  it('parses audience title Classes: into classes and content-based display title', () => {
    const norm = normalizeNotice({
      title: 'Classes: I-A, I-B, I-G',
      cont: 'Namaste Dear Parents, Today EVS homework is in the class diary.',
      date: '10-09-2026',
      time: '09:15',
    });
    expect(norm!.classes).toEqual(['I-A', 'I-B', 'I-G']);
    expect(norm!.publishedDate).toBe('2026-09-10');
    expect(norm!.title).not.toMatch(/^Classes:/i);
    expect(norm!.title).toContain('EVS homework');
  });

  it('parses NeverSkip notice board stamps', () => {
    expect(normalizeDate('03:51 PM | 11/09/2026')).toBe('2026-09-11');
    expect(normalizeTime('03:51 PM | 11/09/2026')).toBe('15:51');
    expect(normalizeDate('04:02 PM | 10/09/2026')).toBe('2026-09-10');
    const norm = normalizeNotice({
      title: 'Classes: I-A, I-B',
      cont: 'Answer key uploaded to content library.',
      date: '03:51 PM | 11/09/2026',
    });
    expect(norm!.publishedDate).toBe('2026-09-11');
    expect(norm!.publishedTime).toBe('15:51');
    expect(norm!.classes).toEqual(['I-A', 'I-B']);
  });

  it('rejects NeverSkip placeholder due dates', () => {
    expect(normalizeDate('30-Nov--0001')).toBe('');
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
    expect(first.newestHomeworkDate).toBe('2026-09-05');

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

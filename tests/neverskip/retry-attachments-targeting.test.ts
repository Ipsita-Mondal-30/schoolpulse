import { afterEach, describe, expect, it } from 'vitest';
import { backoffDelayMs, isTransientHttpStatus, withRetry } from '@/lib/neverskip/retry';
import {
  attachmentsKey,
  extractHomeworkAttachments,
  extractNoticeAttachments,
  parseAttachmentsJson,
} from '@/lib/neverskip/attachments';
import { normalizeHomework, normalizeNotice } from '@/lib/neverskip/normalizers';
import { mergeHomeworkFromSource } from '@/lib/neverskip/changes';
import { homeworkContentKey } from '@/lib/neverskip/store';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { defaultClass1Audience, isDefaultAudienceRewrite } from '@/lib/class-sections';
import { getIndiaToday } from '@/lib/daily-brief';

const noSleep = async () => {};

describe('withRetry', () => {
  it('retries transient failures and returns the first success', async () => {
    let calls = 0;
    const delays: number[] = [];
    const value = await withRetry(
      async () => {
        calls += 1;
        return calls < 3
          ? { retry: true as const, reason: 'HTTP 503', value: null }
          : { retry: false as const, value: 'ok' };
      },
      { sleep: noSleep, onRetry: ({ delayMs }) => delays.push(delayMs) },
    );
    expect(value).toBe('ok');
    expect(calls).toBe(3);
    expect(delays).toEqual([2000, 4000]);
  });

  it('stops after the attempt cap and returns the last result', async () => {
    let calls = 0;
    const value = await withRetry(
      async () => {
        calls += 1;
        return { retry: true as const, reason: 'network', value: `fail-${calls}` };
      },
      { attempts: 3, sleep: noSleep },
    );
    expect(calls).toBe(3);
    expect(value).toBe('fail-3');
  });

  it('does not retry a final (non-transient) result', async () => {
    let calls = 0;
    await withRetry(
      async () => {
        calls += 1;
        return { retry: false as const, value: 401 };
      },
      { sleep: noSleep },
    );
    expect(calls).toBe(1);
  });

  it('classifies transient HTTP statuses and caps backoff', () => {
    expect(isTransientHttpStatus(503)).toBe(true);
    expect(isTransientHttpStatus(429)).toBe(true);
    expect(isTransientHttpStatus(401)).toBe(false);
    expect(isTransientHttpStatus(404)).toBe(false);
    expect(backoffDelayMs(10, 2000, 15_000)).toBe(15_000);
  });
});

describe('source attachments', () => {
  it('keeps every homework file, not just the first', () => {
    const list = extractHomeworkAttachments({
      download_url: 'https://cdn.example.invalid/hw/a.pdf',
      ass_files: [
        { url: 'https://cdn.example.invalid/hw/b.jpg', name: 'Page 2' },
        { file_url: 'https://cdn.example.invalid/hw/c.pdf' },
        { url: 'https://cdn.example.invalid/hw/a.pdf' },
      ],
    });
    expect(list.map((a) => a.url)).toEqual([
      'https://cdn.example.invalid/hw/a.pdf',
      'https://cdn.example.invalid/hw/b.jpg',
      'https://cdn.example.invalid/hw/c.pdf',
    ]);
    expect(list[1].name).toBe('Page 2');
  });

  it('parses JSON-string and multi-URL string file fields without splitting spaces in names', () => {
    expect(
      extractHomeworkAttachments({
        ass_files: '[{"url":"https://x.invalid/1.pdf"},{"url":"https://x.invalid/2.pdf"}]',
      }).map((a) => a.url),
    ).toEqual(['https://x.invalid/1.pdf', 'https://x.invalid/2.pdf']);
    expect(
      extractHomeworkAttachments({ ass_files: 'https://x.invalid/My File.pdf' }).map((a) => a.url),
    ).toEqual(['https://x.invalid/My File.pdf']);
    expect(
      extractHomeworkAttachments({ ass_files: 'https://x.invalid/1.pdf, https://x.invalid/2.pdf' }).map(
        (a) => a.url,
      ),
    ).toEqual(['https://x.invalid/1.pdf', 'https://x.invalid/2.pdf']);
  });

  it('ignores empty / sentinel values and never invents URLs', () => {
    expect(extractHomeworkAttachments({ download_url: '', ass_files: null })).toEqual([]);
    expect(extractNoticeAttachments({ image: '', title: 'Classes: I-A' })).toEqual([]);
  });

  it('stores notice image and file attachments', () => {
    const notice = normalizeNotice({
      id: 9,
      date: '2026-10-14',
      cont: 'Annual day circular attached',
      title: 'Classes: I-A',
      image: 'https://cdn.example.invalid/n/9.jpg',
      attachments: [{ url: 'https://cdn.example.invalid/n/9.pdf', name: 'Circular' }],
    });
    expect(notice?.attachments?.map((a) => a.url)).toEqual([
      'https://cdn.example.invalid/n/9.jpg',
      'https://cdn.example.invalid/n/9.pdf',
    ]);
  });

  it('round-trips through attachmentsJson and compares order-insensitively', () => {
    const list = [{ url: 'https://x.invalid/b' }, { url: 'https://x.invalid/a', name: 'A' }];
    expect(parseAttachmentsJson(JSON.stringify(list))).toEqual(list);
    expect(parseAttachmentsJson('not json')).toEqual([]);
    expect(attachmentsKey(list)).toEqual(attachmentsKey([...list].reverse()));
  });

  it('a response without attachments does not wipe stored ones', () => {
    const base = normalizeHomework({
      assign_id: 1,
      ass_dt: '2026-10-14',
      assign_title: 'Read',
      download_url: 'https://x.invalid/a.pdf',
      ass_files: [{ url: 'https://x.invalid/b.pdf' }],
    })!;
    const incoming = { ...base, attachmentUrl: null, attachments: [] };
    const merged = mergeHomeworkFromSource(base, incoming);
    expect(merged.attachments).toEqual(base.attachments);
    expect(homeworkContentKey(merged)).toBe(homeworkContentKey(base));
  });
});

describe('untargeted homework audience', () => {
  const original = process.env.SYNCED_CHILD_SECTION;
  afterEach(() => {
    if (original === undefined) delete process.env.SYNCED_CHILD_SECTION;
    else process.env.SYNCED_CHILD_SECTION = original;
  });

  const raw = { assign_id: 77, ass_dt: '2026-10-14', assign_title: 'Revise', assign_details: 'Revise poem' };

  it('uses the synced child section when configured', () => {
    process.env.SYNCED_CHILD_SECTION = 'I-C';
    expect(normalizeHomework(raw)?.sections).toEqual(['I-C']);
  });

  it('keeps explicit source targeting over the synced section', () => {
    process.env.SYNCED_CHILD_SECTION = 'I-C';
    expect(normalizeHomework({ ...raw, class_sec: 'I-A, I-G' })?.sections).toEqual(['I-A', 'I-G']);
  });

  it('falls back to all Class 1 sections when no section is configured', () => {
    delete process.env.SYNCED_CHILD_SECTION;
    expect(normalizeHomework(raw)?.sections).toEqual(defaultClass1Audience());
  });

  it('treats default → synced-section narrowing as ingest noise, not a school change', () => {
    const all = defaultClass1Audience();
    expect(isDefaultAudienceRewrite(all, ['I-C'], 'I-C')).toBe(true);
    expect(isDefaultAudienceRewrite(['I-A'], ['I-C'], 'I-C')).toBe(true);
    expect(isDefaultAudienceRewrite(['I-A'], all, null)).toBe(true);
    expect(isDefaultAudienceRewrite(all, ['I-B'], 'I-C')).toBe(false);
    expect(isDefaultAudienceRewrite(['I-A', 'I-B'], ['I-C'], 'I-C')).toBe(false);
  });

  it('re-syncing old all-section rows with a configured section creates no Updates card', async () => {
    const store = new InMemoryNeverSkipStore();
    const today = getIndiaToday();
    delete process.env.SYNCED_CHILD_SECTION;
    await store.upsertHomework(normalizeHomework({ ...raw, ass_dt: today })!);
    process.env.SYNCED_CHILD_SECTION = 'I-C';
    expect(await store.upsertHomework(normalizeHomework({ ...raw, ass_dt: today })!)).toBe('updated');
    expect(store.listChangeEvents()).toHaveLength(0);
    expect((await store.listHomework())[0].sections).toEqual(['I-C']);
  });
});

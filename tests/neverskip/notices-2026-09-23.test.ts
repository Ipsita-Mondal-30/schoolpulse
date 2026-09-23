import { describe, expect, it } from 'vitest';
import fixture from '@/fixtures/neverskip/notices-2026-09-23.json';
import {
  extractNotices,
  normalizeDate,
  normalizeNotice,
  normalizeTime,
} from '@/lib/neverskip/normalizers';
import { noticeSourceId } from '@/lib/neverskip/ids';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { syncNeverSkipData } from '@/lib/neverskip/sync';
import {
  filterNoticesByClass,
  sortNoticesNewestFirst,
  type UiNoticeItem,
} from '@/lib/ui-merge';
import { buildUpdatesFeed } from '@/lib/updates-feed';

describe('23/09/2026 NeverSkip notice pipeline', () => {
  const raw = extractNotices(fixture as never);
  const normalized = raw
    .map((r) => normalizeNotice(r))
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  it('parses DD/MM/YYYY + AM/PM stamps to 2026-09-23 (not 22)', () => {
    expect(normalizeDate('05:22 PM | 23/09/2026')).toBe('2026-09-23');
    expect(normalizeTime('05:22 PM | 23/09/2026')).toBe('17:22');
    expect(normalized.filter((n) => n.publishedDate === '2026-09-23')).toHaveLength(4);
  });

  it('keeps stable explicit sourceIds (no title-only collision)', () => {
    const ids = normalized.map((n) => n.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('ns-notice-20260923-hindi-olympiad');
    expect(
      noticeSourceId({
        id: 'ns-notice-20260923-hindi-olympiad',
        title: 'ignored',
        content: 'ignored',
      }),
    ).toBe('ns-notice-20260923-hindi-olympiad');
  });

  it('understands Classes: I, II and I-A… targeting for synced child I-A', () => {
    const olympiad = normalized.find((n) => n.sourceId.includes('olympiad'))!;
    expect(olympiad.classes).toEqual(expect.arrayContaining(['I', 'II']));

    const ui: UiNoticeItem[] = normalized.map((n) => ({
      id: n.sourceId,
      date: n.publishedDate,
      time: n.publishedTime,
      classes: n.classes,
      summary: n.summary,
      message: n.content,
    }));
    const forChild = sortNoticesNewestFirst(filterNoticesByClass(ui, 'I-A'));
    expect(forChild[0].date).toBe('2026-09-23');
    expect(forChild[0].time).toBe('17:22');
    expect(forChild.some((n) => /International Hindi Olympiad/i.test(n.message))).toBe(
      true,
    );
    expect(forChild.some((n) => n.date === '2026-09-22')).toBe(true);
  });

  it('sync upserts 23/09 notices then orders them above 22/09', async () => {
    const store = new InMemoryNeverSkipStore();
    const summary = await syncNeverSkipData({
      homework: [],
      notices: raw,
      store,
      label: 'fixture-23sep',
    });
    expect(summary.noticesInserted + summary.noticesUpdated).toBeGreaterThanOrEqual(4);

    const stored = await store.listNotices();
    const newest = [...stored].sort((a, b) => {
      const ak = `${a.publishedDate}T${a.publishedTime || '00:00'}`;
      const bk = `${b.publishedDate}T${b.publishedTime || '00:00'}`;
      return bk.localeCompare(ak);
    })[0];
    expect(newest.publishedDate).toBe('2026-09-23');
    expect(newest.publishedTime).toBe('17:22');
  });

  it('Updates feed surfaces 23/09 as NEW above 22/09 recent', () => {
    const since = new Date('2026-09-16T00:00:00+05:30');
    const feed = buildUpdatesFeed({
      since,
      activitySinceYmd: '2026-09-16',
      publishedSinceYmd: '2026-09-16',
      homework: [],
      notices: normalized.map((n) => ({
        id: n.sourceId,
        source: n.source,
        sourceId: n.sourceId,
        title: n.title,
        summary: n.summary,
        content: n.content,
        createdAt: new Date('2026-09-23T12:00:00+05:30'),
        publishedDate: n.publishedDate,
        publishedTime: n.publishedTime,
        classes: n.classes,
      })),
      changes: [],
    });

    const recent = feed.filter((i) => i.section === 'recent' || i.kind === 'new');
    expect(recent.length).toBeGreaterThan(0);
    const topNotice = recent.find((i) => i.type === 'notice');
    expect(topNotice?.sourceDate).toBe('2026-09-23');
  });
});

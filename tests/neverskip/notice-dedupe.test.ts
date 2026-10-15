import { describe, expect, it } from 'vitest';
import { dedupeNoticeRows, noticeDedupeKey } from '@/lib/neverskip/notice-dedupe';

describe('notice dedupe (portal whitespace drift)', () => {
  const stored = {
    id: 'old',
    publishedDate: '2026-09-25',
    publishedTime: '10:12',
    content: 'Jai Sri Gurudev Namaste Dear Parents, Kindly be informed that school remains closed.',
  };
  const live = {
    id: 'new',
    publishedDate: '2026-09-25',
    publishedTime: '10:12',
    content: 'Jai Sri Gurudev \nNamaste Dear Parents, \n\nKindly be informed that school remains closed.',
  };

  it('treats line-break vs collapsed whitespace as the same notice', () => {
    expect(noticeDedupeKey(stored)).toBe(noticeDedupeKey(live));
  });

  it('keeps the first row (newest import) and drops the drifted duplicate', () => {
    expect(dedupeNoticeRows([live, stored]).map((r) => r.id)).toEqual(['new']);
  });

  it('keeps notices that differ in date, time or wording', () => {
    const otherTime = { ...stored, id: 'b', publishedTime: '11:00' };
    const otherDay = { ...stored, id: 'c', publishedDate: '2026-09-26' };
    const otherText = { ...stored, id: 'd', content: 'School reopens on Monday.' };
    expect(dedupeNoticeRows([stored, otherTime, otherDay, otherText])).toHaveLength(4);
  });

  it('never merges notices with empty content', () => {
    const a = { id: 'a', publishedDate: '', publishedTime: '', content: '' };
    expect(dedupeNoticeRows([a, { ...a, id: 'b' }])).toHaveLength(2);
  });
});

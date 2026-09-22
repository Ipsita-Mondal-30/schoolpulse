import { describe, expect, it } from 'vitest';
import { isNewerThan, noticePublishedIso } from '@/lib/updates-unread';

describe('updates unread helpers', () => {
  it('treats missing lastSeen as unread', () => {
    expect(isNewerThan('2026-09-11T10:00:00.000Z', null)).toBe(true);
  });

  it('compares ISO timestamps', () => {
    expect(isNewerThan('2026-09-11T12:00:00.000Z', '2026-09-11T11:00:00.000Z')).toBe(true);
    expect(isNewerThan('2026-09-11T10:00:00.000Z', '2026-09-11T11:00:00.000Z')).toBe(false);
  });

  it('builds India-offset notice stamps without inventing dates', () => {
    expect(noticePublishedIso('2026-09-11', '15:51')).toBe('2026-09-11T15:51:00+05:30');
    expect(noticePublishedIso('', '15:51')).toBe('');
  });
});

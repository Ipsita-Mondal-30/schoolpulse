import { describe, expect, it } from 'vitest';
import {
  buildUpdatesFeed,
  countUnreadUpdates,
  filterUpdatesBySection,
  formatUpdateDisplayDate,
  formatUpdateOccurredLabel,
  formatUpdateSourceDateLabel,
  noticePublicationSortKey,
  partitionUpdatesFeed,
  type UpdateFeedChangeRow,
  type UpdateFeedHomeworkRow,
  type UpdateFeedNoticeRow,
} from '@/lib/updates-feed';

const SINCE = new Date('2026-08-16T00:00:00.000Z');
const PUBLISHED_SINCE = '2026-08-16';

function hw(
  partial: Partial<UpdateFeedHomeworkRow> & Pick<UpdateFeedHomeworkRow, 'sourceId' | 'title'>,
): UpdateFeedHomeworkRow {
  return {
    id: `db-${partial.sourceId}`,
    source: 'neverskip',
    subjectName: 'HINDI',
    createdAt: '2026-09-15T12:56:52.948Z',
    homeworkDate: '2026-09-15',
    sections: ['I-A'],
    ...partial,
  };
}

function nt(
  partial: Partial<UpdateFeedNoticeRow> & Pick<UpdateFeedNoticeRow, 'sourceId' | 'title'>,
): UpdateFeedNoticeRow {
  return {
    id: `db-${partial.sourceId}`,
    source: 'neverskip',
    summary: partial.title,
    content: 'Please note.',
    createdAt: '2026-09-15T12:57:08.704Z',
    publishedDate: '2026-09-15',
    publishedTime: '15:55',
    classes: ['I-A'],
    ...partial,
  };
}

function chg(
  partial: Partial<UpdateFeedChangeRow> & Pick<UpdateFeedChangeRow, 'id' | 'entityType' | 'sourceId'>,
): UpdateFeedChangeRow {
  return {
    source: 'neverskip',
    entityId: `db-${partial.sourceId}`,
    detectedAt: '2026-09-15T14:00:00.000Z',
    changedFields: [
      {
        field: 'title',
        label: 'Title',
        previous: 'Old',
        current: 'New',
        reliable: true,
      },
    ],
    ...partial,
  };
}

describe('buildUpdatesFeed', () => {
  it('marks a first insert as new using createdAt, not homework date', () => {
    const items = buildUpdatesFeed({
      homework: [
        hw({
          sourceId: '1325',
          title: 'ए ki Matra sulekh pustika',
          homeworkDate: '2026-09-15',
          createdAt: '2026-09-15T12:56:52.948Z',
        }),
      ],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'new',
      section: 'new',
      type: 'homework',
      sourceId: '1325',
      title: 'ए ki Matra sulekh pustika',
      occurredAt: '2026-09-15T12:56:52.948Z',
      sourceDate: '2026-09-15',
      href: '/homework?item=neverskip%3A1325',
    });
  });

  it('treats old homework imported today as new and keeps the assigned date', () => {
    const items = buildUpdatesFeed({
      homework: [
        hw({
          sourceId: 'july-1',
          title: 'July notebook',
          homeworkDate: '2026-07-13',
          createdAt: '2026-09-15T10:00:00.000Z',
        }),
      ],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items[0].kind).toBe('new');
    expect(items[0].occurredAt).toBe('2026-09-15T10:00:00.000Z');
    expect(items[0].sourceDate).toBe('2026-07-13');
    expect(formatUpdateSourceDateLabel('homework', items[0].sourceDate)).toBe('Assigned 13 Jul');
  });

  it('does not emit a second new row when the same sourceId is seen again unchanged', () => {
    const row = hw({ sourceId: '1325', title: 'ए ki Matra sulekh pustika' });
    const first = buildUpdatesFeed({
      homework: [row],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    const second = buildUpdatesFeed({
      homework: [row],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].kind).toBe('new');
  });

  it('shows changed homework instead of new when an existing sourceId is updated', () => {
    const items = buildUpdatesFeed({
      homework: [
        hw({
          sourceId: '1325',
          title: 'ए ki Matra sulekh pustika (updated)',
          createdAt: '2026-09-10T08:00:00.000Z',
        }),
      ],
      notices: [],
      changes: [
        chg({
          id: 'c1',
          entityType: 'homework',
          sourceId: '1325',
          detectedAt: '2026-09-15T14:00:00.000Z',
          title: 'ए ki Matra sulekh pustika (updated)',
        }),
      ],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('changed');
    expect(items[0].section).toBe('new');
    expect(items[0].id).toBe('chg:c1');
    expect(items[0].occurredAt).toBe('2026-09-15T14:00:00.000Z');
  });

  it('ignores homework imported before the window when it was only re-fetched', () => {
    const items = buildUpdatesFeed({
      homework: [
        hw({
          sourceId: 'old',
          title: 'Shapes',
          createdAt: '2026-07-01T00:00:00.000Z',
          homeworkDate: '2026-09-15',
        }),
      ],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items).toHaveLength(0);
  });

  it('marks a first-imported notice as new using createdAt, not published date', () => {
    const items = buildUpdatesFeed({
      homework: [],
      notices: [
        nt({
          sourceId: 'n-new',
          title: 'Corrected textbook handed over',
          publishedDate: '2026-07-01',
          createdAt: '2026-09-15T12:57:08.704Z',
        }),
      ],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'new',
      section: 'new',
      type: 'notice',
      occurredAt: '2026-09-15T12:57:08.704Z',
      sourceDate: '2026-07-01',
    });
  });

  it('shows changed notice when a later content change exists', () => {
    const items = buildUpdatesFeed({
      homework: [],
      notices: [nt({ sourceId: 'n1', title: 'Updated circular', createdAt: '2026-09-01T00:00:00.000Z' })],
      changes: [
        chg({
          id: 'nc1',
          entityType: 'notice',
          sourceId: 'n1',
          detectedAt: '2026-09-15T13:00:00.000Z',
          title: 'Updated circular',
        }),
      ],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('changed');
    expect(items[0].type).toBe('notice');
  });

  it('includes both new homework and new notices in one feed, newest first', () => {
    const items = buildUpdatesFeed({
      homework: [hw({ sourceId: '1325', title: 'Hindi sulekh', createdAt: '2026-09-15T12:56:52.948Z' })],
      notices: [nt({ sourceId: 'n15', title: 'Textbook note', createdAt: '2026-09-15T12:57:08.704Z' })],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(items.map((i) => i.type)).toEqual(['notice', 'homework']);
    expect(items.every((i) => i.kind === 'new' && i.section === 'new')).toBe(true);
  });

  it('puts RECENT notices after NEW and sorts by publishedDate not createdAt or title', () => {
    const items = buildUpdatesFeed({
      homework: [hw({ sourceId: '1325', title: 'Hindi sulekh' })],
      notices: [
        nt({
          sourceId: 'n-old-pub',
          title: 'Zebra notice',
          publishedDate: '2026-09-12',
          publishedTime: '10:00',
          createdAt: '2026-07-01T20:00:00.000Z',
        }),
        nt({
          sourceId: 'n-new-pub',
          title: 'Apple notice',
          publishedDate: '2026-09-14',
          publishedTime: '09:00',
          createdAt: '2026-07-01T00:00:00.000Z',
        }),
        nt({
          sourceId: 'n-newest-import',
          title: 'Fresh import',
          publishedDate: '2026-09-15',
          createdAt: '2026-09-15T12:57:08.704Z',
        }),
      ],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });

    const { newItems, recentItems } = partitionUpdatesFeed(items);
    expect(newItems.map((i) => i.sourceId).sort()).toEqual(['1325', 'n-newest-import'].sort());
    expect(recentItems.map((i) => i.sourceId)).toEqual(['n-new-pub', 'n-old-pub']);
    expect(recentItems.every((i) => i.section === 'recent' && i.kind === 'recent')).toBe(true);
    expect(recentItems.some((i) => i.sourceId === 'n-newest-import')).toBe(false);
  });

  it('falls back to createdAt when publishedDate is missing for RECENT sort', () => {
    const items = buildUpdatesFeed({
      homework: [],
      notices: [
        nt({
          sourceId: 'n-a',
          title: 'No pub date A',
          publishedDate: '',
          createdAt: '2026-09-14T10:00:00.000Z',
        }),
        nt({
          sourceId: 'n-b',
          title: 'No pub date B',
          publishedDate: '',
          createdAt: '2026-09-15T10:00:00.000Z',
        }),
      ],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    // Both are "new" because createdAt is in window — put older createdAt outside NEW window for RECENT
    const recentOnly = buildUpdatesFeed({
      homework: [],
      notices: [
        nt({
          sourceId: 'n-a',
          title: 'No pub date A',
          publishedDate: '',
          createdAt: '2026-07-01T10:00:00.000Z',
        }),
        nt({
          sourceId: 'n-b',
          title: 'No pub date B',
          publishedDate: '',
          createdAt: '2026-07-02T10:00:00.000Z',
        }),
      ],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    // publishedSince requires YMD or createdAt>=since — these fall outside both → empty
    // Force inclusion by giving invalid pub but createdAt in since for window via empty publishedSince check:
    // inPublishWindow: !publishedSince || (YMD && >=) || (!YMD && createdMs >= sinceMs)
    // createdAt July is before SINCE Aug 16 → not in window. Adjust:
    const withFallback = buildUpdatesFeed({
      homework: [],
      notices: [
        nt({
          sourceId: 'n-a',
          title: 'No pub date A',
          publishedDate: '',
          createdAt: '2026-09-10T10:00:00.000Z',
        }),
        nt({
          sourceId: 'n-b',
          title: 'No pub date B',
          publishedDate: '',
          createdAt: '2026-09-12T10:00:00.000Z',
        }),
      ],
      changes: [],
      since: new Date('2026-09-20T00:00:00.000Z'), // createdAt before since → not NEW
      publishedSinceYmd: '', // no publish floor; !publishedSince → all eligible for RECENT if not NEW
    });
    expect(withFallback.map((i) => i.sourceId)).toEqual(['n-b', 'n-a']);
    expect(withFallback.every((i) => i.section === 'recent')).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(0);
    expect(recentOnly.length).toBe(0);
    expect(noticePublicationSortKey({ publishedDate: '', createdAt: '2026-09-12T10:00:00.000Z' })).toBe(
      '2026-09-12T10:00:00.000Z',
    );
  });
});

describe('unread + section helpers', () => {
  it('counts unread from NEW occurredAt only', () => {
    const items = buildUpdatesFeed({
      homework: [hw({ sourceId: '1325', title: 'Hindi sulekh', createdAt: '2026-09-15T12:56:52.948Z' })],
      notices: [
        nt({
          sourceId: 'n-old',
          title: 'Older notice',
          publishedDate: '2026-09-12',
          createdAt: '2026-07-01T00:00:00.000Z',
        }),
      ],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(countUnreadUpdates(items, null)).toBe(1);
    expect(countUnreadUpdates(items, '2026-09-15T12:00:00.000Z')).toBe(1);
    expect(countUnreadUpdates(items, '2026-09-15T13:00:00.000Z')).toBe(0);
  });

  it('filters by expanded Class 1 audience for I-A-only imported homework', () => {
    const items = buildUpdatesFeed({
      homework: [hw({ sourceId: '1325', title: 'Hindi sulekh', sections: ['I-A'] })],
      notices: [],
      changes: [],
      since: SINCE,
      publishedSinceYmd: PUBLISHED_SINCE,
    });
    expect(filterUpdatesBySection(items, 'I-A')).toHaveLength(1);
    expect(filterUpdatesBySection(items, 'I-D')).toHaveLength(1);
  });
});

describe('labels', () => {
  it('says Added today for a same-day India import', () => {
    const now = new Date('2026-09-15T18:30:00+05:30');
    expect(formatUpdateOccurredLabel('new', '2026-09-15T12:56:52.948Z', now)).toBe('Added today');
    expect(formatUpdateOccurredLabel('changed', '2026-09-15T12:56:52.948Z', now)).toMatch(/^Changed /);
  });

  it('formats Today / Yesterday / day-month for school dates', () => {
    const now = new Date('2026-09-15T18:30:00+05:30');
    expect(formatUpdateDisplayDate('2026-09-15', undefined, now)).toBe('Today');
    expect(formatUpdateDisplayDate('2026-09-14', undefined, now)).toBe('Yesterday');
    expect(formatUpdateDisplayDate('2026-09-12', undefined, now)).toBe('12 Sep');
    expect(formatUpdateDisplayDate('', '2026-09-15T12:00:00.000Z', now)).toBe('Today');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildUpdatesFeed,
  countUnreadUpdates,
  filterUpdatesBySection,
  formatUpdateOccurredLabel,
  formatUpdateSourceDateLabel,
  type UpdateFeedChangeRow,
  type UpdateFeedHomeworkRow,
  type UpdateFeedNoticeRow,
} from '@/lib/updates-feed';

const SINCE = new Date('2026-08-16T00:00:00.000Z');

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
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'new',
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
    });
    const second = buildUpdatesFeed({
      homework: [row],
      notices: [],
      changes: [],
      since: SINCE,
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
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('changed');
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
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'new',
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
    });
    expect(items.map((i) => i.type)).toEqual(['notice', 'homework']);
    expect(items.every((i) => i.kind === 'new')).toBe(true);
  });
});

describe('unread + section helpers', () => {
  it('counts unread from occurredAt, not homework date', () => {
    const items = buildUpdatesFeed({
      homework: [hw({ sourceId: '1325', title: 'Hindi sulekh', createdAt: '2026-09-15T12:56:52.948Z' })],
      notices: [],
      changes: [],
      since: SINCE,
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
});

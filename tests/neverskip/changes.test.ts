import { describe, expect, it } from 'vitest';
import {
  formatRelativeTimeIndia,
  getMeaningfulHomeworkChanges,
  getMeaningfulNoticeChanges,
  presentChangeLines,
  userVisibleChanges,
} from '@/lib/neverskip/changes';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import type { NormalizedHomework, NormalizedNotice } from '@/lib/neverskip/types';

function hw(
  partial: Partial<NormalizedHomework> & Pick<NormalizedHomework, 'sourceId' | 'title'>,
): NormalizedHomework {
  return {
    source: 'neverskip',
    refId: null,
    subjectId: null,
    subjectName: 'Mathematics',
    description: '',
    sections: ['I-A'],
    homeworkDate: '2026-09-10',
    dueDate: '2026-09-12',
    attachmentUrl: null,
    ...partial,
  };
}

function nt(
  partial: Partial<NormalizedNotice> & Pick<NormalizedNotice, 'sourceId' | 'title'>,
): NormalizedNotice {
  return {
    source: 'neverskip',
    summary: '',
    content: 'Hello',
    publishedDate: '2026-09-10',
    publishedTime: '00:00',
    classes: ['I-A'],
    imageUrl: null,
    ...partial,
  };
}

describe('getMeaningfulHomeworkChanges', () => {
  it('detects title change with reliable previous', () => {
    const changes = getMeaningfulHomeworkChanges(
      hw({ sourceId: '1', title: 'Exercise 4.2' }),
      hw({ sourceId: '1', title: 'Exercise 4.3' }),
    );
    const title = changes.find((c) => c.field === 'title');
    expect(title).toMatchObject({
      previous: 'Exercise 4.2',
      current: 'Exercise 4.3',
      reliable: true,
    });
  });

  it('detects description change', () => {
    const changes = getMeaningfulHomeworkChanges(
      hw({ sourceId: '1', title: 'T', description: 'Page 12' }),
      hw({ sourceId: '1', title: 'T', description: 'Pages 12–13' }),
    );
    expect(changes.some((c) => c.field === 'description')).toBe(true);
  });

  it('detects due date change when both reliable', () => {
    const changes = getMeaningfulHomeworkChanges(
      hw({ sourceId: '1', title: 'T', dueDate: '2026-09-12' }),
      hw({ sourceId: '1', title: 'T', dueDate: '2026-09-13' }),
    );
    const due = changes.find((c) => c.field === 'dueDate');
    expect(due).toMatchObject({
      previous: '2026-09-12',
      current: '2026-09-13',
      reliable: true,
    });
  });

  it('does not invent due date change when both missing', () => {
    const changes = getMeaningfulHomeworkChanges(
      hw({ sourceId: '1', title: 'T', dueDate: null }),
      hw({ sourceId: '1', title: 'T', dueDate: null }),
    );
    expect(changes.find((c) => c.field === 'dueDate')).toBeUndefined();
  });

  it('returns multiple fields in one diff', () => {
    const changes = getMeaningfulHomeworkChanges(
      hw({ sourceId: '1', title: 'A', description: 'Old', dueDate: '2026-09-12' }),
      hw({ sourceId: '1', title: 'B', description: 'New', dueDate: '2026-09-13' }),
    );
    expect(changes.map((c) => c.field).sort()).toEqual([
      'description',
      'dueDate',
      'title',
    ]);
  });
});

describe('getMeaningfulNoticeChanges', () => {
  it('detects title and content changes', () => {
    const changes = getMeaningfulNoticeChanges(
      nt({ sourceId: 'n1', title: 'Assembly', content: 'Old' }),
      nt({ sourceId: 'n1', title: 'Assembly Updated', content: 'New' }),
    );
    expect(changes.some((c) => c.field === 'title')).toBe(true);
    expect(changes.some((c) => c.field === 'content')).toBe(true);
  });
});

describe('presentChangeLines', () => {
  it('shows A→B only when previous is reliable', () => {
    const lines = presentChangeLines('homework', [
      {
        field: 'dueDate',
        label: 'Due date',
        previous: '2026-09-12',
        current: '2026-09-13',
        reliable: true,
      },
    ]);
    expect(lines[0].showDiff).toBe(true);
    expect(lines[0].previous).toContain('Sep');
    expect(lines[0].current).toContain('Sep');
  });

  it('uses generic copy when previous not reliable', () => {
    const lines = presentChangeLines('homework', [
      {
        field: 'title',
        label: 'Title',
        previous: null,
        current: 'X',
        reliable: false,
      },
    ]);
    expect(lines[0].showDiff).toBe(false);
    expect(lines[0].heading).toMatch(/updated/i);
  });
});

describe('formatRelativeTimeIndia', () => {
  it('formats recent minutes', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const at = new Date('2026-09-10T11:30:00.000Z');
    expect(formatRelativeTimeIndia(at, now)).toBe('30m ago');
  });
});

describe('InMemoryNeverSkipStore change events', () => {
  it('new homework does NOT create a change', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: 'New' }));
    expect(store.listChangeEvents()).toHaveLength(0);
  });

  it('new notice does NOT create a change', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertNotice(nt({ sourceId: 'n', title: 'New' }));
    expect(store.listChangeEvents()).toHaveLength(0);
  });

  it('identical homework sync creates no change', async () => {
    const store = new InMemoryNeverSkipStore();
    const item = hw({ sourceId: 'a', title: 'Same' });
    await store.upsertHomework(item);
    expect(await store.upsertHomework(item)).toBe('unchanged');
    expect(store.listChangeEvents()).toHaveLength(0);
  });

  it('identical notice sync creates no change', async () => {
    const store = new InMemoryNeverSkipStore();
    const item = nt({ sourceId: 'n', title: 'Same' });
    await store.upsertNotice(item);
    expect(await store.upsertNotice(item)).toBe('unchanged');
    expect(store.listChangeEvents()).toHaveLength(0);
  });

  it('homework title change creates exactly one event', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: 'Exercise 4.2' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: 'Exercise 4.3' }));
    expect(store.listChangeEvents()).toHaveLength(1);
    expect(store.listChangeEvents()[0].changedFields.some((c) => c.field === 'title')).toBe(
      true,
    );
  });

  it('homework description change creates exactly one event', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'T', description: 'Old' }),
    );
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'T', description: 'New' }),
    );
    expect(store.listChangeEvents()).toHaveLength(1);
  });

  it('homework due-date change creates one event', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'T', dueDate: '2026-09-12' }),
    );
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'T', dueDate: '2026-09-13' }),
    );
    const ev = store.listChangeEvents()[0];
    expect(ev.changedFields.find((c) => c.field === 'dueDate')?.previous).toBe(
      '2026-09-12',
    );
  });

  it('notice title change creates a change', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertNotice(nt({ sourceId: 'n', title: 'A' }));
    await store.upsertNotice(nt({ sourceId: 'n', title: 'B' }));
    expect(store.listChangeEvents()).toHaveLength(1);
    expect(store.listChangeEvents()[0].entityType).toBe('notice');
  });

  it('notice content change creates a change', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertNotice(nt({ sourceId: 'n', title: 'A', content: '1' }));
    await store.upsertNotice(nt({ sourceId: 'n', title: 'A', content: '2' }));
    expect(store.listChangeEvents()).toHaveLength(1);
  });

  it('multiple fields changing creates one event with multiple fields', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'A', description: 'D1', dueDate: '2026-09-12' }),
    );
    await store.upsertHomework(
      hw({ sourceId: 'a', title: 'B', description: 'D2', dueDate: '2026-09-13' }),
    );
    expect(store.listChangeEvents()).toHaveLength(1);
    expect(store.listChangeEvents()[0].changedFields.length).toBeGreaterThanOrEqual(3);
  });

  it('repeated sync after a change does not create duplicate events', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: '4.2' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: '4.3' }));
    expect(await store.upsertHomework(hw({ sourceId: 'a', title: '4.3' }))).toBe(
      'unchanged',
    );
    expect(store.listChangeEvents()).toHaveLength(1);
  });

  it('4.2 → 4.3 → 4.2 produces two genuine change events', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: '4.2' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: '4.3' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: '4.2' }));
    expect(store.listChangeEvents()).toHaveLength(2);
    expect(store.listChangeEvents()[0].changedFields.find((c) => c.field === 'title')?.current).toBe(
      '4.3',
    );
    expect(store.listChangeEvents()[1].changedFields.find((c) => c.field === 'title')?.current).toBe(
      '4.2',
    );
  });

  it('old value is shown only when reliably stored', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: 'Old Title' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: 'New Title' }));
    const titleChange = store.listChangeEvents()[0].changedFields.find(
      (c) => c.field === 'title',
    )!;
    expect(titleChange.previous).toBe('Old Title');
    expect(titleChange.reliable).toBe(true);
    const lines = presentChangeLines('homework', [titleChange]);
    expect(lines[0].showDiff).toBe(true);
  });

  it('snapshots do not contain secrets/tokens', async () => {
    const store = new InMemoryNeverSkipStore();
    await store.upsertHomework(hw({ sourceId: 'a', title: 'T' }));
    await store.upsertHomework(hw({ sourceId: 'a', title: 'U' }));
    const ev = store.listChangeEvents()[0];
    const blob = `${ev.previousSnapshotJson}${ev.currentSnapshotJson}${JSON.stringify(ev.changedFields)}`;
    expect(blob.toLowerCase()).not.toMatch(/password|cookie|authorization|database_url|token/);
  });

  it('userVisibleChanges hides internal subjectId', () => {
    const visible = userVisibleChanges('homework', [
      {
        field: 'subjectId',
        label: 'Subject id',
        previous: '1',
        current: '2',
        reliable: true,
      },
      {
        field: 'title',
        label: 'Title',
        previous: 'A',
        current: 'B',
        reliable: true,
      },
    ]);
    expect(visible.map((c) => c.field)).toEqual(['title']);
  });
});

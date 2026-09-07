import { describe, expect, it } from 'vitest';
import {
  filterHomeworkBySection,
  filterNoticesByClass,
  mergeHomeworkItems,
  mergeNoticeItems,
  resolveNoticeClassesForUi,
  resolveNoticeDateForUi,
  sortHomeworkDatesNewestFirst,
  sortNoticesNewestFirst,
  toSortableDate,
  type UiHomeworkItem,
  type UiNoticeItem,
} from '@/lib/ui-merge';

function hw(partial: Partial<UiHomeworkItem> & Pick<UiHomeworkItem, 'id'>): UiHomeworkItem {
  return {
    title: partial.title ?? `Title ${partial.id}`,
    subject: partial.subject ?? 'English',
    sections: partial.sections ?? ['I-A'],
    description: partial.description ?? `Desc ${partial.id}`,
    sentDate: partial.sentDate ?? '2026-09-01',
    submissionDate: partial.submissionDate,
    attachmentImage: partial.attachmentImage,
    ...partial,
    id: partial.id,
  };
}

function nt(partial: Partial<UiNoticeItem> & Pick<UiNoticeItem, 'id'>): UiNoticeItem {
  return {
    date: partial.date ?? '2026-09-01',
    time: partial.time ?? '10:00',
    classes: partial.classes ?? ['I-A'],
    summary: partial.summary ?? `Summary ${partial.id}`,
    message: partial.message ?? `Message ${partial.id}`,
    ...partial,
    id: partial.id,
  };
}

describe('toSortableDate', () => {
  it('handles ISO and named day formats', () => {
    expect(toSortableDate('2026-09-04')).toBe('2026-09-04');
    expect(toSortableDate('4-Sep-2026')).toBe('2026-09-04');
    expect(toSortableDate('04/09/2026')).toBe('2026-09-04');
  });
});

describe('mergeHomeworkItems', () => {
  it('shows DB-only homework', () => {
    const merged = mergeHomeworkItems([hw({ id: 'db-1', sentDate: '2026-08-31' })], [], []);
    expect(merged.map((h) => h.id)).toEqual(['db-1']);
  });

  it('shows JSON-only homework', () => {
    const merged = mergeHomeworkItems([], [], [hw({ id: 'json-1', sentDate: '2026-07-20' })]);
    expect(merged.map((h) => h.id)).toEqual(['json-1']);
  });

  it('merges DB + JSON homework', () => {
    const merged = mergeHomeworkItems(
      [hw({ id: 'db-1', sentDate: '2026-09-04' })],
      [],
      [hw({ id: 'json-1', sentDate: '2026-07-20' })],
    );
    expect(merged.map((h) => h.id).sort()).toEqual(['db-1', 'json-1']);
  });

  it('dedupes duplicate homework by id and by content', () => {
    const a = hw({
      id: 'db-1',
      title: 'Same',
      subject: 'Maths',
      description: 'Body',
      sentDate: '2026-09-01',
    });
    const sameContent = hw({
      id: 'json-dup',
      title: 'Same',
      subject: 'Maths',
      description: 'Body',
      sentDate: '2026-09-01',
    });
    const sameId = hw({ id: 'db-1', title: 'Other', sentDate: '2026-08-01' });
    const merged = mergeHomeworkItems([a], [], [sameContent, sameId]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('db-1');
  });
});

describe('mergeNoticeItems', () => {
  it('shows DB-only notice', () => {
    const merged = mergeNoticeItems([nt({ id: 'db-n1' })], []);
    expect(merged.map((n) => n.id)).toEqual(['db-n1']);
  });

  it('shows JSON-only notice', () => {
    const merged = mergeNoticeItems([], [nt({ id: 'json-n1' })]);
    expect(merged.map((n) => n.id)).toEqual(['json-n1']);
  });

  it('merges DB + JSON notices', () => {
    const merged = mergeNoticeItems(
      [nt({ id: 'db-n1', date: '2026-09-07' })],
      [nt({ id: 'json-n1', date: '2026-07-20' })],
    );
    expect(merged.map((n) => n.id).sort()).toEqual(['db-n1', 'json-n1']);
  });

  it('dedupes duplicate notices', () => {
    const a = nt({
      id: 'db-n1',
      date: '2026-09-07',
      time: '09:00',
      summary: 'S',
      message: 'M',
    });
    const dupContent = nt({
      id: 'json-n2',
      date: '2026-09-07',
      time: '09:00',
      summary: 'S',
      message: 'M',
    });
    expect(mergeNoticeItems([a], [dupContent])).toHaveLength(1);
  });
});

describe('sorting', () => {
  it('sorts September 2026 before August/July 2026 for notices', () => {
    const sorted = sortNoticesNewestFirst([
      nt({ id: 'jul', date: '2026-07-20' }),
      nt({ id: 'sep', date: '2026-09-04' }),
      nt({ id: 'aug', date: '2026-08-31' }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['sep', 'aug', 'jul']);
  });

  it('sorts homework dates newest first including mixed formats', () => {
    expect(
      sortHomeworkDatesNewestFirst(['2026-07-20', '4-Sep-2026', '2026-08-31']),
    ).toEqual(['4-Sep-2026', '2026-08-31', '2026-07-20']);
  });

  it('sinks blank notice dates below dated ones', () => {
    const sorted = sortNoticesNewestFirst([
      nt({ id: 'blank', date: '' }),
      nt({ id: 'sep', date: '2026-09-04' }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['sep', 'blank']);
  });
});

describe('class / section filters', () => {
  it('shows Class I-A homework for I-A', () => {
    const items = [
      hw({ id: 'a', sections: ['I-A'] }),
      hw({ id: 'b', sections: ['I-B'] }),
    ];
    expect(filterHomeworkBySection(items, 'I-A').map((h) => h.id)).toEqual(['a']);
  });

  it('All sections includes imported I-A records', () => {
    const items = [
      hw({ id: 'imported-ia', sections: ['I-A'], sentDate: '2026-09-04' }),
      hw({ id: 'ib', sections: ['I-B'] }),
    ];
    expect(filterHomeworkBySection(items, 'ALL').map((h) => h.id).sort()).toEqual([
      'ib',
      'imported-ia',
    ]);
  });

  it('shows Class I-A notices for I-A and All', () => {
    const items = [
      nt({ id: 'ia', classes: ['I-A'], date: '2026-09-07' }),
      nt({ id: 'ib', classes: ['I-B'], date: '2026-09-07' }),
    ];
    expect(filterNoticesByClass(items, 'I-A').map((n) => n.id)).toEqual(['ia']);
    expect(filterNoticesByClass(items, 'All').map((n) => n.id).sort()).toEqual(['ia', 'ib']);
  });
});

describe('resolveNoticeDateForUi / classes', () => {
  it('falls back to createdAt when publishedDate is empty', () => {
    expect(
      resolveNoticeDateForUi({
        publishedDate: '',
        createdAt: new Date(2026, 8, 7, 12, 0, 0),
      }),
    ).toBe('2026-09-07');
  });

  it('parses I-A from Classes: title text', () => {
    expect(resolveNoticeClassesForUi([], 'Classes: I-A, I-B, I-K')).toEqual(
      expect.arrayContaining(['I-A', 'I-B', 'I-K']),
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildHomeworkPayload,
  extractHomeworkPagination,
  fetchAllHomeworkPages,
  mergeHomeworkPageItems,
  shouldFetchNextHomeworkPage,
} from '@/lib/neverskip/homework';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { syncNeverSkipData } from '@/lib/neverskip/sync';
import type { NeverSkipHomeworkResponse, NeverSkipRawAssignment } from '@/lib/neverskip/types';

function hwItem(id: string, title = `HW ${id}`): NeverSkipRawAssignment {
  return {
    assign_id: id,
    refid: `r${id}`,
    subject_name: 'English',
    assign_title: title,
    assign_details: `Details ${id}`,
    assign_typ: 'Homework',
    ass_dt: '2026-09-01',
    class_sec: 'I-A',
  };
}

function pageEnvelope(
  items: NeverSkipRawAssignment[],
  meta: Partial<{ page_count: number; total_count: number; sfile_limit: number }> = {},
): NeverSkipHomeworkResponse {
  return {
    S: true,
    D: {
      item_list: items,
      page_count: meta.page_count,
      total_count: meta.total_count,
      sfile_limit: meta.sfile_limit,
    },
    F: 'S',
    data: [],
  };
}

describe('homework pagination helpers', () => {
  it('builds zero-based page payloads like the portal', () => {
    expect(buildHomeworkPayload(0)).toEqual({
      values: '',
      page: '0',
      pg_key: 'CD',
      works: '',
      limit: 0,
    });
    expect(buildHomeworkPayload(2).page).toBe('2');
  });

  it('extracts pagination metadata', () => {
    const meta = extractHomeworkPagination(
      pageEnvelope([hwItem('1')], { page_count: 4, total_count: 37, sfile_limit: 10 }),
    );
    expect(meta).toEqual({
      pageCount: 4,
      totalCount: 37,
      sfileLimit: 10,
      itemListLength: 1,
    });
  });

  it('handles malformed pagination metadata', () => {
    const meta = extractHomeworkPagination({
      S: true,
      D: { item_list: [hwItem('1')], page_count: 'nope' },
    } as NeverSkipHomeworkResponse);
    expect(meta.pageCount).toBeNull();
    expect(meta.totalCount).toBeNull();
    expect(meta.itemListLength).toBe(1);
  });
});

describe('shouldFetchNextHomeworkPage', () => {
  it('stops on empty page', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 5, totalCount: 40, sfileLimit: 10, itemListLength: 0 },
        1,
        10,
      ),
    ).toBe(false);
  });

  it('uses page_count when present', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 2, totalCount: 15, sfileLimit: 10, itemListLength: 10 },
        0,
        10,
      ),
    ).toBe(true);
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 2, totalCount: 15, sfileLimit: 10, itemListLength: 5 },
        1,
        15,
      ),
    ).toBe(false);
  });

  it('uses totalCount when page_count missing', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: null, totalCount: 25, sfileLimit: 10, itemListLength: 10 },
        0,
        10,
      ),
    ).toBe(true);
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: null, totalCount: 25, sfileLimit: 10, itemListLength: 5 },
        2,
        25,
      ),
    ).toBe(false);
  });
  it('uses totalCount even when page_count is present', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 2, totalCount: 25, sfileLimit: 10, itemListLength: 10 },
        1,
        20,
      ),
    ).toBe(true);
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 13, totalCount: 129, sfileLimit: 25, itemListLength: 4 },
        12,
        129,
      ),
    ).toBe(false);
  });

  it('stops after page_count when last page is short even if unique < totalCount', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 14, totalCount: 135, sfileLimit: 25, itemListLength: 5 },
        13,
        132,
      ),
    ).toBe(false);
  });

  it('continues past page_count only when last page looks full and unique < totalCount', () => {
    expect(
      shouldFetchNextHomeworkPage(
        { pageCount: 13, totalCount: 129, sfileLimit: 25, itemListLength: 10 },
        12,
        125,
      ),
    ).toBe(true);
  });
});

describe('fetchAllHomeworkPages', () => {
  it('handles a one-page response', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      expect(page).toBe(0);
      return pageEnvelope([hwItem('1'), hwItem('2')], {
        page_count: 1,
        total_count: 2,
        sfile_limit: 10,
      });
    });
    expect(result.pagesFetched).toBe(1);
    expect(result.items.map((i) => String(i.assign_id))).toEqual(['1', '2']);
    expect(result.incomplete).toBe(false);
  });

  it('fetches a two-page response', async () => {
    const pages = [
      pageEnvelope([hwItem('1'), hwItem('2')], { page_count: 2, total_count: 3, sfile_limit: 2 }),
      pageEnvelope([hwItem('3')], { page_count: 2, total_count: 3, sfile_limit: 2 }),
    ];
    const seen: number[] = [];
    const result = await fetchAllHomeworkPages(async (page, payload) => {
      seen.push(page);
      expect(payload.page).toBe(String(page));
      return pages[page];
    });
    expect(seen).toEqual([0, 1]);
    expect(result.pagesFetched).toBe(2);
    expect(result.items).toHaveLength(3);
  });

  it('fetches multiple pages until page_count exhausted', async () => {
    const result = await fetchAllHomeworkPages(async (page) =>
      pageEnvelope([hwItem(String(page * 10 + 1))], {
        page_count: 4,
        total_count: 4,
        sfile_limit: 1,
      }),
    );
    expect(result.pagesFetched).toBe(4);
    expect(result.items).toHaveLength(4);
  });

  it('handles empty page', async () => {
    const result = await fetchAllHomeworkPages(async () =>
      pageEnvelope([], { page_count: 3, total_count: 0, sfile_limit: 10 }),
    );
    expect(result.pagesFetched).toBe(1);
    expect(result.items).toHaveLength(0);
  });

  it('continues when totalCount > first-page count', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      if (page === 0) {
        return pageEnvelope(
          Array.from({ length: 10 }, (_, i) => hwItem(String(i + 1))),
          { total_count: 12, sfile_limit: 10 },
        );
      }
      return pageEnvelope([hwItem('11'), hwItem('12')], {
        total_count: 12,
        sfile_limit: 10,
      });
    });
    expect(result.pagesFetched).toBe(2);
    expect(result.items).toHaveLength(12);
  });

  it('dedupes duplicate records across pages', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      if (page === 0) {
        return pageEnvelope([hwItem('1'), hwItem('2')], {
          page_count: 2,
          total_count: 3,
          sfile_limit: 2,
        });
      }
      return pageEnvelope([hwItem('2'), hwItem('3')], {
        page_count: 2,
        total_count: 3,
        sfile_limit: 2,
      });
    });
    expect(result.items.map((i) => String(i.assign_id))).toEqual(['1', '2', '3']);
  });

  it('marks incomplete when raw fetched is below total_count', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      if (page < 2) {
        return pageEnvelope(
          Array.from({ length: 10 }, (_, i) => hwItem(String(page * 10 + i + 1))),
          { page_count: 3, total_count: 30, sfile_limit: 10 },
        );
      }
      // short last page — raw total 25 < total_count 30
      return pageEnvelope(
        Array.from({ length: 5 }, (_, i) => hwItem(String(20 + i + 1))),
        { page_count: 3, total_count: 30, sfile_limit: 10 },
      );
    });
    expect(result.incomplete).toBe(true);
    expect(result.errors.some((e) => /total_count/i.test(e))).toBe(true);
  });

  it('accepts unique < total_count when raw page lengths cover total_count', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      if (page === 0) {
        return pageEnvelope(
          Array.from({ length: 10 }, (_, i) => hwItem(String(i + 1))),
          { page_count: 2, total_count: 12, sfile_limit: 10 },
        );
      }
      // 2 overlaps + 2 new = 12 raw, 10 unique from page0 + 2 = 12 unique actually
      // Make overlaps: return 2 dupes + 2 new = 12 raw total, 10 unique? 
      // page0: 1-10, page1: 9,10,11,12 → raw 14? Let's do page1: 3 items with 1 overlap
      return pageEnvelope([hwItem('10'), hwItem('11'), hwItem('12')], {
        page_count: 2,
        total_count: 13,
        sfile_limit: 10,
      });
    });
    // raw = 13, unique = 12, total_count = 13 → complete
    expect(result.incomplete).toBe(false);
    expect(result.items).toHaveLength(12);
  });

  it('preserves earlier pages when a later page fails', async () => {
    const result = await fetchAllHomeworkPages(async (page) => {
      if (page === 0) {
        return pageEnvelope([hwItem('1')], { page_count: 3, total_count: 3, sfile_limit: 1 });
      }
      if (page === 1) {
        return pageEnvelope([hwItem('2')], { page_count: 3, total_count: 3, sfile_limit: 1 });
      }
      throw new Error('boom');
    });
    expect(result.incomplete).toBe(true);
    expect(result.pagesFetched).toBe(2);
    expect(result.items.map((i) => String(i.assign_id))).toEqual(['1', '2']);
    expect(result.errors.some((e) => e.includes('boom'))).toBe(true);
  });

  it('mergeHomeworkPageItems keeps first occurrence', () => {
    expect(
      mergeHomeworkPageItems([
        [hwItem('1', 'A')],
        [hwItem('1', 'B'), hwItem('2')],
      ]).map((i) => `${i.assign_id}:${i.assign_title}`),
    ).toEqual(['1:A', '2:HW 2']);
  });
});

describe('paginated homework sync idempotency', () => {
  it('double sync remains idempotent across all pages', async () => {
    const homework = [
      hwItem('10'),
      hwItem('11'),
      hwItem('12'),
    ];
    const store = new InMemoryNeverSkipStore();
    const first = await syncNeverSkipData({
      homework,
      notices: [],
      store,
      label: 'browser sync',
      homeworkPagesFetched: 2,
    });
    expect(first.homeworkInserted).toBe(3);

    const second = await syncNeverSkipData({
      homework,
      notices: [],
      store,
      label: 'browser sync',
      homeworkPagesFetched: 2,
    });
    expect(second.homeworkInserted).toBe(0);
    expect(second.homeworkSkipped).toBe(3);
    expect((await store.listHomework()).length).toBe(3);
  });
});

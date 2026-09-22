import { describe, expect, it } from 'vitest';
import {
  buildContentLibPayload,
  extractContentLibPageCount,
  extractContentLibraryItems,
  fetchAllContentLibraryPages,
  isJolRelatedText,
  normalizeContentLibraryItem,
  parseContentMedia,
} from '@/lib/neverskip/jol';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { syncNeverSkipData } from '@/lib/neverskip/sync';
import type { NeverSkipContentLibraryResponse, NeverSkipRawContentItem } from '@/lib/neverskip/types';

function contentItem(
  id: string,
  overrides: Partial<NeverSkipRawContentItem> = {},
): NeverSkipRawContentItem {
  return {
    refid: id,
    con_id: id,
    con_tit: `Joy of Learning — Printout ${id}`,
    con_desc: 'JOL worksheet',
    full_desc: 'Full JOL description',
    subject_name: 'Joy of learning',
    sch_dt: '2026-09-18',
    sch_fdt: '18-Sep-2026',
    sch_tm: '10:30',
    cls_sec: 'I-A',
    media: [
      {
        media_type: 'P',
        media_url: `https://cdn.example.com/conlib/${id}.pdf`,
        dwn_url: `https://cdn.example.com/conlib/${id}.pdf`,
        thump_url: `https://cdn.example.com/conlib/${id}.png`,
      },
    ],
    ...overrides,
  };
}

function pageEnvelope(
  items: NeverSkipRawContentItem[],
  pageCount?: number,
): NeverSkipContentLibraryResponse {
  return {
    S: true,
    D: {
      item_list: items,
      page_count: pageCount,
      stu_id: 'stu1',
    },
    F: 'S',
  };
}

describe('content library / JOL helpers', () => {
  it('builds zero-based payloads like homework', () => {
    expect(buildContentLibPayload(0)).toEqual({
      values: '',
      page: '0',
      pg_key: 'CD',
      works: '',
      limit: 0,
    });
    expect(buildContentLibPayload(3).page).toBe('3');
  });

  it('extracts item_list and page_count', () => {
    const response = pageEnvelope([contentItem('a'), contentItem('b')], 12);
    expect(extractContentLibraryItems(response)).toHaveLength(2);
    expect(extractContentLibPageCount(response)).toBe(12);
  });

  it('parses media URLs without inventing missing ones', () => {
    expect(parseContentMedia([{ media_type: 'P' }])).toEqual([]);
    expect(
      parseContentMedia([
        {
          media_type: 'P',
          media_url: 'https://cdn.example.com/a.pdf',
          dwn_url: 'https://cdn.example.com/a-dl.pdf',
          thump_url: 'https://cdn.example.com/a.png',
        },
      ]),
    ).toEqual([
      {
        mediaType: 'P',
        mediaUrl: 'https://cdn.example.com/a.pdf',
        downloadUrl: 'https://cdn.example.com/a-dl.pdf',
        thumbnailUrl: 'https://cdn.example.com/a.png',
      },
    ]);
  });

  it('tags JOL-related titles and normalizes PDF printouts', () => {
    expect(isJolRelatedText('Joy of Learning worksheet')).toBe(true);
    expect(isJolRelatedText('Math homework')).toBe(false);

    const normalized = normalizeContentLibraryItem(contentItem('jol-1'));
    expect(normalized).toMatchObject({
      sourceId: 'jol-1',
      jolRelated: true,
      scheduleDocument: false,
      resourceType: 'printout',
      downloadUrl: 'https://cdn.example.com/conlib/jol-1.pdf',
      publishedDate: '2026-09-18',
    });
  });

  it('tags timetable/newsletter titles as schedule documents', () => {
    const normalized = normalizeContentLibraryItem(
      contentItem('tt-1', {
        con_tit: 'Joy of Learning Worksheet II Timetable',
        con_desc: 'Class I schedule',
      }),
    );
    expect(normalized).toMatchObject({
      scheduleDocument: true,
      resourceType: 'timetable',
      jolRelated: true,
    });
  });

  it('returns null when source id is missing', () => {
    expect(
      normalizeContentLibraryItem({
        con_tit: 'Untitled',
        media: [],
      }),
    ).toBeNull();
  });

  it('paginates until page_count and dedupes by refid', async () => {
    const pages: Record<number, NeverSkipContentLibraryResponse> = {
      0: pageEnvelope([contentItem('1'), contentItem('2')], 2),
      1: pageEnvelope([contentItem('2'), contentItem('3')], 2),
    };
    const result = await fetchAllContentLibraryPages(async (page) => pages[page] ?? null);
    expect(result.incomplete).toBe(false);
    expect(result.pagesFetched).toBe(2);
    expect(result.rawFetched).toBe(4);
    expect(result.uniqueFetched).toBe(3);
    expect(result.items.map((i) => i.refid)).toEqual(['1', '2', '3']);
  });

  it('marks incomplete when fewer pages than page_count', async () => {
    const result = await fetchAllContentLibraryPages(async (page) => {
      if (page === 0) return pageEnvelope([contentItem('only')], 3);
      return null;
    });
    expect(result.incomplete).toBe(true);
    expect(result.pagesFetched).toBe(1);
    expect(result.errors.some((e) => /page_count/i.test(e) || /empty/i.test(e))).toBe(true);
  });
});

describe('JOL sync persistence', () => {
  it('upserts content library items and skips unchanged duplicates', async () => {
    const store = new InMemoryNeverSkipStore();
    const raw = [contentItem('j1'), contentItem('j2')];

    const first = await syncNeverSkipData({
      homework: [],
      notices: [],
      jolItems: raw,
      store,
      label: 'jol-test-1',
    });
    expect(first.jolInserted).toBe(2);
    expect(first.jolStored).toBe(2);

    const second = await syncNeverSkipData({
      homework: [],
      notices: [],
      jolItems: raw,
      store,
      label: 'jol-test-2',
    });
    expect(second.jolInserted).toBe(0);
    expect(second.jolSkipped).toBe(2);
    expect((await store.listJolItems()).every((j) => j.jolRelated)).toBe(true);
  });
});

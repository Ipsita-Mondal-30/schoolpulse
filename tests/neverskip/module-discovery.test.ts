import { describe, expect, it } from 'vitest';
import {
  normalizePortalDate,
  requestBodyKeys,
  summarizePortalResponse,
} from '@/lib/neverskip/module-discovery';

describe('module discovery summaries', () => {
  it('normalises portal date formats', () => {
    expect(normalizePortalDate('2026-10-14 09:30:00')).toBe('2026-10-14');
    expect(normalizePortalDate('14-10-2026')).toBe('2026-10-14');
    expect(normalizePortalDate('14/10/2026')).toBe('2026-10-14');
    expect(normalizePortalDate('Class I-A')).toBeNull();
    expect(normalizePortalDate('99-99-2026')).toBeNull();
  });

  it('reports counts, key names and newest date without values', () => {
    const summary = summarizePortalResponse({
      D: {
        total_count: 2,
        item_list: [
          { notice_id: 'n1', title: 'Sports day', ndate: '2026-10-10', file: 'https://x/a.pdf' },
          { notice_id: 'n2', title: 'October Newsletter', ndate: '12-10-2026', file: '' },
        ],
      },
    });
    expect(summary.largestListLength).toBe(2);
    expect(summary.itemKeys).toEqual(['notice_id', 'title', 'ndate', 'file']);
    expect(summary.newestDate).toBe('2026-10-12');
    expect(summary.oldestDate).toBe('2026-10-10');
    expect(summary.pdfLinks).toBe(1);
    expect(summary.newsletterMentions).toBe(1);
    expect(summary.paginationKeys).toEqual(['total_count']);
    expect(JSON.stringify(summary)).not.toMatch(/Sports day|n1/);
  });

  it('returns request body key names only', () => {
    expect(requestBodyKeys('{"pg_key":1,"token":"secret"}')).toEqual(['pg_key', 'token']);
    expect(requestBodyKeys('not json')).toEqual([]);
    expect(requestBodyKeys(null)).toEqual([]);
  });
});

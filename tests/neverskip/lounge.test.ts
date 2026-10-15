import { describe, expect, it } from 'vitest';
import {
  fetchCursorPages,
  joinLoungeFilesToNotices,
  nextPortalCursor,
  noticeMessageId,
  parseLoungeAttachments,
} from '@/lib/neverskip/lounge';
import { extractNoticeAttachments, parseAttachmentsJson } from '@/lib/neverskip/attachments';
import { getMeaningfulNoticeChanges } from '@/lib/neverskip/changes';
import { extractNotices, normalizeNotice } from '@/lib/neverskip/normalizers';
import type { NeverSkipRawNotice, NormalizedNotice } from '@/lib/neverskip/types';

const ICON = 'https://parentapp.neverskip.com/assets/com_icon/absent_messages.png';
const HOLIDAY_PDF = 'https://d1hfw03022jglv.cloudfront.net/3079/commedia/2627/GRADE1-HOLIDAYHOMEWORK_20261013113448.pdf';

/** Shapes copied from live fetchdailynoticeinfo / fetchloungeinfo responses (Oct 2026). */
function noticePage(items: NeverSkipRawNotice[], cursor: string) {
  return { S: true, D: { item_list: items, prmontyr: cursor, tcnt: items.length, pervious_prmontr: '' }, F: 'S' };
}
const holidayNotice: NeverSkipRawNotice = {
  date: '11:34 AM | 13/10/2026',
  cont: 'HAPPY VACATION AND HOLIDAY HOMEWORK| Please find the attached Holiday Homework.',
  image: '',
  title: 'Class: I',
  msg_src: 'M',
  msg_type: 'P',
  post_from_img: 'https://neverskip.s3.us-east-1.amazonaws.com/nskdata/phone.png',
  test_tar: "{'msid': '2959', 'msrc': 'M', 'dystat': '', 'pinst': 'N', 'mtsp': '2026-10-13 11:34:50'}",
};
const mathsNotice: NeverSkipRawNotice = {
  date: '09:08 AM | 14/10/2026',
  cont: 'Maths Quest grand finale on 4th November.',
  image: ICON,
  title: 'Class: I',
  msg_src: 'P',
  msg_type: 'P',
  test_tar: "{'msid': '3019', 'msrc': 'P'}",
};
const loungeBody = {
  S: true,
  D: {
    allow_download_nb_cg_videos: 'N',
    prmontyr: '20261008_453096_N',
    pervious_prmontr: '',
    item_list: [
      {
        title: '[ I - A ] HAPPY VACATION AND HOLIDAY HOMEWORK| ... - 11:34 AM | 13 Oct 2026',
        cnt: '',
        item_list: [
          {
            src: HOLIDAY_PDF,
            download_url: HOLIDAY_PDF,
            thump_url: 'https://s3.amazonaws.com/neverskip/par_mob_icon/pdf/pink.png',
            type: 'P',
            msg_id: '2959',
            ext: 'pdf',
          },
        ],
      },
      {
        title: '[ I - A ] Lounge-only post',
        cnt: '',
        item_list: [{ src: 'https://d1hfw03022jglv.cloudfront.net/x/only.jpeg', download_url: '', msg_id: '9999', ext: 'jpeg' }],
      },
    ],
  },
  F: 'S',
};

describe('Lounge (Circulars) → Daily Notice attachments', () => {
  it('reads the message id from the Python-dict test_tar string', () => {
    expect(noticeMessageId(holidayNotice)).toBe('2959');
    expect(noticeMessageId({ test_tar: { msid: 3019 } as never })).toBe('3019');
    expect(noticeMessageId({ test_tar: null })).toBe('');
  });

  it('maps msg_id → real file, skipping thumbnails', () => {
    const files = parseLoungeAttachments([loungeBody]);
    expect(files.get('2959')).toEqual([{ url: HOLIDAY_PDF, name: 'GRADE1-HOLIDAYHOMEWORK_20261013113448.pdf' }]);
    expect(files.get('9999')?.[0].url).toBe('https://d1hfw03022jglv.cloudfront.net/x/only.jpeg');
  });

  it('joins the holiday-homework PDF onto the Oct 13 notice (one record, not two)', () => {
    const notices = [structuredClone(holidayNotice), structuredClone(mathsNotice)];
    const joined = joinLoungeFilesToNotices(notices, parseLoungeAttachments([loungeBody]));
    expect(joined.matched).toBe(1);
    expect(joined.unmatchedMessageIds).toEqual(['9999']);
    const normalized = normalizeNotice(notices[0])!;
    expect(normalized.attachments).toEqual([{ url: HOLIDAY_PDF, name: 'GRADE1-HOLIDAYHOMEWORK_20261013113448.pdf' }]);
    expect(normalized.publishedDate).toBe('2026-10-13');
  });

  it('never treats a portal icon as an attachment or image', () => {
    expect(extractNoticeAttachments(mathsNotice as Record<string, unknown>)).toEqual([]);
    expect(normalizeNotice(mathsNotice)!.imageUrl).toBeNull();
    expect(parseAttachmentsJson(JSON.stringify([{ url: ICON }]))).toEqual([]);
  });

  it('dropping a stored icon imageUrl is not a parent-visible change', () => {
    const base = normalizeNotice(mathsNotice)! as NormalizedNotice;
    expect(getMeaningfulNoticeChanges({ ...base, imageUrl: ICON }, base)).toEqual([]);
  });
});

describe('cursor pagination (D.prmontyr)', () => {
  it('follows prmontyr cursors until the feed ends, deduping by message id', async () => {
    const pages: Record<string, unknown> = {
      '20261004_425760_N': noticePage([holidayNotice], '20260928_374234_N'),
      '20260928_374234_N': noticePage([], ''),
    };
    const requested: string[] = [];
    const result = await fetchCursorPages<NeverSkipRawNotice>({
      firstPage: noticePage([mathsNotice, holidayNotice], '20261004_425760_N'),
      fetchPage: async (cursor) => {
        requested.push(cursor);
        return pages[cursor];
      },
      extract: (b) => extractNotices(b as never),
      keyOf: (n) => noticeMessageId(n),
    });
    expect(requested).toEqual(['20261004_425760_N', '20260928_374234_N']);
    expect(result.complete).toBe(true);
    expect(result.rawFetched).toBe(3);
    expect(result.uniqueFetched).toBe(2);
  });

  it('treats wrapping back to the first cursor as the end of the feed', async () => {
    const pages: Record<string, unknown> = {
      c1: noticePage([holidayNotice], 'c2'),
      c2: noticePage([mathsNotice], 'c1'),
    };
    const result = await fetchCursorPages<NeverSkipRawNotice>({
      firstPage: noticePage([mathsNotice], 'c1'),
      fetchPage: async (cursor) => pages[cursor],
      extract: (b) => extractNotices(b as never),
      keyOf: (n) => noticeMessageId(n),
    });
    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.uniqueFetched).toBe(2);
  });

  it('stops and reports incomplete when the portal repeats a mid-feed cursor', async () => {
    const loop = noticePage([mathsNotice], 'same');
    const result = await fetchCursorPages<NeverSkipRawNotice>({
      firstPage: noticePage([holidayNotice], 'first'),
      fetchPage: async () => loop,
      extract: (b) => extractNotices(b as never),
      keyOf: (n) => noticeMessageId(n),
    });
    expect(result.complete).toBe(false);
    expect(result.errors[0]).toMatch(/cursor repeated/);
    expect(result.uniqueFetched).toBe(2);
  });

  it('keeps fetched pages when a later page fails', async () => {
    const result = await fetchCursorPages<NeverSkipRawNotice>({
      firstPage: noticePage([mathsNotice], 'next'),
      fetchPage: async () => {
        throw new Error('HTTP 500');
      },
      extract: (b) => extractNotices(b as never),
      keyOf: (n) => noticeMessageId(n),
    });
    expect(result.complete).toBe(false);
    expect(result.items).toHaveLength(1);
  });

  it('nextPortalCursor is empty when absent', () => {
    expect(nextPortalCursor({ D: { item_list: [] } })).toBe('');
    expect(nextPortalCursor(null)).toBe('');
  });
});

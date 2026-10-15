import { describe, expect, it } from 'vitest';
import { jolTimetableStatus, officialTimetableFromNotices } from '@/lib/schedule/official-timetable';
import { parseContentMedia } from '@/lib/neverskip/jol';

const attachment = (url: string, name = url.split('/').pop()) => JSON.stringify([{ url, name }]);

const JOL2_NOTICE = {
  sourceId: 'msid:39310',
  content: 'JOY OF LEARNING, WORKSHEET - II TIMETABLE:|Jai Sri Gurudev!\r\nPlease find the attached file for the timetable for JOL, worksheet -II.',
  publishedDate: '2026-08-19',
  attachmentsJson: attachment('https://cdn.example.test/I-IIJoyofLearningIITimetable2.pdf'),
};

const DAYS = [
  { activityDate: '2026-09-30', classI: 'Mathematics' },
  { activityDate: '2026-10-01', classI: 'Study Holiday' },
  { activityDate: '2026-10-03', classI: 'Computer Science' },
  { activityDate: '2026-10-05', classI: 'Hindi' },
  { activityDate: '2026-10-07', classI: 'EVS' },
  { activityDate: '2026-10-09', classI: 'Kannada' },
  { activityDate: '2026-10-12', classI: 'English' },
];

describe('officialTimetableFromNotices', () => {
  it('picks the newest JoL timetable notice that has a file', () => {
    const official = officialTimetableFromNotices([
      {
        sourceId: 'msid:2760',
        content: 'Newsletter for the month of October:|Please find the attached newsletter (includes timetable).',
        publishedDate: '2026-10-05',
        attachmentsJson: attachment('https://cdn.example.test/newsletter.pdf'),
      },
      {
        sourceId: 'msid:1',
        content: 'JOL timetable change:|Text only, no file.',
        publishedDate: '2026-09-01',
        attachmentsJson: '[]',
      },
      JOL2_NOTICE,
    ]);
    expect(official).toEqual({
      noticeSourceId: 'msid:39310',
      title: 'JOY OF LEARNING, WORKSHEET - II TIMETABLE',
      publishedDate: '2026-08-19',
      url: 'https://cdn.example.test/I-IIJoyofLearningIITimetable2.pdf',
      fileName: 'I-IIJoyofLearningIITimetable2.pdf',
    });
  });

  it('returns null when no timetable notice exists', () => {
    expect(officialTimetableFromNotices([])).toBeNull();
  });
});

describe('jolTimetableStatus', () => {
  it('is completed after the last date (Oct 15 vs Oct 12)', () => {
    expect(jolTimetableStatus(DAYS, '2026-10-15', { publishedDate: '2026-08-19' })).toEqual({
      state: 'completed',
      firstDate: '2026-09-30',
      lastDate: '2026-10-12',
      next: null,
      newerOfficialPublished: false,
    });
  });

  it('reports the next entry while in progress and before the start', () => {
    expect(jolTimetableStatus(DAYS, '2026-10-06', null)?.next).toEqual({ activityDate: '2026-10-07', label: 'EVS' });
    expect(jolTimetableStatus(DAYS, '2026-10-06', null)?.state).toBe('in_progress');
    expect(jolTimetableStatus(DAYS, '2026-09-20', null)?.state).toBe('upcoming');
  });

  it('flags a timetable published after the stored dates end', () => {
    expect(jolTimetableStatus(DAYS, '2026-11-02', { publishedDate: '2026-10-28' })?.newerOfficialPublished).toBe(true);
  });
});

describe('parseContentMedia', () => {
  it('drops bare folder URLs that NeverSkip sends for missing thumbnails', () => {
    const [media] = parseContentMedia([
      {
        media_url: 'https://cdn.example.test/3079/conlib/CONLIB_WS2.pdf',
        dwn_url: '',
        thump_url: 'https://cdn.example.test/3079/conlib/',
        media_type: 'P',
      },
    ]);
    expect(media.thumbnailUrl).toBeNull();
    expect(media.downloadUrl).toBe('https://cdn.example.test/3079/conlib/CONLIB_WS2.pdf');
  });
});

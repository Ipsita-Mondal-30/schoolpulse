import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  getIndiaToday,
} from '@/lib/daily-brief';
import {
  buildThisWeekView,
  dueLabelForItem,
} from '@/lib/this-week';
import {
  eachDayYmd,
  formatWeekdayHeading,
  getDayOfWeekMon1,
  getEndOfWeekIndia,
  getStartOfWeekIndia,
  getWorkloadLevel,
  isInWeek,
} from '@/lib/week-range';
import type { UiHomeworkItem } from '@/lib/ui-merge';
import { thisWeekQueryKey } from '@/lib/queries/this-week';
import { homeworkQueryKey } from '@/lib/queries/homework';

/** Wednesday 10 Sep 2026 — mid-week fixture. Week = Mon 8 → Sun 14 Sep. */
const TODAY = '2026-09-10';

function hw(
  partial: Partial<UiHomeworkItem> & Pick<UiHomeworkItem, 'id' | 'title'>,
): UiHomeworkItem {
  return {
    subject: 'Mathematics',
    sections: ['I-A'],
    description: '',
    sentDate: '2026-09-08',
    ...partial,
  };
}

describe('week-range helpers', () => {
  it('Monday of week containing Thu 10 Sep 2026 is Mon 7 Sep', () => {
    // Sep 1 2026 = Tue → Sep 7=Mon, Sep 10=Thu, Sep 13=Sun
    expect(getDayOfWeekMon1('2026-09-07')).toBe(1);
    expect(getDayOfWeekMon1('2026-09-10')).toBe(4);
    expect(getDayOfWeekMon1('2026-09-13')).toBe(7);
    expect(getStartOfWeekIndia('2026-09-10')).toBe('2026-09-07');
    expect(getEndOfWeekIndia('2026-09-10')).toBe('2026-09-13');
  });

  it('eachDayYmd returns 7 days Mon→Sun', () => {
    const days = eachDayYmd('2026-09-07', '2026-09-13');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-09-07');
    expect(days[6]).toBe('2026-09-13');
  });

  it('formatWeekdayHeading avoids UTC skew', () => {
    expect(formatWeekdayHeading('2026-09-11')).toBe('FRI, 11 SEP');
  });

  it('workload levels are count-only', () => {
    expect(getWorkloadLevel(0)).toBe('Light');
    expect(getWorkloadLevel(1)).toBe('Light');
    expect(getWorkloadLevel(2)).toBe('Moderate');
    expect(getWorkloadLevel(3)).toBe('Moderate');
    expect(getWorkloadLevel(4)).toBe('Heavy');
  });

  it('Sunday night IST → Monday morning IST flips the week', () => {
    // Sun 13 Sep 2026 23:30 IST = 18:00 UTC
    const sundayNight = new Date('2026-09-13T18:00:00.000Z');
    expect(getIndiaToday(sundayNight)).toBe('2026-09-13');
    expect(getStartOfWeekIndia(getIndiaToday(sundayNight))).toBe('2026-09-07');

    // Mon 14 Sep 2026 00:30 IST = Sun 13 Sep 19:00 UTC
    const mondayMorning = new Date('2026-09-13T19:00:00.000Z');
    expect(getIndiaToday(mondayMorning)).toBe('2026-09-14');
    expect(getStartOfWeekIndia(getIndiaToday(mondayMorning))).toBe('2026-09-14');
  });
});

describe('buildThisWeekView', () => {
  const weekStart = '2026-09-07';
  const weekEnd = '2026-09-13';

  it('puts homework due today on today\'s day', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [hw({ id: 'td', title: 'Today HW', submissionDate: TODAY })],
    });
    const todayBucket = view.days.find((d) => d.date === TODAY);
    expect(todayBucket?.items.map((i) => i.id)).toEqual(['td']);
    expect(view.totalDatedThisWeek).toBe(1);
  });

  it('puts homework due tomorrow on tomorrow', () => {
    const tmr = addDaysYmd(TODAY, 1);
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [hw({ id: 'tm', title: 'Tmr', submissionDate: tmr })],
    });
    expect(view.dueTomorrowCount).toBe(1);
    expect(view.days.find((d) => d.date === tmr)?.items[0].id).toBe('tm');
  });

  it('puts homework due later this week on that date', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [hw({ id: 'fri', title: 'Fri', submissionDate: '2026-09-11' })],
    });
    expect(view.days.find((d) => d.date === '2026-09-11')?.count).toBe(1);
  });

  it('includes Monday and Sunday of the current week', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'mon', title: 'Mon', submissionDate: weekStart }),
        hw({ id: 'sun', title: 'Sun', submissionDate: weekEnd }),
      ],
    });
    expect(view.days[0].date).toBe(weekStart);
    expect(view.days[0].items.map((i) => i.id)).toEqual(['mon']);
    expect(view.days[6].items.map((i) => i.id)).toEqual(['sun']);
    // Mon 7 is before today Thu 10 → also overdue
    expect(view.overdue.map((i) => i.id)).toContain('mon');
  });

  it('excludes next week homework from day buckets', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'next', title: 'Next', submissionDate: '2026-09-14' }),
        hw({ id: 'this', title: 'This', submissionDate: '2026-09-12' }),
      ],
    });
    expect(view.days.every((d) => !d.items.some((i) => i.id === 'next'))).toBe(true);
    expect(view.nextWeekCount).toBe(1);
    expect(view.totalDatedThisWeek).toBe(1);
  });

  it('lists overdue homework separately', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [hw({ id: 'od', title: 'Late', submissionDate: '2026-09-01' })],
    });
    expect(view.overdue.map((i) => i.id)).toEqual(['od']);
    expect(view.overdueCount).toBe(1);
    expect(view.totalDatedThisWeek).toBe(0);
  });

  it('puts homework without due date in dateNotSpecified only', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'nd', title: 'No due', sentDate: TODAY }),
      ],
    });
    expect(view.dateNotSpecified.map((i) => i.id)).toEqual(['nd']);
    expect(view.days.every((d) => d.count === 0)).toBe(true);
    expect(view.overdue).toHaveLength(0);
    expect(view.nothingDueThisWeek).toBe(true);
    expect(view.hasUndated).toBe(true);
    expect(dueLabelForItem(view.dateNotSpecified[0], TODAY)).toBe(
      'No deadline provided by school',
    );
  });

  it('groups multiple assignments on the same date', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'a', title: 'A', subject: 'English', submissionDate: TODAY }),
        hw({ id: 'b', title: 'B', subject: 'Math', submissionDate: TODAY }),
        hw({ id: 'c', title: 'C', subject: 'Science', submissionDate: TODAY }),
      ],
    });
    const bucket = view.days.find((d) => d.date === TODAY)!;
    expect(bucket.count).toBe(3);
    expect(bucket.workload).toBe('Moderate');
    expect(view.totalDatedThisWeek).toBe(3);
  });

  it('handles Monday→Sunday week boundary for items on edges', () => {
    expect(isInWeek(weekStart, weekStart, weekEnd)).toBe(true);
    expect(isInWeek(weekEnd, weekStart, weekEnd)).toBe(true);
    expect(isInWeek('2026-09-06', weekStart, weekEnd)).toBe(false);
    expect(isInWeek('2026-09-14', weekStart, weekEnd)).toBe(false);
  });

  it('excludes duplicate ids', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'dup', title: 'First', submissionDate: TODAY }),
        hw({ id: 'dup', title: 'Second', submissionDate: TODAY }),
      ],
    });
    expect(view.totalDatedThisWeek).toBe(1);
    expect(view.days.find((d) => d.date === TODAY)?.items[0].title).toBe('First');
  });

  it('never invents due dates — preserves original submissionDate', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'p',
          title: 'Preserve',
          subject: 'HINDI',
          submissionDate: '2026-09-12',
          sentDate: '2026-09-08',
          description: 'as given',
        }),
      ],
    });
    const item = view.days.find((d) => d.date === '2026-09-12')!.items[0];
    expect(item).toMatchObject({
      title: 'Preserve',
      subject: 'HINDI',
      submissionDate: '2026-09-12',
      sentDate: '2026-09-08',
      description: 'as given',
    });
  });

  it('summary counts are correct for mixed set', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'od', title: 'Late', submissionDate: '2026-09-08' }),
        hw({ id: 'td', title: 'Today', submissionDate: TODAY }),
        hw({ id: 'tm', title: 'Tmr', submissionDate: '2026-09-11' }),
        hw({ id: 'nd', title: 'No due' }),
        hw({ id: 'nx', title: 'Next', submissionDate: '2026-09-15' }),
      ],
    });
    expect(view.overdueCount).toBe(1);
    expect(view.dueTomorrowCount).toBe(1);
    expect(view.totalDatedThisWeek).toBe(3); // od (in week), td, tm
    expect(view.undatedCount).toBe(1);
    expect(view.nextWeekCount).toBe(1);
  });

  it('empty week with no homework', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [],
    });
    expect(view.nothingDueThisWeek).toBe(true);
    expect(view.hasUndated).toBe(false);
    expect(view.days).toHaveLength(7);
    expect(view.days.every((d) => d.count === 0)).toBe(true);
  });

  it('mixed dated + undated homework', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'd', title: 'Dated', submissionDate: TODAY }),
        hw({ id: 'u', title: 'Undated' }),
      ],
    });
    expect(view.totalDatedThisWeek).toBe(1);
    expect(view.undatedCount).toBe(1);
    expect(view.hasUndated).toBe(true);
    expect(view.nothingDueThisWeek).toBe(false);
  });

  it('filters by section', () => {
    const view = buildThisWeekView({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'a', title: 'A', sections: ['I-A'], submissionDate: TODAY }),
        hw({ id: 'b', title: 'B', sections: ['I-B'], submissionDate: TODAY }),
      ],
    });
    expect(view.totalDatedThisWeek).toBe(1);
  });
});

describe('this week query keys', () => {
  it('exports homework week key and reuses homework cache key', () => {
    expect(thisWeekQueryKey).toEqual(['homework', 'week']);
    expect(homeworkQueryKey).toEqual(['homework']);
  });
});

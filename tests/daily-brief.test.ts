import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  buildDailyBrief,
  formatBriefDate,
  getBriefGreeting,
  getIndiaToday,
  hasReliableDueDate,
  isComingUp,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from '@/lib/daily-brief';
import type { UiHomeworkItem, UiNoticeItem } from '@/lib/ui-merge';
import { dailyBriefQueryKey } from '@/lib/queries/daily-brief';
import { homeworkQueryKey } from '@/lib/queries/homework';
import { noticesQueryKey } from '@/lib/queries/notices';

const TODAY = '2026-09-10';

function hw(partial: Partial<UiHomeworkItem> & Pick<UiHomeworkItem, 'id' | 'title'>): UiHomeworkItem {
  return {
    subject: 'Mathematics',
    sections: ['I-A'],
    description: '',
    sentDate: TODAY,
    ...partial,
  };
}

function nt(partial: Partial<UiNoticeItem> & Pick<UiNoticeItem, 'id' | 'summary'>): UiNoticeItem {
  return {
    date: TODAY,
    time: '00:00',
    classes: ['I-A'],
    message: '',
    ...partial,
  };
}

describe('daily brief date helpers', () => {
  it('addDaysYmd handles month boundaries', () => {
    expect(addDaysYmd('2026-09-10', 1)).toBe('2026-09-11');
    expect(addDaysYmd('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysYmd('2026-09-10', -1)).toBe('2026-09-09');
  });

  it('classifies due today / tomorrow / overdue / coming up only with reliable due dates', () => {
    expect(isDueToday('2026-09-10', TODAY)).toBe(true);
    expect(isDueTomorrow('2026-09-11', TODAY)).toBe(true);
    expect(isOverdue('2026-09-09', TODAY)).toBe(true);
    expect(isComingUp('2026-09-12', TODAY, 7)).toBe(true);
    expect(isComingUp('2026-09-11', TODAY, 7)).toBe(false); // tomorrow, not coming-up
    expect(isDueToday(undefined, TODAY)).toBe(false);
    expect(isOverdue('', TODAY)).toBe(false);
    expect(hasReliableDueDate(undefined)).toBe(false);
    expect(hasReliableDueDate('2026-09-11')).toBe(true);
  });

  it('formats brief dates without inventing values', () => {
    expect(formatBriefDate('2026-09-11')).toBe('11 Sep');
  });

  it('greets by hour', () => {
    expect(getBriefGreeting(8)).toBe('Good morning');
    expect(getBriefGreeting(14)).toBe('Good afternoon');
    expect(getBriefGreeting(19)).toBe('Good evening');
  });

  it('getIndiaToday uses Asia/Kolkata calendar date (UTC evening vs IST next day)', () => {
    // 2026-09-10 20:30 UTC = 2026-09-11 02:00 IST
    const utcEvening = new Date('2026-09-10T20:30:00.000Z');
    expect(getIndiaToday(utcEvening)).toBe('2026-09-11');

    // 2026-09-10 18:00 UTC = 2026-09-10 23:30 IST (still 10th)
    const utcAfternoon = new Date('2026-09-10T18:00:00.000Z');
    expect(getIndiaToday(utcAfternoon)).toBe('2026-09-10');
  });
});

describe('buildDailyBrief', () => {
  it('puts homework due tomorrow in dueTomorrow', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'tmr',
          title: 'Exercise 4.2',
          subject: 'Mathematics',
          submissionDate: '2026-09-11',
          sentDate: '2026-09-09',
        }),
      ],
      notices: [],
    });
    expect(brief.dueTomorrow).toHaveLength(1);
    expect(brief.dueTomorrow[0].title).toBe('Exercise 4.2');
    expect(brief.dueTomorrow[0].submissionDate).toBe('2026-09-11');
    expect(brief.nothingUrgent).toBe(false);
  });

  it('puts homework due today in dueToday', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'td',
          title: 'Worksheet 5',
          subject: 'Science',
          submissionDate: TODAY,
        }),
      ],
      notices: [],
    });
    expect(brief.dueToday.map((h) => h.id)).toEqual(['td']);
    expect(brief.dueTomorrow).toHaveLength(0);
  });

  it('puts overdue homework in overdue', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'od',
          title: 'Late work',
          submissionDate: '2026-09-08',
        }),
      ],
      notices: [],
    });
    expect(brief.overdue.map((h) => h.id)).toEqual(['od']);
  });

  it('does not put homework without due date into deadline buckets', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'nd',
          title: 'No due',
          sentDate: '2026-09-09',
          // no submissionDate
        }),
      ],
      notices: [],
    });
    expect(brief.overdue).toHaveLength(0);
    expect(brief.dueToday).toHaveLength(0);
    expect(brief.dueTomorrow).toHaveLength(0);
    expect(brief.comingUp).toHaveLength(0);
    expect(brief.recentHomework.map((h) => h.id)).toEqual(['nd']);
    expect(brief.nothingUrgent).toBe(true);
  });

  it('handles multiple homework items across buckets', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'a', title: 'A', submissionDate: '2026-09-08' }),
        hw({ id: 'b', title: 'B', submissionDate: TODAY }),
        hw({ id: 'c', title: 'C', submissionDate: '2026-09-11' }),
        hw({ id: 'd', title: 'D', submissionDate: '2026-09-14' }),
        hw({ id: 'e', title: 'E', sentDate: '2026-09-09' }),
      ],
      notices: [],
    });
    expect(brief.overdue.map((h) => h.id)).toEqual(['a']);
    expect(brief.dueToday.map((h) => h.id)).toEqual(['b']);
    expect(brief.dueTomorrow.map((h) => h.id)).toEqual(['c']);
    expect(brief.comingUp.map((h) => h.id)).toEqual(['d']);
    expect(brief.recentHomework.map((h) => h.id)).toEqual(['e']);
  });

  it('includes recent notices within window', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [],
      notices: [
        nt({ id: 'n1', summary: 'Sports Day', date: '2026-09-09' }),
        nt({ id: 'n2', summary: 'Old', date: '2026-08-01' }),
      ],
    });
    expect(brief.recentNotices.map((n) => n.id)).toEqual(['n1']);
    expect(brief.recentNotices[0].summary).toBe('Sports Day');
  });

  it('marks nothingUrgent when no deadline homework', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [],
      notices: [nt({ id: 'n1', summary: 'Hello', date: TODAY })],
    });
    expect(brief.nothingUrgent).toBe(true);
    expect(brief.recentNotices).toHaveLength(1);
  });

  it('excludes duplicate homework and notice ids', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({ id: 'dup', title: 'First', submissionDate: TODAY }),
        hw({ id: 'dup', title: 'Second', submissionDate: TODAY }),
      ],
      notices: [
        nt({ id: 'n-dup', summary: 'One', date: TODAY }),
        nt({ id: 'n-dup', summary: 'Two', date: TODAY }),
      ],
    });
    expect(brief.dueToday).toHaveLength(1);
    expect(brief.dueToday[0].title).toBe('First');
    expect(brief.recentNotices).toHaveLength(1);
    expect(brief.recentNotices[0].summary).toBe('One');
  });

  it('preserves original homework and notice field values', () => {
    const title = 'Ri ki matra writing practice';
    const subject = 'HINDI';
    const submissionDate = '2026-09-11';
    const sentDate = '2026-09-08';
    const summary = 'Annual Sports Day';
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'preserve-hw',
          title,
          subject,
          submissionDate,
          sentDate,
          description: 'do not invent',
        }),
      ],
      notices: [
        nt({
          id: 'preserve-n',
          summary,
          date: '2026-09-09',
          time: '10:30',
          message: 'original body',
        }),
      ],
    });
    expect(brief.dueTomorrow[0]).toMatchObject({
      id: 'preserve-hw',
      title,
      subject,
      submissionDate,
      sentDate,
    });
    expect(brief.recentNotices[0]).toMatchObject({
      id: 'preserve-n',
      summary,
      date: '2026-09-09',
      time: '10:30',
    });
  });

  it('filters homework by section', () => {
    const brief = buildDailyBrief({
      today: TODAY,
      section: 'I-A',
      homework: [
        hw({
          id: 'mine',
          title: 'Mine',
          sections: ['I-A'],
          submissionDate: TODAY,
        }),
        hw({
          id: 'other',
          title: 'Other',
          sections: ['I-B'],
          submissionDate: TODAY,
        }),
      ],
      notices: [],
    });
    expect(brief.dueToday.map((h) => h.id)).toEqual(['mine']);
  });
});

describe('daily brief query keys', () => {
  it('exports dashboard today key and reuses homework/notices keys', () => {
    expect(dailyBriefQueryKey).toEqual(['dashboard', 'today']);
    expect(homeworkQueryKey).toEqual(['homework']);
    expect(noticesQueryKey).toEqual(['notices']);
  });
});

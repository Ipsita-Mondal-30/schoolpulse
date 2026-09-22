import { describe, expect, it } from 'vitest';
import { buildDailyPulse, getIndiaMinutes } from '@/lib/daily-pulse';
import { shouldShowDailyPulse, type SchoolCalendarItem } from '@/lib/school-day';
import september2026 from '@/data/september-2026.json';

const septemberDates = (september2026.importantDates || []) as SchoolCalendarItem[];

describe('daily pulse', () => {
  it('reads India clock minutes', () => {
    const minutes = getIndiaMinutes(new Date('2026-09-11T04:30:00.000Z'));
    expect(minutes).toBe(10 * 60);
  });

  it('places school start and end from the real timetable', () => {
    const pulse = buildDailyPulse(new Date('2026-09-11T02:00:00.000Z'));
    expect(pulse.markers[0]).toMatchObject({ caption: 'School starts', timeLabel: '07:55' });
    expect(pulse.markers.at(-1)).toMatchObject({ caption: 'School ends', timeLabel: '15:00' });
    expect(shouldShowDailyPulse('2026-09-11', septemberDates)).toBe(true);
  });

  it('marks weekends without inventing a school day', () => {
    const pulse = buildDailyPulse(new Date('2026-09-12T04:30:00.000Z'));
    expect(pulse.isWeekend).toBe(true);
    expect(pulse.progress).toBe(0);
    expect(pulse.markers.some((m) => m.kind === 'now')).toBe(false);
  });

  it('still knows the timetable on a weekday holiday; Home hides it via school-day', () => {
    const pulse = buildDailyPulse(new Date('2026-09-14T04:30:00.000Z'));
    expect(pulse.isWeekend).toBe(false);
    expect(pulse.markers[0]).toMatchObject({ caption: 'School starts' });
    expect(shouldShowDailyPulse('2026-09-14', septemberDates)).toBe(false);
  });
});

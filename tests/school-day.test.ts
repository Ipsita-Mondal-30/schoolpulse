import { describe, expect, it } from 'vitest';
import september2026 from '@/data/september-2026.json';
import june2026 from '@/data/june-2026.json';
import {
  formatHolidayDateLine,
  getConfirmedSchoolHoliday,
  getUpcomingSchoolEvents,
  selectCalendarWindow,
  shouldShowDailyPulse,
  type SchoolCalendarItem,
} from '@/lib/school-day';

const septemberDates = (september2026.importantDates || []) as SchoolCalendarItem[];
const juneDates = (june2026.importantDates || []) as SchoolCalendarItem[];

describe('confirmed school holiday from Planner data', () => {
  it('shows Daily Pulse on a normal school day (event is not a holiday)', () => {
    const today = '2026-09-11';
    expect(getConfirmedSchoolHoliday(today, septemberDates)).toBeNull();
    expect(shouldShowDailyPulse(today, septemberDates)).toBe(true);
  });

  it('hides the school-day timeline on a confirmed Planner holiday and uses the event name', () => {
    const today = '2026-09-14';
    const holiday = getConfirmedSchoolHoliday(today, septemberDates);
    expect(holiday?.name).toBe(
      septemberDates.find((d) => d.date === today && d.type === 'holiday')?.event,
    );
    expect(holiday?.name).toBeTruthy();
    expect(shouldShowDailyPulse(today, septemberDates)).toBe(false);
  });

  it('keeps upcoming school events visible on a holiday', () => {
    const today = '2026-09-14';
    const upcoming = getUpcomingSchoolEvents(today, septemberDates);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((row) => row.date > today)).toBe(true);
    expect(upcoming.every((row) => row.type === 'event' || row.type === 'important')).toBe(true);
    expect(upcoming.some((row) => row.event.includes('Math Quest'))).toBe(true);
  });

  it('does not treat a tentative holiday as a confirmed closure', () => {
    const today = '2026-06-26';
    const row = juneDates.find((d) => d.date === today);
    expect(row?.type).toBe('holiday');
    expect(row?.description).toMatch(/tentative/i);
    expect(getConfirmedSchoolHoliday(today, juneDates)).toBeNull();
    expect(shouldShowDailyPulse(today, juneDates)).toBe(true);
  });

  it('preserves the school-day pulse when calendar data is missing', () => {
    expect(shouldShowDailyPulse('2026-09-08', [])).toBe(true);
    expect(getConfirmedSchoolHoliday('2026-09-08', [])).toBeNull();
  });

  it('uses a named day-schedule holiday and ignores Weekend labels', () => {
    expect(
      getConfirmedSchoolHoliday('2026-05-18', [], {
        isHoliday: true,
        holidayName: 'Summer Vacation',
      }),
    ).toEqual({ date: '2026-05-18', name: 'Summer Vacation' });
    expect(
      getConfirmedSchoolHoliday('2026-05-23', [], {
        isHoliday: true,
        holidayName: 'Weekend',
      }),
    ).toBeNull();
  });

  it('formats the holiday date line from the calendar date', () => {
    expect(formatHolidayDateLine('2026-09-14')).toBe('Monday · 14 September');
  });

  it('keeps calendar type when selecting the Home window', () => {
    const window = selectCalendarWindow(septemberDates, '2026-09-14');
    const holiday = window.find((row) => row.date === '2026-09-14');
    expect(holiday?.type).toBe('holiday');
    expect(window.every((row) => row.date >= '2026-09-14' && row.date <= '2026-09-21')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  extractCalendarRows,
  normalizeCalendarEvent,
  parseCalendarResponse,
} from '@/lib/neverskip/calendar';
import { InMemoryNeverSkipStore } from '@/lib/neverskip/memory-store';
import { syncNeverSkipData } from '@/lib/neverskip/sync';
import type { NormalizedScheduleEvent } from '@/lib/neverskip/types';
import { NEVERSKIP_SOURCE } from '@/lib/neverskip/types';

function event(id: string, title: string, date = '2026-09-30'): NormalizedScheduleEvent {
  return {
    source: NEVERSKIP_SOURCE,
    sourceId: id,
    title,
    description: '',
    eventDate: date,
    startTime: '09:00',
    endTime: '09:40',
    weekday: 'Tuesday',
    subjectName: 'EVS',
    periodLabel: '1',
    classSection: 'I-A',
    resourceUrl: null,
    metadataJson: '{}',
  };
}

describe('calendar parse', () => {
  it('parses empty D:[] as complete (not incomplete)', () => {
    const parsed = parseCalendarResponse({ S: true, D: [], F: 'S' });
    expect(parsed.complete).toBe(true);
    expect(parsed.incomplete).toBe(false);
    expect(parsed.events).toEqual([]);
  });

  it('marks S:false as incomplete and does not invent events', () => {
    const parsed = parseCalendarResponse({ S: false, M: 'denied', F: 'E' });
    expect(parsed.complete).toBe(false);
    expect(parsed.incomplete).toBe(true);
    expect(parsed.events).toEqual([]);
  });

  it('normalizes event rows with stable source ids', () => {
    const rows = extractCalendarRows({
      S: true,
      D: [{ id: 'e1', title: 'JOL Hindi', event_date: '2026-09-30', subject_name: 'Hindi' }],
    });
    expect(rows).toHaveLength(1);
    const n = normalizeCalendarEvent(rows[0], 0);
    expect(n?.sourceId).toBe('e1');
    expect(n?.eventDate).toBe('2026-09-30');
    expect(n?.subjectName).toBe('Hindi');
  });
});

describe('schedule sync replace + preserve', () => {
  it('replaces old timetable events with new ones without duplicates', async () => {
    const store = new InMemoryNeverSkipStore();
    await syncNeverSkipData({
      homework: [],
      notices: [],
      scheduleEvents: [event('a', 'Old JOL')],
      scheduleFetchComplete: true,
      scheduleFetchIncomplete: false,
      store,
      label: 'sched-1',
    });
    expect(await store.listScheduleEvents()).toHaveLength(1);

    await syncNeverSkipData({
      homework: [],
      notices: [],
      scheduleEvents: [event('b', 'New JOL Timetable'), event('c', 'WS-II Maths')],
      scheduleFetchComplete: true,
      scheduleFetchIncomplete: false,
      store,
      label: 'sched-2',
    });
    const rows = await store.listScheduleEvents();
    expect(rows.map((r) => r.sourceId).sort()).toEqual(['b', 'c']);
    expect(rows.some((r) => r.title === 'Old JOL')).toBe(false);
  });

  it('does not overwrite good schedule data when calendar fetch is incomplete', async () => {
    const store = new InMemoryNeverSkipStore();
    await syncNeverSkipData({
      homework: [],
      notices: [],
      scheduleEvents: [event('keep', 'Keep me')],
      scheduleFetchComplete: true,
      scheduleFetchIncomplete: false,
      store,
      label: 'sched-ok',
    });

    const summary = await syncNeverSkipData({
      homework: [],
      notices: [],
      scheduleEvents: [event('bad', 'Should not apply')],
      scheduleFetchComplete: false,
      scheduleFetchIncomplete: true,
      scheduleFetchErrors: ['CALENDAR SYNC = FAILED'],
      store,
      label: 'sched-fail',
    });

    expect(summary.schedulePreservedOnFailure).toBe(true);
    expect(summary.syncStatus).toBe('PARTIAL');
    const rows = await store.listScheduleEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceId).toBe('keep');
  });

  it('marks incomplete homework fetch as PARTIAL when unique records were preserved', async () => {
    const store = new InMemoryNeverSkipStore();
    const summary = await syncNeverSkipData({
      homework: [
        {
          assign_id: '1',
          assign_title: 'Math',
          subject_name: 'Mathematics',
          ass_dt: '17-Sep-2026',
          assign_typ: 'H',
        },
      ],
      notices: [],
      scheduleEvents: [],
      scheduleFetchComplete: true,
      scheduleFetchIncomplete: false,
      homeworkFetchIncomplete: true,
      homeworkFetchErrors: ['unique 134 < total_count 137'],
      homeworkSourceTotal: 137,
      homeworkUniqueFetched: 134,
      store,
      label: 'hw-partial',
    });
    expect(summary.syncStatus).toBe('PARTIAL');
    expect(summary.errors.some((e) => /homework pagination incomplete/i.test(e))).toBe(true);
  });
});

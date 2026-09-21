import { describe, expect, it } from 'vitest';
import {
  assertJolWs2ValidationMatrix,
  extractJolWs2TimetableFromNewsletter,
} from '@/lib/neverskip/jol-timetable-extract';

describe('JoL WS-II timetable extraction', () => {
  it('extracts the 7 validation rows from the September newsletter document', () => {
    const extraction = extractJolWs2TimetableFromNewsletter();
    expect(extraction).not.toBeNull();
    expect(extraction!.sourceId).toBe('cl-nl-sep-2026');
    expect(extraction!.title).toContain('Joy of Learning II');
    expect(assertJolWs2ValidationMatrix(extraction!.days)).toEqual([]);
    expect(extraction!.days).toEqual([
      { activityDate: '2026-09-30', weekday: 'Wednesday', classI: 'Mathematics', classII: 'EVS' },
      { activityDate: '2026-10-01', weekday: 'Thursday', classI: 'Study Holiday', classII: 'Study Holiday' },
      { activityDate: '2026-10-03', weekday: 'Saturday', classI: 'Computer Science', classII: 'Computer Science' },
      { activityDate: '2026-10-05', weekday: 'Monday', classI: 'Hindi', classII: 'English' },
      { activityDate: '2026-10-07', weekday: 'Wednesday', classI: 'EVS', classII: 'Mathematics' },
      { activityDate: '2026-10-09', weekday: 'Friday', classI: 'Kannada', classII: 'Hindi' },
      { activityDate: '2026-10-12', weekday: 'Monday', classI: 'English', classII: 'Kannada' },
    ]);
  });

  it('does not treat July Worksheet I static JSON as the extraction source', () => {
    const extraction = extractJolWs2TimetableFromNewsletter();
    expect(extraction!.days.every((d) => !d.activityDate.startsWith('2026-07'))).toBe(true);
    expect(extraction!.sourceDocumentPath).toContain('grade1-newsletter-september-2026.pdf');
  });
});

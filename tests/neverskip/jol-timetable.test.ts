import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/newsletter-sep-2026-jol.json';
import { jolExtractionFromNewsletter } from '@/lib/neverskip/jol-timetable-extract';
import { isJolTimetableSourceCandidate, newsletterPublicUrl } from '@/lib/neverskip/jol-timetable-resolve';
import { validateNewsletterExtraction, type NewsletterExtraction } from '@/lib/newsletter/validate';

const sepExtraction: NewsletterExtraction = {
  month: 'September',
  year: 2026,
  monthlyPlanner: [{ subject: 'English', portions: ['Unit 3'], activities: [] }],
  importantDates: [],
  jolTimetable: { title: 'Joy of Learning II - Timetable', academicYear: '2026-27', days: fixture.days },
};

describe('JoL timetable from newsletter extraction', () => {
  it('accepts the September fixture and builds a month-scoped schedule', () => {
    expect(validateNewsletterExtraction(sepExtraction)).toEqual([]);
    const jol = jolExtractionFromNewsletter(sepExtraction, {
      monthKey: '2026-09',
      sourceContentHash: 'abc',
      sourceDocumentUrl: newsletterPublicUrl('2026-09'),
    });
    expect(jol?.sourceId).toBe('newsletter-2026-09');
    expect(jol?.academicYear).toBe('2026-27');
    expect(jol?.sourceDocumentUrl).toBe('/newsletters/grade1-newsletter-september-2026.pdf');
    expect(jol?.days.map((d) => d.activityDate)).toEqual(fixture.days.map((d) => d.date));
    expect(jol?.days[0]).toEqual({
      activityDate: '2026-09-30',
      weekday: 'Wednesday',
      classI: 'Mathematics',
      classII: 'EVS',
    });
  });

  it('works for a future month without code changes', () => {
    const oct: NewsletterExtraction = {
      month: 'October',
      year: 2026,
      monthlyPlanner: [],
      importantDates: [],
      jolTimetable: { days: [{ date: '2026-10-20', weekday: 'Tuesday', classI: 'EVS', classII: 'Hindi' }] },
    };
    expect(validateNewsletterExtraction(oct)).toEqual([]);
    const jol = jolExtractionFromNewsletter(oct, { monthKey: '2026-10', sourceContentHash: 'h', sourceDocumentUrl: null });
    expect(jol?.sourceId).toBe('newsletter-2026-10');
    expect(newsletterPublicUrl('2026-10')).toBe('/newsletters/grade1-newsletter-october-2026.pdf');
  });

  it('returns null when the newsletter has no JoL timetable', () => {
    expect(
      jolExtractionFromNewsletter({ ...sepExtraction, jolTimetable: null }, {
        monthKey: '2026-09',
        sourceContentHash: 'h',
        sourceDocumentUrl: null,
      }),
    ).toBeNull();
  });

  it('detects newsletters of any month as sources', () => {
    expect(isJolTimetableSourceCandidate({ title: 'Grade 1 October 2026 Newsletter' })).toBe(true);
    expect(isJolTimetableSourceCandidate({ title: 'Class I', downloadUrl: 'https://x/newsletter-nov.pdf' })).toBe(true);
    expect(isJolTimetableSourceCandidate({ title: 'EVS worksheet answers' })).toBe(false);
  });
});

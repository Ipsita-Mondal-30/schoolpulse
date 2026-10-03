import { describe, expect, it, vi } from 'vitest';
import { validateNewsletterExtraction, type NewsletterExtraction } from '@/lib/newsletter/validate';
import { ingestNewsletterPdf } from '@/lib/newsletter/ingest';
import { buildPlannerMonthView, mergePlannerMonths, type PlannerMonthEntry } from '@/lib/newsletter/planner-months';

const base: NewsletterExtraction = {
  month: 'October',
  year: 2026,
  monthlyPlanner: [{ subject: 'EVS', portions: ['Plants'], activities: [] }],
  importantDates: [{ date: '2026-10-02', event: 'Gandhi Jayanti', type: 'holiday', description: '' }],
  jolTimetable: { days: [{ date: '2026-10-20', weekday: 'Tuesday', classI: 'EVS', classII: 'Hindi' }] },
};

describe('newsletter extraction validation', () => {
  it('accepts a valid extraction', () => {
    expect(validateNewsletterExtraction(base)).toEqual([]);
  });

  it('rejects a weekday that does not match the date', () => {
    const x = { ...base, jolTimetable: { days: [{ date: '2026-10-20', weekday: 'Monday', classI: 'EVS', classII: 'Hindi' }] } };
    expect(validateNewsletterExtraction(x).join(' ')).toMatch(/weekday Monday != Tuesday/);
  });

  it('rejects dates outside the month ±45 days', () => {
    const x = { ...base, importantDates: [{ date: '2027-02-01', event: 'x', type: 'event' as const, description: '' }] };
    expect(validateNewsletterExtraction(x).join(' ')).toMatch(/outside 2026-10/);
  });

  it('rejects duplicate timetable dates and empty subjects', () => {
    const day = { date: '2026-10-20', weekday: 'Tuesday', classI: 'EVS', classII: 'Hindi' };
    const errs = validateNewsletterExtraction({
      ...base,
      jolTimetable: { days: [day, { ...day, classII: '' }] },
    }).join(' ');
    expect(errs).toMatch(/duplicate date 2026-10-20/);
    expect(errs).toMatch(/empty subject/);
  });

  it('rejects invalid ISO dates and an unknown month', () => {
    expect(validateNewsletterExtraction({ ...base, month: 'Smarch' }).join(' ')).toMatch(/invalid month/);
    const x = { ...base, jolTimetable: { days: [{ date: '2026-02-30', weekday: 'Monday', classI: 'a', classII: 'b' }] } };
    expect(validateNewsletterExtraction(x).join(' ')).toMatch(/invalid date 2026-02-30/);
  });
});

function fakeDb(existing: { monthKey: string } | null = null) {
  return {
    importedNewsletterMonth: { findFirst: vi.fn(async () => existing) },
    importedJolSchedule: {},
    importedJolScheduleDay: {},
    $transaction: vi.fn(async () => undefined),
  };
}

describe('newsletter ingest keeps last valid data on failure', () => {
  const pdf = Buffer.from('%PDF-1.4 fake newsletter bytes '.repeat(50));

  it('does not write anything when validation fails', async () => {
    const db = fakeDb();
    const bad = { ...base, jolTimetable: { days: [{ date: '2026-10-20', weekday: 'Friday', classI: 'a', classII: 'b' }] } };
    const r = await ingestNewsletterPdf({ bytes: pdf }, { db: db as never, extract: async () => bad });
    expect(r.status).toBe('FAILED');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('does not write anything when Gemini extraction throws', async () => {
    const db = fakeDb();
    const r = await ingestNewsletterPdf(
      { bytes: pdf },
      { db: db as never, extract: async () => { throw new Error('quota'); } },
    );
    expect(r.status).toBe('FAILED');
    expect(r.errors[0]).toMatch(/quota/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('skips extraction when the same PDF hash was already applied', async () => {
    const db = fakeDb({ monthKey: '2026-09' });
    const extract = vi.fn();
    const r = await ingestNewsletterPdf({ bytes: pdf }, { db: db as never, extract });
    expect(r).toEqual({ status: 'UNCHANGED', monthKey: '2026-09', errors: [] });
    expect(extract).not.toHaveBeenCalled();
  });

  it('applies a valid extraction in one transaction', async () => {
    const db = fakeDb();
    const r = await ingestNewsletterPdf({ bytes: pdf }, { db: db as never, extract: async () => base });
    expect(r.status).toBe('APPLIED');
    expect(r.monthKey).toBe('2026-10');
    expect(r.dayCount).toBe(1);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

function entry(key: string, source: PlannerMonthEntry['source'] = 'static'): PlannerMonthEntry {
  const [y, m] = key.split('-').map(Number);
  return { key, month: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'September', 'October'][m], year: y, monthlyPlanner: [], importantDates: [], source };
}

describe('planner month resolution (Asia/Kolkata month key)', () => {
  it('selects the current month when published', () => {
    const v = buildPlannerMonthView([entry('2026-09'), entry('2026-10', 'newsletter')], '2026-10');
    expect(v.selected?.key).toBe('2026-10');
    expect(v.missingCurrentMessage).toBeNull();
  });

  it('falls back to the latest month by its own name with a parent-safe line', () => {
    const v = buildPlannerMonthView([entry('2026-08'), entry('2026-09')], '2026-10');
    expect(v.selected?.key).toBe('2026-09');
    expect(v.selected?.month).toBe('September');
    expect(v.missingCurrentMessage).toBe("October's planner has not been published by the school yet.");
  });

  it('newsletter rows replace static JSON for the same month', () => {
    const merged = mergePlannerMonths([entry('2026-09', 'newsletter')], [entry('2026-08'), entry('2026-09')]);
    expect(merged.map((m) => `${m.key}:${m.source}`)).toEqual(['2026-08:static', '2026-09:newsletter']);
  });

  it('honours an explicitly requested month', () => {
    const v = buildPlannerMonthView([entry('2026-08'), entry('2026-09')], '2026-09', '2026-08');
    expect(v.selected?.key).toBe('2026-08');
  });
});

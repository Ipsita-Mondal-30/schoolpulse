import { describe, expect, it } from 'vitest';
import {
  assignedYmd,
  dueYmd,
  schoolYmd,
  hasSchoolProvidedDueDate,
} from '@/lib/homework-dates';

describe('canonical homework dates', () => {
  it('uses ass_dt/sentDate as assignedDate', () => {
    expect(assignedYmd({ sentDate: '2026-09-17', homeworkDate: '2026-09-17' })).toBe(
      '2026-09-17',
    );
  });

  it('uses dueDate only when the school provided one', () => {
    expect(
      dueYmd({ sentDate: '2026-09-17', submissionDate: '2026-09-22' }),
    ).toBe('2026-09-22');
    expect(dueYmd({ sentDate: '2026-09-17', dueDate: null })).toBe('');
    expect(hasSchoolProvidedDueDate({ sentDate: '2026-09-17' })).toBe(false);
  });

  it('places This Week on due date when present, else assigned date', () => {
    expect(
      schoolYmd({
        sentDate: '2026-09-21',
        submissionDate: '2026-09-23',
      }),
    ).toBe('2026-09-23');
    expect(schoolYmd({ sentDate: '2026-09-17' })).toBe('2026-09-17');
  });

  it('rejects MySQL zero dates', () => {
    expect(dueYmd({ dueDate: '0000-00-00' })).toBe('');
    expect(schoolYmd({ sentDate: '2026-09-17', dueDate: '0000-00-00' })).toBe(
      '2026-09-17',
    );
  });
});

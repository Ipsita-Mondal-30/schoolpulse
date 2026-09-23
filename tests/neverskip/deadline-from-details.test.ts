import { describe, expect, it } from 'vitest';
import { extractSchoolDeadlineFromDetails } from '@/lib/neverskip/deadline-from-details';

describe('extractSchoolDeadlineFromDetails', () => {
  it('reads EVS completion on 25 September using the assigned year', () => {
    expect(
      extractSchoolDeadlineFromDetails('EVS completion on 25 September', '2026-09-23'),
    ).toBe('2026-09-25');
  });

  it('reads Submission of book -16/9/26 and ignores the assigned restatement', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        "Today's Hindi Homework (15/09/26) Do Page No 12 in Sulekh pustika. Submission of book -16/9/26 Thankyou.",
        '2026-09-15',
      ),
    ).toBe('2026-09-16');
  });

  it('reads Kindly submit the book on Monday.(7-09-26)', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        "Today's Maths home work chapter-6 - Workbook pg -24,25,26 . Kindly submit the book on Monday.(7-09-26)",
        '2026-09-03',
      ),
    ).toBe('2026-09-07');
  });

  it('reads Submission Date 30.07.2026', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        '**Submission Date:** **30.07.2026 (Thursday)**',
        '2026-07-27',
      ),
    ).toBe('2026-07-30');
  });

  it('reads submit it on or before 10.08.26', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        'Submit it on or before 10.08.26 [Monday].',
        '2026-08-03',
      ),
    ).toBe('2026-08-10');
  });

  it('does not treat Today homework (17/09/26) as a deadline', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        "Today’s Hindi Homework (17/09/26)\nLearn poem - Bitiya Aayi 1- 4 Lines from Textbook page no 32\nThankyou.",
        '2026-09-17',
      ),
    ).toBeNull();
  });

  it('does not treat complete pending pages without a date as a deadline', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        'Complete all the pending pages from page no 15 to page no 38.',
        '2026-09-11',
      ),
    ).toBeNull();
  });

  it('does not treat Know your words conducted on as a homework due date', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        'Learn the given Key words for the know your words which will be conducted on Thursday 10.9.26',
        '2026-09-07',
      ),
    ).toBeNull();
  });

  it('does not treat a quiz date as due when Complete appears earlier in the notes', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        'Workbook- Complete pg 33 and 34. Learn the given Key words for the know your words which will be conducted on Friday 28.8.26',
        '2026-08-24',
      ),
    ).toBeNull();
  });

  it('rejects a submission date a year away from the assigned date', () => {
    expect(
      extractSchoolDeadlineFromDetails(
        "Today's Hindi homework Do Page No 22. Submission of Textbook-24/6/27",
        '2026-06-23',
      ),
    ).toBeNull();
  });
});

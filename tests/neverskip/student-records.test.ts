import { describe, expect, it } from 'vitest';
import {
  ACADEMIC_YEARS_PATH,
  ATTENDANCE_PATH,
  FEE_DETAILS_PATH,
  REPORT_CARDS_PATH,
  academicYearLabel,
  collectStudentRecords,
  parseAttendance,
  parseCurrentAcademicYear,
  parseFeeSummary,
  parseReportCards,
  portalDateToIso,
} from '@/lib/neverskip/student-records';
import { studentRecordsAccess } from '@/lib/student-records-access';

const YEARS = {
  S: true,
  D: [
    { refid: '3', name: '2025-26', acc_year: '2526', is_current: false },
    { refid: '4', name: '2026-27', acc_year: '2627', is_current: true },
  ],
  F: 'S',
};

const ATTENDANCE = {
  rstat: 'S',
  rdata: {
    table_data: [
      { month: 'May', workingday: 23, holiday: 8, absence: 'Nill', absenceday: '-', late: 'Nill', lateday: '-' },
      { month: 'October', workingday: 21, holiday: 10, absence: '2', absenceday: '06-10-2026, 07-10-2026', late: 'Nill', lateday: '-' },
      { month: 'November', workingday: 21, holiday: 9, absence: '-', absenceday: '-', late: '-', lateday: '-' },
    ],
  },
};

const REPORTS = {
  S: true,
  D: {
    exam: [],
    repdata: [
      {
        repdata_id: '384',
        rep_date: '03-08-2026',
        rep_time: '',
        rep_name: 'Pre-Mid Term Assessment I_II (I - A)',
        temp_url: '',
        temp_full_url: 'https://files.example.test/report-token',
      },
    ],
  },
  F: 'S',
};

const FEES = {
  S: true,
  D: {
    tabledata: [],
    paid_amount: [{ title: 'Paid Amount', desc: '', value: 0 }],
    total_due_amount: [{ title: 'Total Due', desc: '-', value: '12,500' }],
    next_due_amount: [{ title: 'Due Amount', desc: 'Term 2', value: 0 }],
    acc_year: '2627',
  },
  F: 'S',
};

describe('student records parsers', () => {
  it('reads the current academic year', () => {
    expect(parseCurrentAcademicYear(YEARS)).toEqual({ code: '2627', label: '2026-27' });
    expect(parseCurrentAcademicYear({ S: true, D: [] })).toBeNull();
    expect(academicYearLabel('2627')).toBe('2026-27');
  });

  it('keeps "Nill" (none) distinct from "-" (not recorded yet)', () => {
    const months = parseAttendance(ATTENDANCE, '2026-27')!;
    expect(months.map((m) => [m.month, m.monthIndex, m.absentDays])).toEqual([
      ['May', 0, 0],
      ['October', 1, 2],
      ['November', 2, null],
    ]);
    expect(months[1].absentDates).toBe('06-10-2026, 07-10-2026');
    expect(months[0].absentDates).toBe('');
    expect(months[2].lateDays).toBeNull();
    expect(parseAttendance({ rstat: 'F' }, '2026-27')).toBeNull();
  });

  it('parses report cards with ISO dates and the report link', () => {
    expect(parseReportCards(REPORTS, '2026-27')).toEqual([
      {
        sourceId: '384',
        academicYear: '2026-27',
        title: 'Pre-Mid Term Assessment I_II (I - A)',
        reportDate: '2026-08-03',
        reportTime: '',
        reportUrl: 'https://files.example.test/report-token',
      },
    ]);
    expect(portalDateToIso('3-8-2026')).toBe('2026-08-03');
    expect(parseReportCards({ S: false }, '2026-27')).toBeNull();
  });

  it('parses fee cards without inventing amounts', () => {
    expect(parseFeeSummary(FEES, '2026-27')).toEqual({
      academicYear: '2026-27',
      paidAmount: 0,
      totalDue: 12500,
      nextDue: 0,
      nextDueLabel: 'Term 2',
      detailsJson: '[]',
    });
    expect(parseFeeSummary({ S: true, D: { tabledata: [] } }, '2026-27')).toBeNull();
  });
});

describe('collectStudentRecords', () => {
  it('fetches every module for the current year', async () => {
    const calls: Array<[string, unknown]> = [];
    const bodies: Record<string, unknown> = {
      [ACADEMIC_YEARS_PATH]: YEARS,
      [ATTENDANCE_PATH]: ATTENDANCE,
      [REPORT_CARDS_PATH]: REPORTS,
      [FEE_DETAILS_PATH]: FEES,
    };
    const out = await collectStudentRecords(async (path, body) => {
      calls.push([path, body]);
      return bodies[path];
    });
    expect(out.errors).toEqual([]);
    expect(out.attendance).toHaveLength(3);
    expect(out.reportCards).toHaveLength(1);
    expect(out.fees?.totalDue).toBe(12500);
    expect(calls).toContainEqual([REPORT_CARDS_PATH, { acc_year: '2627' }]);
  });

  it('keeps other modules when one fails, and reports the failure', async () => {
    const out = await collectStudentRecords(async (path) => {
      if (path === ATTENDANCE_PATH) throw new Error('HTTP 500');
      if (path === FEE_DETAILS_PATH) return { S: false };
      return path === ACADEMIC_YEARS_PATH ? YEARS : REPORTS;
    });
    expect(out.attendance).toBeNull();
    expect(out.fees).toBeNull();
    expect(out.reportCards).toHaveLength(1);
    expect(out.errors).toEqual(['attendance: HTTP 500', 'fees: unexpected response']);
  });

  it('stops without a current academic year', async () => {
    const out = await collectStudentRecords(async () => ({ S: true, D: [] }));
    expect(out.attendance).toBeNull();
    expect(out.errors).toEqual(['academic years: no current academic year in response']);
  });
});

describe('studentRecordsAccess', () => {
  it('requires sign-in and an explicit allowlist', () => {
    expect(studentRecordsAccess(null, 'a@x.test')).toBe('signed_out');
    expect(studentRecordsAccess('a@x.test', undefined)).toBe('not_configured');
    expect(studentRecordsAccess('b@x.test', 'a@x.test')).toBe('not_allowed');
    expect(studentRecordsAccess('A@X.test', ' a@x.test , c@x.test')).toBe('allowed');
  });
});

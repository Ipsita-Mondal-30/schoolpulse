/**
 * Per-student NeverSkip records: monthly attendance, report cards and the fee summary.
 * These are private to the synced child — persist them only through
 * student-records-store.ts and show them only to allowlisted parent accounts.
 */

export const ACADEMIC_YEARS_PATH = '/parentweb/support/getallaccyear';
export const ATTENDANCE_PATH = '/parentweb/profile/getstuattendance';
export const REPORT_CARDS_PATH = '/parentweb/academic/getacademicsdetailsapi';
export const FEE_DETAILS_PATH = '/parentweb/fees/getfeedetails';

export type AcademicYear = { code: string; label: string };

export type AttendanceMonth = {
  academicYear: string;
  /** Position in the academic year as listed by NeverSkip (0 = first month). */
  monthIndex: number;
  month: string;
  workingDays: number | null;
  holidays: number | null;
  /** null when the school has not recorded attendance for the month yet ("-"). */
  absentDays: number | null;
  absentDates: string;
  lateDays: number | null;
  lateDates: string;
};

export type ReportCard = {
  sourceId: string;
  academicYear: string;
  title: string;
  /** YYYY-MM-DD */
  reportDate: string;
  reportTime: string;
  reportUrl: string | null;
};

export type FeeSummary = {
  academicYear: string;
  paidAmount: number | null;
  totalDue: number | null;
  nextDue: number | null;
  nextDueLabel: string;
  detailsJson: string;
};

export type CollectedStudentRecords = {
  academicYear: AcademicYear | null;
  /** null = not fetched or unparseable; keep the stored rows. */
  attendance: AttendanceMonth[] | null;
  reportCards: ReportCard[] | null;
  fees: FeeSummary | null;
  errors: string[];
};

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function toCount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = str(v);
  if (/^nill?$/i.test(s)) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
}

function toAmount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = str(v).replace(/[₹,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function detailText(v: unknown): string {
  const s = str(v);
  return s === '-' || /^nill?$/i.test(s) ? '' : s;
}

/** "2627" → "2026-27" */
export function academicYearLabel(code: string): string {
  const m = /^(\d{2})(\d{2})$/.exec(code.trim());
  return m ? `20${m[1]}-${m[2]}` : code.trim();
}

/** dd-mm-yyyy (NeverSkip) → yyyy-mm-dd */
export function portalDateToIso(raw: string): string {
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw.trim());
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function httpUrl(raw: string): string | null {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseCurrentAcademicYear(body: unknown): AcademicYear | null {
  if (!isObj(body) || !Array.isArray(body.D)) return null;
  const rows = body.D.filter(isObj);
  const current = rows.find((r) => r.is_current === true || str(r.is_current) === 'true') ?? null;
  if (!current) return null;
  const code = str(current.acc_year);
  if (!/^\d{4}$/.test(code)) return null;
  return { code, label: str(current.name) || academicYearLabel(code) };
}

export function parseAttendance(body: unknown, academicYear: string): AttendanceMonth[] | null {
  if (!isObj(body) || str(body.rstat) !== 'S' || !isObj(body.rdata)) return null;
  const table = body.rdata.table_data;
  if (!Array.isArray(table)) return null;
  const months: AttendanceMonth[] = [];
  table.forEach((row, index) => {
    if (!isObj(row) || !str(row.month)) return;
    months.push({
      academicYear,
      monthIndex: index,
      month: str(row.month),
      workingDays: toCount(row.workingday),
      holidays: toCount(row.holiday),
      absentDays: toCount(row.absence),
      absentDates: detailText(row.absenceday),
      lateDays: toCount(row.late),
      lateDates: detailText(row.lateday),
    });
  });
  return months;
}

export function parseReportCards(body: unknown, academicYear: string): ReportCard[] | null {
  if (!isObj(body) || body.S !== true || !isObj(body.D)) return null;
  const rows = body.D.repdata;
  if (!Array.isArray(rows)) return null;
  return rows.filter(isObj).flatMap((row) => {
    const sourceId = str(row.repdata_id);
    const title = str(row.rep_name);
    if (!sourceId || !title) return [];
    return [
      {
        sourceId,
        academicYear,
        title,
        reportDate: portalDateToIso(str(row.rep_date)),
        reportTime: str(row.rep_time),
        reportUrl: httpUrl(str(row.temp_full_url) || str(row.temp_url)),
      },
    ];
  });
}

function firstCard(v: unknown): Obj | null {
  return Array.isArray(v) && isObj(v[0]) ? v[0] : null;
}

export function parseFeeSummary(body: unknown, fallbackYear: string): FeeSummary | null {
  if (!isObj(body) || body.S !== true || !isObj(body.D)) return null;
  const d = body.D;
  const paid = firstCard(d.paid_amount);
  const total = firstCard(d.total_due_amount);
  const next = firstCard(d.next_due_amount);
  if (!paid && !total && !next) return null;
  const code = str(d.acc_year);
  return {
    academicYear: /^\d{4}$/.test(code) ? academicYearLabel(code) : fallbackYear,
    paidAmount: paid ? toAmount(paid.value) : null,
    totalDue: total ? toAmount(total.value) : null,
    nextDue: next ? toAmount(next.value) : null,
    nextDueLabel: next ? detailText(next.desc) : '',
    detailsJson: JSON.stringify(Array.isArray(d.tabledata) ? d.tabledata : []),
  };
}

/**
 * Fetch the three per-student modules through an authenticated session POST.
 * Each module fails independently; a null stream means "keep what is stored".
 */
export async function collectStudentRecords(
  post: (path: string, body: unknown) => Promise<unknown | null>,
): Promise<CollectedStudentRecords> {
  const out: CollectedStudentRecords = {
    academicYear: null,
    attendance: null,
    reportCards: null,
    fees: null,
    errors: [],
  };

  try {
    out.academicYear = parseCurrentAcademicYear(await post(ACADEMIC_YEARS_PATH, {}));
  } catch (err) {
    out.errors.push(`academic years: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!out.academicYear) {
    out.errors.push('academic years: no current academic year in response');
    return out;
  }
  const year = out.academicYear.label;

  try {
    out.attendance = parseAttendance(await post(ATTENDANCE_PATH, {}), year);
    if (!out.attendance) out.errors.push('attendance: unexpected response');
  } catch (err) {
    out.errors.push(`attendance: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    out.reportCards = parseReportCards(
      await post(REPORT_CARDS_PATH, { acc_year: out.academicYear.code }),
      year,
    );
    if (!out.reportCards) out.errors.push('report cards: unexpected response');
  } catch (err) {
    out.errors.push(`report cards: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    out.fees = parseFeeSummary(await post(FEE_DETAILS_PATH, {}), year);
    if (!out.fees) out.errors.push('fees: unexpected response');
  } catch (err) {
    out.errors.push(`fees: ${err instanceof Error ? err.message : String(err)}`);
  }

  return out;
}

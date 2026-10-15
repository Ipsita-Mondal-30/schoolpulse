'use server';

import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { NEVERSKIP_SOURCE } from '@/lib/neverskip/types';
import { resolveConfiguredNeverSkipStudentId } from '@/lib/synced-child';
import { studentRecordsAccess } from '@/lib/student-records-access';

export type StudentRecordsView =
  | { state: 'signed_out' | 'not_configured' | 'not_allowed' }
  | {
      state: 'ok';
      academicYear: string | null;
      attendance: Array<{
        month: string;
        workingDays: number | null;
        holidays: number | null;
        absentDays: number | null;
        absentDates: string;
        lateDays: number | null;
        lateDates: string;
      }>;
      reportCards: Array<{ id: string; title: string; reportDate: string; reportUrl: string | null }>;
      fees: {
        academicYear: string;
        paidAmount: number | null;
        totalDue: number | null;
        nextDue: number | null;
        nextDueLabel: string;
      } | null;
      /** Last time a sync inserted or changed any of these rows (ISO). */
      updatedAt: string | null;
    };

/** Private per-child records — never cached server-side or persisted client-side. */
export async function loadStudentRecords(): Promise<StudentRecordsView> {
  let email: string | null = null;
  try {
    const session = await auth();
    email = session?.user?.email ?? null;
  } catch {
    email = null;
  }
  const access = studentRecordsAccess(email, process.env.STUDENT_RECORDS_EMAILS);
  if (access !== 'allowed') return { state: access };

  const prisma = getPrisma();
  const studentKey = resolveConfiguredNeverSkipStudentId();
  const where = { source: NEVERSKIP_SOURCE, studentKey };

  const latestYear = await prisma.importedAttendanceMonth.findFirst({
    where,
    orderBy: { academicYear: 'desc' },
    select: { academicYear: true },
  });
  const academicYear = latestYear?.academicYear ?? null;

  const [attendance, reportCards, fees] = await Promise.all([
    academicYear
      ? prisma.importedAttendanceMonth.findMany({
          where: { ...where, academicYear },
          orderBy: { monthIndex: 'asc' },
        })
      : Promise.resolve([]),
    prisma.importedReportCard.findMany({ where, orderBy: { reportDate: 'desc' } }),
    prisma.importedFeeSummary.findFirst({ where, orderBy: { academicYear: 'desc' } }),
  ]);

  const stamps = [...attendance, ...reportCards, ...(fees ? [fees] : [])].map((r) =>
    r.updatedAt.getTime(),
  );

  return {
    state: 'ok',
    academicYear,
    attendance: attendance.map((m) => ({
      month: m.month,
      workingDays: m.workingDays,
      holidays: m.holidays,
      absentDays: m.absentDays,
      absentDates: m.absentDates,
      lateDays: m.lateDays,
      lateDates: m.lateDates,
    })),
    reportCards: reportCards.map((r) => ({
      id: r.id,
      title: r.title,
      reportDate: r.reportDate,
      reportUrl: r.reportUrl,
    })),
    fees: fees
      ? {
          academicYear: fees.academicYear,
          paidAmount: fees.paidAmount,
          totalDue: fees.totalDue,
          nextDue: fees.nextDue,
          nextDueLabel: fees.nextDueLabel,
        }
      : null,
    updatedAt: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null,
  };
}

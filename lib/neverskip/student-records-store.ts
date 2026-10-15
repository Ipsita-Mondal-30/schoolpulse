import type { PrismaClient } from '@prisma/client';
import { NEVERSKIP_SOURCE } from './types';
import type {
  AttendanceMonth,
  CollectedStudentRecords,
  FeeSummary,
  ReportCard,
} from './student-records';

export type WriteCounts = { fetched: number; inserted: number; updated: number; unchanged: number };

export type StudentRecordsWriteResult = {
  attendance: WriteCounts | null;
  reportCards: WriteCounts | null;
  fees: WriteCounts | null;
};

function emptyCounts(fetched: number): WriteCounts {
  return { fetched, inserted: 0, updated: 0, unchanged: 0 };
}

function sameFields<T extends object>(row: T, next: Partial<T>): boolean {
  return (Object.keys(next) as Array<keyof T>).every((k) => row[k] === next[k]);
}

async function writeAttendance(
  prisma: PrismaClient,
  studentKey: string,
  months: AttendanceMonth[],
): Promise<WriteCounts> {
  const counts = emptyCounts(months.length);
  for (const m of months) {
    const where = {
      source_studentKey_academicYear_month: {
        source: NEVERSKIP_SOURCE,
        studentKey,
        academicYear: m.academicYear,
        month: m.month,
      },
    };
    const data = {
      monthIndex: m.monthIndex,
      workingDays: m.workingDays,
      holidays: m.holidays,
      absentDays: m.absentDays,
      absentDates: m.absentDates,
      lateDays: m.lateDays,
      lateDates: m.lateDates,
    };
    const existing = await prisma.importedAttendanceMonth.findUnique({ where });
    if (!existing) {
      await prisma.importedAttendanceMonth.create({
        data: { source: NEVERSKIP_SOURCE, studentKey, academicYear: m.academicYear, month: m.month, ...data },
      });
      counts.inserted += 1;
    } else if (sameFields(existing, data)) {
      counts.unchanged += 1;
    } else {
      await prisma.importedAttendanceMonth.update({ where, data });
      counts.updated += 1;
    }
  }
  return counts;
}

async function writeReportCards(
  prisma: PrismaClient,
  studentKey: string,
  cards: ReportCard[],
): Promise<WriteCounts> {
  const counts = emptyCounts(cards.length);
  for (const c of cards) {
    const where = {
      source_studentKey_sourceId: { source: NEVERSKIP_SOURCE, studentKey, sourceId: c.sourceId },
    };
    const data = {
      academicYear: c.academicYear,
      title: c.title,
      reportDate: c.reportDate,
      reportTime: c.reportTime,
      reportUrl: c.reportUrl,
    };
    const existing = await prisma.importedReportCard.findUnique({ where });
    if (!existing) {
      await prisma.importedReportCard.create({
        data: { source: NEVERSKIP_SOURCE, studentKey, sourceId: c.sourceId, ...data },
      });
      counts.inserted += 1;
    } else if (sameFields(existing, data)) {
      counts.unchanged += 1;
    } else {
      await prisma.importedReportCard.update({ where, data });
      counts.updated += 1;
    }
  }
  return counts;
}

async function writeFees(
  prisma: PrismaClient,
  studentKey: string,
  fees: FeeSummary,
): Promise<WriteCounts> {
  const counts = emptyCounts(1);
  const where = {
    source_studentKey_academicYear: {
      source: NEVERSKIP_SOURCE,
      studentKey,
      academicYear: fees.academicYear,
    },
  };
  const data = {
    paidAmount: fees.paidAmount,
    totalDue: fees.totalDue,
    nextDue: fees.nextDue,
    nextDueLabel: fees.nextDueLabel,
    detailsJson: fees.detailsJson,
  };
  const existing = await prisma.importedFeeSummary.findUnique({ where });
  if (!existing) {
    await prisma.importedFeeSummary.create({
      data: { source: NEVERSKIP_SOURCE, studentKey, academicYear: fees.academicYear, ...data },
    });
    counts.inserted += 1;
  } else if (sameFields(existing, data)) {
    counts.unchanged += 1;
  } else {
    await prisma.importedFeeSummary.update({ where, data });
    counts.updated += 1;
  }
  return counts;
}

/**
 * Upsert only the streams that were fetched and parsed; a null stream leaves the
 * stored rows untouched. Rows missing from the source are never deleted here.
 */
export async function persistStudentRecords(
  prisma: PrismaClient,
  studentKey: string,
  records: CollectedStudentRecords,
): Promise<StudentRecordsWriteResult> {
  return {
    attendance: records.attendance ? await writeAttendance(prisma, studentKey, records.attendance) : null,
    reportCards: records.reportCards
      ? await writeReportCards(prisma, studentKey, records.reportCards)
      : null,
    fees: records.fees ? await writeFees(prisma, studentKey, records.fees) : null,
  };
}

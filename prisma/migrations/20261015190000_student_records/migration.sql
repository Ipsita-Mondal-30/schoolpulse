-- CreateTable
CREATE TABLE "ImportedAttendanceMonth" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'neverskip',
    "studentKey" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "workingDays" INTEGER,
    "holidays" INTEGER,
    "absentDays" INTEGER,
    "absentDates" TEXT NOT NULL DEFAULT '',
    "lateDays" INTEGER,
    "lateDates" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedAttendanceMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedReportCard" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'neverskip',
    "studentKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL DEFAULT '',
    "reportTime" TEXT NOT NULL DEFAULT '',
    "reportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedFeeSummary" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'neverskip',
    "studentKey" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "paidAmount" DOUBLE PRECISION,
    "totalDue" DOUBLE PRECISION,
    "nextDue" DOUBLE PRECISION,
    "nextDueLabel" TEXT NOT NULL DEFAULT '',
    "detailsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedFeeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportedAttendanceMonth_studentKey_academicYear_idx" ON "ImportedAttendanceMonth"("studentKey", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedAttendanceMonth_source_studentKey_academicYear_mont_key" ON "ImportedAttendanceMonth"("source", "studentKey", "academicYear", "month");

-- CreateIndex
CREATE INDEX "ImportedReportCard_studentKey_reportDate_idx" ON "ImportedReportCard"("studentKey", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedReportCard_source_studentKey_sourceId_key" ON "ImportedReportCard"("source", "studentKey", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedFeeSummary_source_studentKey_academicYear_key" ON "ImportedFeeSummary"("source", "studentKey", "academicYear");


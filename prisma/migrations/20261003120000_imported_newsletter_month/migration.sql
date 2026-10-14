-- Monthly newsletter planner + PDF bytes (source-driven Planner / JoL timetable). Additive only.
CREATE TABLE IF NOT EXISTS "ImportedNewsletterMonth" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT,
    "sourceContentHash" TEXT NOT NULL,
    "sourceDocumentUrl" TEXT,
    "pdfBytes" BYTEA,
    "plannerJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedNewsletterMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImportedNewsletterMonth_monthKey_key" ON "ImportedNewsletterMonth"("monthKey");
CREATE INDEX IF NOT EXISTS "ImportedNewsletterMonth_sourceContentHash_idx" ON "ImportedNewsletterMonth"("sourceContentHash");
CREATE INDEX IF NOT EXISTS "ImportedNewsletterMonth_sourceDocumentUrl_idx" ON "ImportedNewsletterMonth"("sourceDocumentUrl");

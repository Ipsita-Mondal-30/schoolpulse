-- CreateTable
CREATE TABLE "HomeworkDeadlineExtraction" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'neverskip',
    "sourceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "hasDueDate" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'NONE',
    "evidence" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'NONE',
    "relatedSourceId" TEXT,
    "relatedEntityType" TEXT,
    "sourceText" TEXT NOT NULL DEFAULT '',
    "reason" TEXT,
    "model" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkDeadlineExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkDeadlineExtraction_entityType_source_sourceId_key" ON "HomeworkDeadlineExtraction"("entityType", "source", "sourceId");

-- CreateIndex
CREATE INDEX "HomeworkDeadlineExtraction_dueDate_confidence_idx" ON "HomeworkDeadlineExtraction"("dueDate", "confidence");

-- CreateIndex
CREATE INDEX "HomeworkDeadlineExtraction_contentHash_idx" ON "HomeworkDeadlineExtraction"("contentHash");

-- CreateIndex
CREATE INDEX "HomeworkDeadlineExtraction_entityType_dueDate_idx" ON "HomeworkDeadlineExtraction"("entityType", "dueDate");

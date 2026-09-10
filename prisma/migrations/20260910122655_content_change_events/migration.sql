-- CreateTable
CREATE TABLE "ContentChangeEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'neverskip',
    "sourceId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changedFieldsJson" TEXT NOT NULL,
    "previousSnapshotJson" TEXT NOT NULL,
    "currentSnapshotJson" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentChangeEvent_detectedAt_idx" ON "ContentChangeEvent"("detectedAt");

-- CreateIndex
CREATE INDEX "ContentChangeEvent_entityType_detectedAt_idx" ON "ContentChangeEvent"("entityType", "detectedAt");

-- CreateIndex
CREATE INDEX "ContentChangeEvent_source_sourceId_idx" ON "ContentChangeEvent"("source", "sourceId");

-- CreateTable HomeworkVideo (idempotent 1:1 AI lesson video per ImportedHomework)
CREATE TABLE IF NOT EXISTS "HomeworkVideo" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lessonJson" TEXT NOT NULL DEFAULT '{}',
    "videoUrl" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'veo',
    "providerJobId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HomeworkVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkVideo_homeworkId_key" ON "HomeworkVideo"("homeworkId");
CREATE INDEX IF NOT EXISTS "HomeworkVideo_status_idx" ON "HomeworkVideo"("status");
CREATE INDEX IF NOT EXISTS "HomeworkVideo_createdAt_idx" ON "HomeworkVideo"("createdAt");

DO $$
BEGIN
  ALTER TABLE "HomeworkVideo" ADD CONSTRAINT "HomeworkVideo_homeworkId_fkey"
    FOREIGN KEY ("homeworkId") REFERENCES "ImportedHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

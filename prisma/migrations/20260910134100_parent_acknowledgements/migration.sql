-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable HomeworkAcknowledgement
CREATE TABLE IF NOT EXISTS "HomeworkAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable NoticeAcknowledgement
CREATE TABLE IF NOT EXISTS "NoticeAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkAcknowledgement_userId_homeworkId_key" ON "HomeworkAcknowledgement"("userId", "homeworkId");
CREATE INDEX IF NOT EXISTS "HomeworkAcknowledgement_userId_idx" ON "HomeworkAcknowledgement"("userId");
CREATE INDEX IF NOT EXISTS "HomeworkAcknowledgement_homeworkId_idx" ON "HomeworkAcknowledgement"("homeworkId");
CREATE INDEX IF NOT EXISTS "HomeworkAcknowledgement_acknowledgedAt_idx" ON "HomeworkAcknowledgement"("acknowledgedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "NoticeAcknowledgement_userId_noticeId_key" ON "NoticeAcknowledgement"("userId", "noticeId");
CREATE INDEX IF NOT EXISTS "NoticeAcknowledgement_userId_idx" ON "NoticeAcknowledgement"("userId");
CREATE INDEX IF NOT EXISTS "NoticeAcknowledgement_noticeId_idx" ON "NoticeAcknowledgement"("noticeId");
CREATE INDEX IF NOT EXISTS "NoticeAcknowledgement_acknowledgedAt_idx" ON "NoticeAcknowledgement"("acknowledgedAt");

DO $$ BEGIN
  ALTER TABLE "HomeworkAcknowledgement" ADD CONSTRAINT "HomeworkAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HomeworkAcknowledgement" ADD CONSTRAINT "HomeworkAcknowledgement_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "ImportedHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "ImportedNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

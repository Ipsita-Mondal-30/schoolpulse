-- Preserve every homework/notice attachment and cap homework video attempts. Additive only.
ALTER TABLE "ImportedHomework" ADD COLUMN IF NOT EXISTS "attachmentsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ImportedNotice" ADD COLUMN IF NOT EXISTS "attachmentsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "HomeworkVideo" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

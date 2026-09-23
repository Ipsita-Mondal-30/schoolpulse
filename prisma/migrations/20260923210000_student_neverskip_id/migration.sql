-- Canonical NeverSkip student identity on Student (idempotent)
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "neverSkipStudentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Student_neverSkipStudentId_key"
  ON "Student"("neverSkipStudentId");

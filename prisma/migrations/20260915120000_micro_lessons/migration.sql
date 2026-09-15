-- CreateTable MicroLesson
CREATE TABLE IF NOT EXISTS "MicroLesson" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "slides" TEXT NOT NULL,
    "quiz" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable QuizAttempt
CREATE TABLE IF NOT EXISTS "QuizAttempt" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MicroLesson_homeworkId_key" ON "MicroLesson"("homeworkId");
CREATE INDEX IF NOT EXISTS "MicroLesson_createdAt_idx" ON "MicroLesson"("createdAt");
CREATE INDEX IF NOT EXISTS "QuizAttempt_lessonId_idx" ON "QuizAttempt"("lessonId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_completedAt_idx" ON "QuizAttempt"("completedAt");

DO $$ BEGIN
  ALTER TABLE "MicroLesson" ADD CONSTRAINT "MicroLesson_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "ImportedHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "MicroLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

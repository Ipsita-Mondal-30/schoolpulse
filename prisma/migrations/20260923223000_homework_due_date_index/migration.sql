-- Index dueDate for This Week / recap due lookups (idempotent).
CREATE INDEX IF NOT EXISTS "ImportedHomework_dueDate_idx" ON "ImportedHomework"("dueDate");

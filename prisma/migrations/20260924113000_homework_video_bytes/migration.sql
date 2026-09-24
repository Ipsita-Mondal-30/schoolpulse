-- Persist short Veo MP4 bytes on HomeworkVideo for Neon-backed playback (Vercel-safe).
ALTER TABLE "HomeworkVideo" ADD COLUMN IF NOT EXISTS "videoBytes" BYTEA;

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  INSUFFICIENT_SOURCE,
  assessHomeworkVideoEligibility,
  buildVeoPromptFromLesson,
  validateHomeworkLessonPlan,
} from '@/lib/ai/homework-lesson';
import { VIDEO_STATUS, PARENT_VIDEO_ERROR } from '@/lib/ai/homework-video';
import {
  LocalVideoStorage,
  setVideoStorageForTests,
} from '@/lib/ai/video-storage';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('homework lesson eligibility', () => {
  it('rejects page-only homework as insufficient source', () => {
    const result = assessHomeworkVideoEligibility({
      homework: {
        title: 'Complete page 42',
        description: 'Do page 42 in the notebook',
        subject: 'English',
      },
    });
    expect(result.eligible).toBe(false);
  });

  it('accepts revisable learning topics with enough wording', () => {
    const result = assessHomeworkVideoEligibility({
      homework: {
        title: 'Revise Our Clothes',
        description: 'Revise the chapter Our Clothes — types of clothes we wear in different seasons.',
        subject: 'Environmental Science',
      },
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.topic.toLowerCase()).toMatch(/cloth/);
    }
  });
});

describe('homework lesson plan validation', () => {
  it('validates a minimal plan', () => {
    const plan = validateHomeworkLessonPlan({
      title: "Let's Learn About Our Clothes!",
      subject: 'Environmental Science',
      learningObjective: 'Name clothes we wear',
      sourceConfidence: 'high',
      scenes: [
        {
          sceneNumber: 1,
          type: 'intro',
          narration: 'Hello!',
          visualPrompt: 'Friendly classroom',
          onScreenText: '',
        },
        {
          sceneNumber: 2,
          type: 'teach',
          narration: 'We wear different clothes',
          visualPrompt: 'Kids in summer and winter clothes',
          onScreenText: '',
        },
      ],
      videoPrompt:
        'Friendly colorful educational animation about clothes for Class 1 children in a bright classroom, no written text.',
    });
    expect(plan.eligible).toBe(true);
    expect(plan.scenes).toHaveLength(2);
    expect(buildVeoPromptFromLesson(plan).length).toBeGreaterThan(20);
  });
});

describe('video storage', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sp-vid-'));
    setVideoStorageForTests(new LocalVideoStorage(dir));
  });

  it('saves and reads mp4 bytes under a safe key', async () => {
    const storage = new LocalVideoStorage(dir);
    const bytes = Buffer.from('fake-mp4-bytes-xxxxx');
    const saved = await storage.save('homework/abc.mp4', bytes);
    expect(storage.exists('homework/abc.mp4')).toBe(true);
    expect(storage.read('homework/abc.mp4')?.equals(bytes)).toBe(true);
    expect(saved.absolutePath.includes('homework')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
    setVideoStorageForTests(null);
  });

  it('rejects path traversal keys', async () => {
    const storage = new LocalVideoStorage(dir);
    await expect(
      Promise.resolve().then(() => storage.save('../etc/passwd', Buffer.from('x'))),
    ).rejects.toThrow(/Invalid video storage key/);
    rmSync(dir, { recursive: true, force: true });
    setVideoStorageForTests(null);
  });
});

describe('parent-facing constants', () => {
  it('does not expose provider names in parent error copy', () => {
    expect(PARENT_VIDEO_ERROR.toLowerCase()).not.toMatch(/veo|gemini|api|operation/);
    expect(VIDEO_STATUS.READY).toBe('READY');
    expect(VIDEO_STATUS.QUEUED).toBe('QUEUED');
    expect(INSUFFICIENT_SOURCE).toBe('INSUFFICIENT_SOURCE');
  });
});

describe('recap UI separates video from interactive practice', () => {
  it('RecapTopicCard labels AI Video and Interactive Practice separately', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      join(process.cwd(), 'components/recap/RecapTopicCard.tsx'),
      'utf8',
    );
    expect(src).toMatch(/AI Video/);
    expect(src).toMatch(/Interactive Practice/);
    expect(src).toMatch(/Watch AI Video/);
    expect(src).toMatch(/\/api\/homework\/.*\/video/);
    expect(src).toMatch(/\/api\/recap\/generate/);
    expect(src).not.toMatch(/GOOGLE_GENERATIVE_AI_API_KEY|AIza/);
  });

  it('recap hub no longer routes Start recap into quiz-only CTA', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(join(process.cwd(), 'app/recap/page.tsx'), 'utf8');
    expect(src).toMatch(/RecapTopicCard/);
    expect(src).not.toMatch(/Start recap →/);
  });
});

describe('video job idempotency helpers', () => {
  it('video route source enqueues instead of awaiting Veo inline', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      join(process.cwd(), 'app/api/homework/[id]/video/route.ts'),
      'utf8',
    );
    expect(src).toMatch(/enqueueHomeworkVideo/);
    expect(src).toMatch(/after\(/);
    expect(src).not.toMatch(/await generateHomeworkVideo/);
  });

  it('HomeworkAiLessonButton polls status and never embeds API keys', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      join(process.cwd(), 'components/HomeworkAiLessonButton.tsx'),
      'utf8',
    );
    expect(src).toMatch(/setInterval/);
    expect(src).toMatch(/\/api\/homework\/.*\/video/);
    expect(src).not.toMatch(/GOOGLE_GENERATIVE_AI_API_KEY|VEO_MODEL|AIza/);
  });
});

describe('API key must stay server-side', () => {
  it('HomeworkAiLessonButton source does not reference GOOGLE_GENERATIVE_AI_API_KEY', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      join(process.cwd(), 'components/HomeworkAiLessonButton.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/GOOGLE_GENERATIVE_AI_API_KEY|VEO_MODEL|AIza/);
  });
});

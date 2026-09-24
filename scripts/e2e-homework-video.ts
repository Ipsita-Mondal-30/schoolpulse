/**
 * One-off E2E probe for Hindi homework video/recap pipeline.
 * Usage: npx tsx scripts/e2e-homework-video.ts
 */
import { config } from 'dotenv';
config();

async function main() {
  const { generateMicroLessonForHomework } = await import('../lib/recap/generate');
  const { generateHomeworkLessonPlan } = await import('../lib/ai/homework-lesson');
  const {
    enqueueHomeworkVideo,
    processHomeworkVideoJob,
    getHomeworkVideoStatus,
  } = await import('../lib/ai/homework-video');
  const { getPrisma } = await import('../lib/prisma');

  const HOMEWORK_ID = 'cmuffn0te00006naidic4sy8p';

  console.log(
    '=== Gemini API key configured:',
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ? 'YES' : 'NO',
  );
  console.log('=== GEMINI_MODEL:', process.env.GEMINI_MODEL);
  console.log('=== VEO_MODEL:', process.env.VEO_MODEL || '(default)');

  console.log('\n--- 1) Recap micro-lesson (Start recap path) ---');
  const recap = await generateMicroLessonForHomework(HOMEWORK_ID, { force: true });
  console.log(
    'Recap:',
    JSON.stringify(
      recap.ok
        ? {
            ok: true,
            lessonId: recap.lesson.id,
            topic: recap.lesson.topic,
            title: recap.lesson.title,
          }
        : recap,
      null,
      2,
    ),
  );

  console.log('\n--- 2) Gemini video lesson plan ---');
  const prisma = getPrisma();
  const hw = await prisma.importedHomework.findUniqueOrThrow({
    where: { id: HOMEWORK_ID },
  });
  try {
    const plan = await generateHomeworkLessonPlan({
      homeworkId: hw.id,
      subject: hw.subjectName,
      title: hw.title,
      details: hw.description,
    });
    console.log(
      'Gemini lesson plan:',
      plan.eligible ? 'SUCCESS' : 'FAILED',
      JSON.stringify({
        eligible: plan.eligible,
        title: 'title' in plan ? plan.title : undefined,
        reason: 'reason' in plan ? plan.reason : undefined,
        scenes: 'scenes' in plan ? plan.scenes.length : undefined,
        videoPromptLen: 'videoPrompt' in plan ? plan.videoPrompt.length : undefined,
      }),
    );
  } catch (err) {
    console.log(
      'Gemini lesson plan: FAILED',
      err instanceof Error ? err.message.slice(0, 400) : err,
    );
  }

  console.log('\n--- 3) Enqueue video job ---');
  const enq = await enqueueHomeworkVideo(HOMEWORK_ID);
  console.log('Enqueue:', enq);

  console.log('\n--- 4) Process video job (Veo) ---');
  const processed = await processHomeworkVideoJob(HOMEWORK_ID);
  console.log('Process:', processed);

  const status = await getHomeworkVideoStatus(HOMEWORK_ID);
  console.log('DB status:', status);
  const row = await prisma.homeworkVideo.findUnique({
    where: { homeworkId: HOMEWORK_ID },
  });
  console.log('DB errorMessage (safe):', row?.errorMessage?.slice(0, 300));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

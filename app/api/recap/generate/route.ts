import { NextResponse } from 'next/server';
import { generateMicroLessonForHomework } from '@/lib/recap/generate';

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { homeworkId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const homeworkId = body.homeworkId?.trim();
  if (!homeworkId) {
    return NextResponse.json({ ok: false, message: 'homeworkId required' }, { status: 400 });
  }

  try {
    const result = await generateMicroLessonForHomework(homeworkId, {
      force: Boolean(body.force),
    });

    if (!result.ok) {
      const message =
        result.reason === 'ineligible'
          ? "SchoolPulse couldn't create a recap for this homework."
          : result.message || "Recap isn't available yet.";
      const status = result.reason === 'not_found' ? 404 : 200;
      return NextResponse.json(
        { ok: false, reason: result.reason, message },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      lessonId: result.lesson.id,
      topic: result.lesson.topic,
      subject: result.lesson.subject,
      title: result.lesson.title,
      created: result.created,
    });
  } catch (err) {
    console.error('[recap/generate]', err);
    return NextResponse.json(
      { ok: false, reason: 'unavailable', message: "Recap isn't available yet." },
      { status: 200 },
    );
  }
}

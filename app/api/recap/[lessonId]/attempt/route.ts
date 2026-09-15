import { NextResponse } from 'next/server';
import { recordQuizAttempt } from '@/lib/recap/today';

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { lessonId } = await context.params;
  if (!lessonId) {
    return NextResponse.json({ ok: false, message: 'lessonId required' }, { status: 400 });
  }

  let body: { answers?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.answers) || body.answers.some((n) => typeof n !== 'number')) {
    return NextResponse.json({ ok: false, message: 'answers required' }, { status: 400 });
  }

  try {
    const result = await recordQuizAttempt(lessonId, body.answers);
    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      score: result.score,
      total: result.total,
      attemptId: result.attempt.id,
    });
  } catch (err) {
    console.error('[recap/attempt]', err);
    return NextResponse.json({ ok: false, message: 'Could not save attempt' }, { status: 500 });
  }
}

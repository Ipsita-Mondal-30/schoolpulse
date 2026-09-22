import { NextResponse } from 'next/server';
import { checkQuizAnswer } from '@/lib/recap/today';

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { lessonId } = await context.params;
  if (!lessonId) {
    return NextResponse.json({ ok: false, message: 'lessonId required' }, { status: 400 });
  }

  let body: { questionIndex?: number; answerIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body.questionIndex !== 'number' ||
    typeof body.answerIndex !== 'number'
  ) {
    return NextResponse.json(
      { ok: false, message: 'questionIndex and answerIndex required' },
      { status: 400 },
    );
  }

  const result = await checkQuizAnswer(lessonId, body.questionIndex, body.answerIndex);
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result);
}

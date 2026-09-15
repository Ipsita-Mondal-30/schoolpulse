import { NextResponse } from 'next/server';
import { getTodaysRecap } from '@/lib/recap/today';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const section = url.searchParams.get('section') || 'I-A';
  const today = url.searchParams.get('today') || undefined;

  try {
    const result = await getTodaysRecap({ section, today });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[recap/today]', err);
    return NextResponse.json({
      status: 'empty',
      isHoliday: false,
      holidayName: null,
      topicCount: 0,
      topics: [],
      card: null,
    });
  }
}

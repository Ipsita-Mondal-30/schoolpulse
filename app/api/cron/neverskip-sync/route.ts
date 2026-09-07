import { NextRequest, NextResponse } from 'next/server';
import { NeverSkipClient } from '@/lib/neverskip/client';
import { EnvTokenAuth } from '@/lib/neverskip/auth';
import { PrismaNeverSkipStore } from '@/lib/neverskip/prisma-store';
import { syncNeverSkip } from '@/lib/neverskip/sync';
import { nsError, nsLog } from '@/lib/neverskip/log';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    nsError('CRON_SECRET is not configured');
    return false;
  }
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Vercel Cron may send this header when CRON_SECRET is set on the project
  const cronHeader = req.headers.get('x-vercel-cron-secret') || req.headers.get('x-cron-secret');
  if (cronHeader && cronHeader === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    nsLog('Cron NeverSkip sync invoked');
    const client = new NeverSkipClient({ auth: new EnvTokenAuth() });
    const store = new PrismaNeverSkipStore();
    const summary = await syncNeverSkip({ client, store });
    return NextResponse.json({ ok: summary.errors.length === 0, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed';
    nsError(`Cron sync failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

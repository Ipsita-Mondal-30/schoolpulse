import { NextRequest, NextResponse } from 'next/server';
import { NeverSkipClient } from '@/lib/neverskip/client';
import { EnvTokenAuth } from '@/lib/neverskip/auth';
import { PrismaNeverSkipStore } from '@/lib/neverskip/prisma-store';
import { syncNeverSkip } from '@/lib/neverskip/sync';
import { nsError, nsLog } from '@/lib/neverskip/log';

/**
 * Optional token-based NeverSkip sync HTTP endpoint.
 *
 * This is NOT scheduled by Vercel Cron. Production 4-hour sync uses the
 * external Playwright worker (`npm run worker:neverskip`) because:
 *   - Vercel Hobby allows at most one cron run per day
 *   - Playwright + persistent browser profile cannot run in serverless
 *
 * Protect with CRON_SECRET (Bearer token). Prefer browser worker sync.
 */
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
  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader && cronHeader === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    nsLog('HTTP NeverSkip token sync invoked (optional fallback — not Vercel Cron)');
    const client = new NeverSkipClient({ auth: new EnvTokenAuth() });
    const store = new PrismaNeverSkipStore();
    const summary = await syncNeverSkip({ client, store });
    return NextResponse.json({ ok: summary.errors.length === 0, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync failed';
    nsError(`HTTP token sync failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

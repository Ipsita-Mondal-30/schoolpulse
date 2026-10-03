import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-token';
import { getPrisma } from '@/lib/prisma';
import { isHealthEndpointUnhealthy, loadSyncHealth } from '@/lib/neverskip/sync-health';

/**
 * Admin-only NeverSkip sync health. Requires `x-admin-token: $ADMIN_HEALTH_TOKEN`.
 * 503 when auth expired, no COMPLETE run in 6h, or planner extraction failed —
 * usable as an external uptime check when the worker VM itself is down.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.headers.get('x-admin-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const health = await loadSyncHealth(getPrisma());
    const unhealthy = isHealthEndpointUnhealthy(health);
    return NextResponse.json(
      { ok: !unhealthy, health },
      { status: unhealthy ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error(`[SchoolPulse] sync-health load failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json(
      { ok: false, error: 'health unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

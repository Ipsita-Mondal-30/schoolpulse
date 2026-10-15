import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const findFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  getPrisma: () => ({
    syncRun: { findMany, findFirst },
    importedScheduleEvent: { findMany: async () => [] },
    importedJolItem: { findMany: async () => [] },
    importedJolSchedule: { findFirst: async () => null },
    importedNotice: {
      findMany: async () => [
        {
          sourceId: 'msid:39310',
          content: 'JOY OF LEARNING, WORKSHEET - II TIMETABLE:|Please find the attached file.',
          publishedDate: '2026-08-19',
          attachmentsJson: JSON.stringify([{ url: 'https://files.example.test/jol2.pdf', name: 'jol2.pdf' }]),
        },
      ],
    },
  }),
  resetPrismaClient: () => {},
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/sync-health/route';
import { verifyAdminToken } from '@/lib/admin-token';
import { isHealthEndpointUnhealthy } from '@/lib/neverskip/sync-health';

function req(token?: string) {
  return new NextRequest('http://localhost/api/admin/sync-health', {
    headers: token ? { 'x-admin-token': token } : {},
  });
}

function syncRun(status: string, hoursAgo: number, report: Record<string, unknown> = {}) {
  const finishedAt = new Date(Date.now() - hoursAgo * 3600_000);
  return {
    status,
    startedAt: finishedAt,
    finishedAt,
    homeworkExpected: null,
    homeworkFetched: null,
    noticeFetched: null,
    jolFetched: null,
    errorSummary: '',
    reportJson: JSON.stringify(report),
  };
}

describe('admin sync-health endpoint', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_HEALTH_TOKEN = 'correct-token';
    findMany.mockReset();
    findFirst.mockReset();
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('rejects a missing or wrong token', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('wrong'))).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects everything when ADMIN_HEALTH_TOKEN is unset', () => {
    delete process.env.ADMIN_HEALTH_TOKEN;
    expect(verifyAdminToken('anything')).toBe(false);
  });

  it('returns 200 with health after a recent COMPLETE run', async () => {
    const run = syncRun('COMPLETE', 1, { authenticationStatus: 'AUTHENTICATED' });
    findMany.mockResolvedValue([run]);
    findFirst.mockResolvedValue(run);
    const res = await GET(req('correct-token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.health.status).toBe('SYNC_SUCCESS');
  });

  it('returns 503 when the session expired', async () => {
    const complete = syncRun('COMPLETE', 2);
    findMany.mockResolvedValue([syncRun('AUTHENTICATION_REQUIRED', 0.5, { authenticationStatus: 'SESSION_EXPIRED' }), complete]);
    findFirst.mockResolvedValue(complete);
    const res = await GET(req('correct-token'));
    expect(res.status).toBe(503);
    expect((await res.json()).health.authStatus).toBe('SESSION_EXPIRED');
  });

  it('503 conditions: auth expired, stale 6h, planner failed — not PARTIAL alone', () => {
    expect(isHealthEndpointUnhealthy({ issues: ['AUTH_EXPIRED'], plannerStatus: null })).toBe(true);
    expect(isHealthEndpointUnhealthy({ issues: ['STALE_6H'], plannerStatus: null })).toBe(true);
    expect(isHealthEndpointUnhealthy({ issues: [], plannerStatus: 'FAILED' })).toBe(true);
    expect(isHealthEndpointUnhealthy({ issues: ['INCOMPLETE_CRITICAL'], plannerStatus: 'UNCHANGED' })).toBe(false);
  });
});

describe('parent schedule payload', () => {
  it('carries schedule data and the official timetable — no sync diagnostics or delay banner flag', async () => {
    const { loadCanonicalSchedule } = await import('@/lib/schedule/canonical');
    const payload = await loadCanonicalSchedule();
    expect(Object.keys(payload).sort()).toEqual(
      ['calendarEmpty', 'documents', 'events', 'jolSchedule', 'officialTimetable', 'source'].sort(),
    );
    expect(payload.officialTimetable).toMatchObject({
      title: 'JOY OF LEARNING, WORKSHEET - II TIMETABLE',
      publishedDate: '2026-08-19',
      url: 'https://files.example.test/jol2.pdf',
    });
    expect(JSON.stringify(payload)).not.toMatch(/PAGE0_ONLY|AUTHENTICATION|errorSummary|freshness/);
  });
});

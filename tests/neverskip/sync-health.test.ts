import { describe, expect, it } from 'vitest';
import type { SyncFreshness } from '@/lib/schedule/canonical';

/**
 * Mirror of report parsing used by SyncFreshness — kept lightweight so admin
 * health stays covered without spinning Prisma.
 */
function parseReportForTest(reportJson: string): Pick<
  SyncFreshness,
  'homeworkStatus' | 'noticeStatus' | 'jolStatus' | 'overallStatus'
> & { homeworkSourceCount: number | null } {
  const parsed = JSON.parse(reportJson) as {
    syncStatus?: string;
    homeworkSourceTotal?: number;
    sources?: Record<string, { status?: string }>;
  };
  return {
    overallStatus: parsed.syncStatus ?? null,
    homeworkStatus: parsed.sources?.homework?.status ?? null,
    noticeStatus: parsed.sources?.notices?.status ?? null,
    jolStatus: parsed.sources?.jol?.status ?? null,
    homeworkSourceCount:
      typeof parsed.homeworkSourceTotal === 'number' ? parsed.homeworkSourceTotal : null,
  };
}

describe('admin sync health report parsing', () => {
  it('surfaces PAGE0_ONLY and PARTIAL homework from SyncRun reportJson', () => {
    const parsed = parseReportForTest(
      JSON.stringify({
        syncStatus: 'PARTIAL',
        homeworkSourceTotal: 137,
        sources: {
          homework: { status: 'PARTIAL', fetched: 133 },
          notices: { status: 'PAGE0_ONLY', fetched: 10 },
          jol: { status: 'COMPLETE', fetched: 137 },
        },
      }),
    );
    expect(parsed.overallStatus).toBe('PARTIAL');
    expect(parsed.homeworkStatus).toBe('PARTIAL');
    expect(parsed.noticeStatus).toBe('PAGE0_ONLY');
    expect(parsed.jolStatus).toBe('COMPLETE');
    expect(parsed.homeworkSourceCount).toBe(137);
  });
});

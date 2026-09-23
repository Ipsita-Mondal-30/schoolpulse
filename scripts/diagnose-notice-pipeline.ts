/**
 * Safe notice pipeline diagnostics (NeverSkip → Neon → SchoolPulse query).
 *
 * Usage:
 *   npx tsx scripts/diagnose-notice-pipeline.ts
 *
 * Never prints tokens, cookies, DATABASE_URL, or passwords.
 */
import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { extractNotices } from '../lib/neverskip/normalizers';
import { normalizeNotice } from '../lib/neverskip/normalizers';
import { filterNoticesByClass, sortNoticesNewestFirst } from '../lib/ui-merge';
import type { UiNoticeItem } from '../lib/ui-merge';
import fixture from '../fixtures/neverskip/notices-2026-09-23.json';

function dbFingerprint(url: string | undefined): {
  host: string;
  db: string;
  user: string;
} | null {
  if (!url) return null;
  try {
    const x = new URL(url.replace(/^postgresql:/, 'http:'));
    return {
      host: x.hostname,
      db: x.pathname.replace(/^\//, '').split('?')[0],
      user: x.username,
    };
  } catch {
    return null;
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.importedNotice.count();
    const newest = await prisma.importedNotice.findFirst({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      select: {
        publishedDate: true,
        publishedTime: true,
        title: true,
        sourceId: true,
        classesJson: true,
      },
    });
    const sep23 = await prisma.importedNotice.count({
      where: { publishedDate: '2026-09-23' },
    });
    const lastSync = await prisma.syncRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        noticeFetched: true,
        errorSummary: true,
      },
    });

    const rawItems = extractNotices(fixture as never);
    const normalized = rawItems
      .map((r) => normalizeNotice(r))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    const fixtureNewest = [...normalized].sort((a, b) => {
      const ak = `${a.publishedDate}T${a.publishedTime || '00:00'}`;
      const bk = `${b.publishedDate}T${b.publishedTime || '00:00'}`;
      return bk.localeCompare(ak);
    })[0];

    const uiAsIfFromDb: UiNoticeItem[] = normalized.map((n) => ({
      id: `neverskip:${n.sourceId}`,
      date: n.publishedDate,
      time: n.publishedTime,
      classes: n.classes,
      summary: n.summary,
      message: n.content,
    }));
    const forChild = sortNoticesNewestFirst(
      filterNoticesByClass(uiAsIfFromDb, 'I-A'),
    );

    const hoursSince = lastSync?.finishedAt
      ? (
          (Date.now() - new Date(lastSync.finishedAt).getTime()) /
          3_600_000
        ).toFixed(1)
      : null;

    console.log(
      JSON.stringify(
        {
          NOTICE_FETCH_RESULT: {
            note: 'Live browser fetch requires NEVERSKIP_PROFILE_DIR session. Fixture used for parser proof.',
            fixture_item_list_count: rawItems.length,
            fixture_first_source_date: normalized[normalized.length - 1]?.publishedDate,
            fixture_latest_source_date: fixtureNewest?.publishedDate,
            fixture_latest_source_title: fixtureNewest?.title?.slice(0, 80),
            fixture_latest_source_id: fixtureNewest?.sourceId,
            fixture_latest_source_time: fixtureNewest?.publishedTime,
          },
          DB_NOTICE_CHECK: {
            total_ImportedNotice: total,
            sep23_count: sep23,
            newest_source_date: newest?.publishedDate ?? null,
            newest_source_time: newest?.publishedTime ?? null,
            newest_source_id: newest?.sourceId ?? null,
            newest_title: newest?.title?.slice(0, 80) ?? null,
            last_sync_status: lastSync?.status ?? null,
            last_sync_finishedAt: lastSync?.finishedAt ?? null,
            last_sync_noticeFetched: lastSync?.noticeFetched ?? null,
            hours_since_last_sync: hoursSince,
            last_sync_error: (lastSync?.errorSummary || '').slice(0, 160),
          },
          CASE:
            sep23 > 0
              ? 'B_NEON_HAS_23_SEP_CHECK_UI'
              : 'A_NEVERSKIP_TO_NEON_BROKEN_OR_STALE',
          CHILD_FILTER_FIXTURE: {
            section: 'I-A',
            returned_count: forChild.length,
            returned_newest_date: forChild[0]?.date ?? null,
            returned_newest_title: forChild[0]?.summary?.slice(0, 80) ?? null,
            olympiad_kept: forChild.some((n) =>
              /International Hindi Olympiad/i.test(n.message),
            ),
          },
          DATABASE_FINGERPRINT: {
            local_env: dbFingerprint(process.env.DATABASE_URL),
            note: 'Worker and Vercel must match this host/db/user. Do not print full URL.',
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

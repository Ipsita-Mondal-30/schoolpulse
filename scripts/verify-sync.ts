#!/usr/bin/env tsx
/**
 * Read-only NeverSkip → Neon → cache verification (no writes, no secret values printed).
 *
 * Usage:
 *   npm run verify:sync                 env names + profile + last sync runs + data freshness + cache
 *   npm run verify:sync -- --env-only   env names + profile only (no DB)
 *   npm run verify:sync -- --role=app   check Vercel app variable names instead of worker ones
 *
 * Exit codes: 0 report printed, 1 required env missing (--env-only) or database unreachable.
 */
import { loadWorkerEnv } from '../lib/neverskip/worker-env';
loadWorkerEnv();

import { PrismaClient } from '@prisma/client';
import {
  neverSkipProfileExists,
  readNeverSkipLoginTimestamp,
  resolveNeverSkipProfileDir,
} from '../lib/neverskip/browser';
import { getIndiaToday } from '../lib/daily-brief';
import {
  OPTIONAL_ENV,
  REQUIRED_ENV,
  daysBetweenYmd,
  describeDataVersion,
  envPresence,
  summarizeSyncReport,
  type EnvRole,
} from '../lib/neverskip/verify';

const args = process.argv.slice(2);
const envOnly = args.includes('--env-only');
const role: EnvRole = args.includes('--role=app') ? 'app' : 'worker';

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

function freshness(label: string, count: number, newest: string | null | undefined, today: string) {
  const age = newest ? daysBetweenYmd(newest, today) : null;
  console.log(
    `  ${label.padEnd(16)} rows=${count}  newest=${newest || '(none)'}${age != null ? `  (${age} day(s) before India today)` : ''}`,
  );
}

async function guarded(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n').filter(Boolean).slice(-1)[0] : String(err);
    console.log(`  ${label}: unavailable — ${msg?.slice(0, 160)}`);
  }
}

async function main(): Promise<number> {
  section(`Environment variable names (${role}) — values never printed`);
  const required = envPresence(REQUIRED_ENV[role], process.env);
  for (const e of required) console.log(`  ${e.name.padEnd(30)} ${e.present ? 'present' : 'MISSING (required)'}`);
  for (const e of envPresence(OPTIONAL_ENV[role], process.env)) {
    console.log(`  ${e.name.padEnd(30)} ${e.present ? 'present' : 'not set (optional)'}`);
  }
  const missingRequired = required.filter((e) => !e.present).length;

  if (role === 'worker') {
    section('Browser profile (shared by login and sync)');
    const dir = resolveNeverSkipProfileDir();
    console.log(`  path=${dir}`);
    console.log(`  exists=${neverSkipProfileExists(dir)}  lastLogin=${readNeverSkipLoginTimestamp(dir) ?? '(none recorded)'}`);
  }

  if (envOnly) return missingRequired > 0 ? 1 : 0;

  if (!process.env.DATABASE_URL?.trim()) {
    console.log('\nDATABASE_URL missing — cannot query Neon');
    return 1;
  }
  const prisma = new PrismaClient();
  const today = getIndiaToday();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log('\nNeon unreachable with the configured DATABASE_URL');
    await prisma.$disconnect().catch(() => undefined);
    return 1;
  }

  try {
    section('Last 3 sync runs (newest first)');
    await guarded('SyncRun', async () => {
      const runs = await prisma.syncRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: {
          status: true,
          startedAt: true,
          finishedAt: true,
          homeworkFetched: true,
          noticeFetched: true,
          jolFetched: true,
          scheduleFetched: true,
          errorSummary: true,
          reportJson: true,
        },
      });
      if (runs.length === 0) console.log('  (no sync runs recorded)');
      for (const r of runs) {
        console.log(
          `  ${r.startedAt.toISOString()} → ${r.finishedAt.toISOString()}  ${r.status}  homework=${r.homeworkFetched ?? '-'} notices=${r.noticeFetched ?? '-'} jol=${r.jolFetched ?? '-'} schedule=${r.scheduleFetched ?? '-'}`,
        );
        for (const line of summarizeSyncReport(r.reportJson)) console.log(`      ${line}`);
        if (r.errorSummary) console.log(`      errors: ${r.errorSummary.slice(0, 200)}`);
      }
    });

    section(`Stored data (India today ${today})`);
    await guarded('Homework', async () => {
      const agg = await prisma.importedHomework.aggregate({ _count: true, _max: { homeworkDate: true } });
      freshness('Homework', agg._count, agg._max.homeworkDate, today);
    });
    await guarded('Notices', async () => {
      const agg = await prisma.importedNotice.aggregate({ _count: true, _max: { publishedDate: true } });
      freshness('Notices', agg._count, agg._max.publishedDate, today);
    });
    await guarded('JoL items', async () => {
      const agg = await prisma.importedJolItem.aggregate({ _count: true, _max: { publishedDate: true } });
      freshness('Content Library', agg._count, agg._max.publishedDate, today);
    });
    await guarded('Schedule', async () => {
      const agg = await prisma.importedScheduleEvent.aggregate({ _count: true, _max: { eventDate: true } });
      freshness('Calendar events', agg._count, agg._max.eventDate, today);
    });
    await guarded('JoL timetable', async () => {
      const active = await prisma.importedJolSchedule.findFirst({
        where: { isActive: true },
        select: { sourceId: true, publishedDate: true, _count: { select: { days: true } } },
      });
      console.log(
        active
          ? `  Active JoL timetable sourceId=${active.sourceId} published=${active.publishedDate || '?'} days=${active._count.days}`
          : '  Active JoL timetable: none',
      );
    });
    await guarded('Newsletter months', async () => {
      const months = await prisma.importedNewsletterMonth.findMany({
        orderBy: { monthKey: 'asc' },
        select: { monthKey: true, status: true, sourceDocumentUrl: true },
      });
      console.log(
        `  Newsletter months: ${months.length ? months.map((m) => `${m.monthKey}:${m.status}${m.sourceDocumentUrl ? '+pdf' : ''}`).join(', ') : '(none)'}`,
      );
    });
    await guarded('Homework videos', async () => {
      const groups = await prisma.homeworkVideo.groupBy({ by: ['status'], _count: { _all: true } });
      console.log(
        `  Homework videos: ${groups.length ? groups.map((g) => `${g.status}=${g._count._all}`).join(' ') : '(none)'}`,
      );
    });

    section('Cache');
    console.log(`  REDIS_URL ${process.env.REDIS_URL?.trim() ? 'present' : 'not set — caches are not invalidated from this host'}`);
    if (process.env.REDIS_URL?.trim()) {
      await guarded('Redis', async () => {
        const { getDataVersion } = await import('../lib/cache/schoolpulse');
        console.log(`  Data version (bumped after each successful sync): ${describeDataVersion(await getDataVersion())}`);
      });
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`verify:sync failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });

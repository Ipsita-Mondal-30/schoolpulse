#!/usr/bin/env tsx
/**
 * Ops health check for NeverSkip sync (no secrets printed).
 *
 * Reports:
 * - local Playwright profile presence / mtime
 * - Neon ImportedHomework / ImportedNotice freshness (incl. 2026-09-15)
 * - GitHub Actions NeverSkip Sync recent outcomes (via `gh`, if available)
 * - Oracle/Linux worker checklist (manual when SSH is unavailable)
 *
 * Usage: npx tsx scripts/check-neverskip-ops.ts
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_PROFILE_DIR } from '../lib/neverskip/browser';

function profileDir(): string {
  const env = process.env.NEVERSKIP_PROFILE_DIR?.trim();
  if (env) return path.isAbsolute(env) ? env : path.resolve(process.cwd(), env);
  return path.resolve(process.cwd(), DEFAULT_PROFILE_DIR);
}

function safeStat(dir: string): { exists: boolean; mtimeIso: string | null; hasDefault: boolean } {
  try {
    if (!fs.existsSync(dir)) return { exists: false, mtimeIso: null, hasDefault: false };
    const st = fs.statSync(dir);
    const hasDefault = fs.existsSync(path.join(dir, 'Default'));
    return { exists: true, mtimeIso: st.mtime.toISOString(), hasDefault };
  } catch {
    return { exists: false, mtimeIso: null, hasDefault: false };
  }
}

function ghRecentSyncRuns(): string {
  try {
    const out = execSync(
      'gh run list --workflow=neverskip-sync.yml --limit 5 --json databaseId,conclusion,status,displayTitle,createdAt,event 2>/dev/null',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const runs = JSON.parse(out) as Array<{
      databaseId: number;
      conclusion: string | null;
      status: string;
      createdAt: string;
      event: string;
    }>;
    if (!runs.length) return 'NO_RUNS';
    return runs
      .map(
        (r) =>
          `id=${r.databaseId} event=${r.event} status=${r.status} conclusion=${r.conclusion ?? '?'} at=${r.createdAt}`,
      )
      .join('\n  ');
  } catch {
    return 'GH_CLI_UNAVAILABLE_OR_NO_ACCESS';
  }
}

async function neonFreshness(prisma: PrismaClient) {
  const newestHw = await prisma.importedHomework.findFirst({
    orderBy: [{ homeworkDate: 'desc' }],
    select: { homeworkDate: true, title: true, updatedAt: true, subjectName: true },
  });
  const newestNotice = await prisma.importedNotice.findFirst({
    orderBy: [{ publishedDate: 'desc' }],
    select: { publishedDate: true, title: true, updatedAt: true },
  });
  const on15 = await prisma.importedHomework.count({
    where: {
      OR: [{ homeworkDate: '2026-09-15' }, { dueDate: '2026-09-15' }],
    },
  });
  const sulekh = await prisma.importedHomework.count({
    where: {
      OR: [
        { title: { contains: 'sulekh', mode: 'insensitive' } },
        { title: { contains: 'मात्रा' } },
        { description: { contains: 'sulekh', mode: 'insensitive' } },
      ],
    },
  });
  return { newestHw, newestNotice, on15, sulekh };
}

async function main() {
  console.log('=== NeverSkip ops check (safe; no secrets) ===');

  const dir = profileDir();
  const st = safeStat(dir);
  console.log(`PROFILE_PATH_BASENAME=${path.basename(dir)}`);
  console.log(`PROFILE_EXISTS=${st.exists}`);
  console.log(`PROFILE_HAS_DEFAULT=${st.hasDefault}`);
  console.log(`PROFILE_MTIME=${st.mtimeIso ?? 'n/a'}`);
  if (dir.includes('/data/') && !st.exists) {
    console.log(
      'PROFILE_HINT=NEVERSKIP_PROFILE_DIR points at /data/... which is missing locally; use .playwright-profile for Mac login/sync',
    );
  }

  if (process.env.DATABASE_URL?.trim()) {
    const prisma = new PrismaClient();
    try {
      const n = await neonFreshness(prisma);
      console.log(`NEON_NEWEST_HOMEWORK_DATE=${n.newestHw?.homeworkDate ?? 'none'}`);
      console.log(`NEON_NEWEST_HOMEWORK_UPDATED=${n.newestHw?.updatedAt?.toISOString() ?? 'none'}`);
      console.log(`NEON_NEWEST_NOTICE_DATE=${n.newestNotice?.publishedDate ?? 'none'}`);
      console.log(`NEON_HOMEWORK_ON_2026-09-15=${n.on15}`);
      console.log(`NEON_SULEKH_OR_MATRA_HITS=${n.sulekh}`);
      if (n.on15 === 0) {
        console.log('NEON_GAP=true — 15-Sep homework still missing from ImportedHomework');
      }
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('NEON_SKIPPED=DATABASE_URL missing');
  }

  console.log('GH_ACTIONS_RECENT:');
  console.log(`  ${ghRecentSyncRuns()}`);
  console.log(
    'GH_NOTE=GitHub-hosted sync is NOT production (ephemeral runners + profile portability). Prefer deploy/neverskip-worker.',
  );

  console.log('ORACLE_LINUX_WORKER_CHECKLIST (needs SSH or log paste):');
  console.log('  [ ] ssh to host; git -C /opt/schoolpulse rev-parse HEAD');
  console.log('  [ ] crontab -l | grep neverskip-sync  (expect 0 */4 * * *)');
  console.log('  [ ] tail -n 80 /var/log/neverskip-sync.log  (look for SYNC STATUS / SESSION_EXPIRED)');
  console.log('  [ ] profile path /data/neverskip-profile or /var/lib/schoolpulse/data/neverskip-profile exists');
  console.log('  [ ] docker compose .env DATABASE_URL host matches Neon (do not print full URL)');
  console.log('  [ ] if SESSION_EXPIRED: on THAT host run npm run neverskip:login then docker compose run --rm neverskip-sync');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

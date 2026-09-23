/**
 * Safe cleanup of proven-false ContentChangeEvent rows (sync/import noise).
 *
 * NEVER deletes ImportedHomework / Notice / JOL rows.
 * NEVER resets the database.
 *
 * Usage:
 *   npx tsx scripts/cleanup-false-change-events.ts           # dry-run
 *   npx tsx scripts/cleanup-false-change-events.ts --apply   # delete proven noise
 *
 * Requires DATABASE_URL. Never logs secrets.
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const name of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

import { PrismaClient } from '@prisma/client';
import {
  isProvenNoiseChangeEvent,
  parseFieldChanges,
} from '../lib/neverskip/changes';
import { UPDATES_RECENT_DAYS } from '../lib/updates-feed';
import { addDaysYmd, getIndiaToday } from '../lib/daily-brief';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('FAIL: DATABASE_URL is not set');
    process.exit(1);
  }

  const activitySinceYmd =
    addDaysYmd(getIndiaToday(), -(UPDATES_RECENT_DAYS - 1)) || getIndiaToday();
  const prisma = new PrismaClient();

  try {
    // Look back further than the parent 7-day window so stale noise cannot resurface later.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 120);

    const rows = await prisma.contentChangeEvent.findMany({
      where: { detectedAt: { gte: since } },
      orderBy: { detectedAt: 'desc' },
      take: 5000,
    });

    const noise = rows.filter((row) =>
      isProvenNoiseChangeEvent({
        entityType: row.entityType,
        changedFields: parseFieldChanges(row.changedFieldsJson),
        currentSnapshotJson: row.currentSnapshotJson,
        activitySinceYmd,
      }),
    );

    console.log('--- cleanup-false-change-events ---');
    console.log('Mode:', apply ? 'APPLY (delete)' : 'DRY-RUN');
    console.log('Activity since (India YMD):', activitySinceYmd);
    console.log('Scanned ContentChangeEvent rows:', rows.length);
    console.log('Proven noise rows:', noise.length);
    console.log(
      'By entityType:',
      noise.reduce<Record<string, number>>((acc, r) => {
        acc[r.entityType] = (acc[r.entityType] || 0) + 1;
        return acc;
      }, {}),
    );

    if (noise.length === 0) {
      console.log('Nothing to delete.');
      return;
    }

    if (!apply) {
      console.log('Re-run with --apply to delete these ContentChangeEvent ids only.');
      console.log('Sample ids:', noise.slice(0, 10).map((r) => r.id).join(', '));
      return;
    }

    const result = await prisma.contentChangeEvent.deleteMany({
      where: { id: { in: noise.map((r) => r.id) } },
    });
    console.log('Deleted ContentChangeEvent count:', result.count);
  } finally {
    await prisma.$disconnect();
  }
}

void main();

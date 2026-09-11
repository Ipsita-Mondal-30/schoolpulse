#!/usr/bin/env tsx
/**
 * Temporary diagnostic: NeverSkip live source vs PostgreSQL for Sep 10–11.
 * Does NOT print tokens, cookies, passwords, or DATABASE_URL.
 *
 * Usage: npx tsx scripts/diagnose-neverskip-sep.ts
 */
import { config } from 'dotenv';
config();

import { collectNeverSkipData, NeverSkipSessionExpiredError } from '../lib/neverskip/browser';
import { normalizeDate, normalizeHomework, normalizeNotice } from '../lib/neverskip/normalizers';
import { classifyAssignment } from '../lib/neverskip/classify';
import { PrismaClient } from '@prisma/client';

const TARGET_DATES = new Set(['2026-09-10', '2026-09-11']);

function pickDateFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/date|time|dt|title|id|subj|assign|due|pub|creat|cont|msg|class/i.test(k)) {
      if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (Array.isArray(v)) {
        out[k] = `array(${v.length})`;
      } else {
        out[k] = 'object';
      }
    }
  }
  return out;
}

function isTargetDate(raw: string | null | undefined, ...candidates: Array<string | null | undefined>): boolean {
  for (const c of [raw, ...candidates]) {
    const n = normalizeDate(c ?? null);
    if (n && TARGET_DATES.has(n)) return true;
  }
  return false;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('=== NeverSkip Sep 10/11 diagnostic ===');
  console.log('Collecting from authenticated browser session…');

  const collected = await collectNeverSkipData({
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    requireAuthenticatedSession: true,
  });

  const hwMeta = {
    pagesFetched: collected.homeworkPagesFetched,
    incomplete: collected.homeworkFetchIncomplete,
    records: collected.homework.length,
    errors: collected.homeworkFetchErrors ?? [],
  };
  console.log('Homework fetch:', JSON.stringify(hwMeta));

  const sepHwRaw = collected.homework.filter((raw) => {
    const r = raw as Record<string, unknown>;
    return isTargetDate(
      String(r.ass_dt ?? ''),
      String(r.assign_dt ?? ''),
      String(r.due_dt ?? ''),
      String(r.submission_dt ?? ''),
    );
  });

  console.log(`Source homework matching Sep 10/11 (by date fields): ${sepHwRaw.length}`);
  for (const raw of sepHwRaw) {
    const r = raw as Record<string, unknown>;
    const classified = classifyAssignment(raw);
    const normalized = classifyAssignment(raw) === 'homework' ? normalizeHomework(raw) : null;
    console.log(
      JSON.stringify({
        classify: classified,
        fields: pickDateFields(r),
        normalized: normalized
          ? {
              sourceId: normalized.sourceId,
              subject: normalized.subjectName,
              title: normalized.title,
              homeworkDate: normalized.homeworkDate,
              dueDate: normalized.dueDate,
              sections: normalized.sections,
              attachmentUrl: normalized.attachmentUrl ? 'yes' : 'no',
            }
          : null,
      }),
    );
  }

  // Date histogram of all source homework (top 15 by date)
  const byDate = new Map<string, number>();
  for (const raw of collected.homework) {
    const n = normalizeHomework(raw);
    const d = n?.homeworkDate || '(unparseable/skipped)';
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  const dateHist = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 15);
  console.log('Source homework date histogram (newest 15):', JSON.stringify(dateHist));

  console.log(`Source notices fetched: ${collected.notices.length}`);
  if (collected.notices[0]) {
    console.log('First notice keys:', Object.keys(collected.notices[0] as object).join(','));
  }
  for (const raw of collected.notices.slice(0, 8)) {
    const r = raw as Record<string, unknown>;
    const normalized = normalizeNotice(raw);
    console.log(
      JSON.stringify({
        fields: pickDateFields(r),
        normalized: normalized
          ? {
              sourceId: normalized.sourceId,
              title: normalized.title.slice(0, 80),
              publishedDate: normalized.publishedDate,
              publishedTime: normalized.publishedTime,
            }
          : null,
      }),
    );
  }

  const sepNotices = collected.notices.filter((raw) => {
    const r = raw as Record<string, unknown>;
    const n = normalizeNotice(raw);
    return (
      isTargetDate(
        String(r.date ?? ''),
        String(r.ntc_dt ?? ''),
        String(r.notice_dt ?? ''),
        String(r.msg_dt ?? ''),
        String(r.pub_dt ?? ''),
        String(r.created_dt ?? ''),
        n?.publishedDate,
      ) ||
      (n != null && TARGET_DATES.has(n.publishedDate))
    );
  });
  console.log(`Source notices matching Sep 10/11: ${sepNotices.length}`);

  const prisma = new PrismaClient();
  try {
    const dbHw = await prisma.importedHomework.findMany({
      where: {
        OR: [
          { homeworkDate: { in: [...TARGET_DATES] } },
          { dueDate: { in: [...TARGET_DATES] } },
        ],
      },
      select: {
        sourceId: true,
        subjectName: true,
        title: true,
        homeworkDate: true,
        dueDate: true,
        sectionsJson: true,
      },
      orderBy: { homeworkDate: 'asc' },
    });
    const dbNt = await prisma.importedNotice.findMany({
      where: { publishedDate: { in: [...TARGET_DATES] } },
      select: { sourceId: true, title: true, publishedDate: true, publishedTime: true },
    });
    const totals = {
      dbHomeworkTotal: await prisma.importedHomework.count(),
      dbNoticeTotal: await prisma.importedNotice.count(),
      dbSepHomework: dbHw.length,
      dbSepNotices: dbNt.length,
    };
    console.log('DB totals:', JSON.stringify(totals));
    console.log('DB Sep homework:', JSON.stringify(dbHw));
    console.log('DB Sep notices:', JSON.stringify(dbNt));
  } finally {
    await prisma.$disconnect();
  }

  console.log('=== diagnostic complete ===');
}

main().catch((err) => {
  if (err instanceof NeverSkipSessionExpiredError) {
    console.error('SESSION_EXPIRED — run npm run neverskip:login');
    process.exit(1);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

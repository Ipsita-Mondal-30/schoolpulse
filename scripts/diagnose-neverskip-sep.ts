#!/usr/bin/env tsx
/**
 * Temporary diagnostic: NeverSkip live source vs PostgreSQL for Sep 10–14.
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

const TARGET_DATES = new Set([
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
  '2026-09-14',
]);

const TARGETING_KEYS = [
  'class_sec',
  'section',
  'sections',
  'class_name',
  'class',
  'classes',
  'cls_sec',
  'std_sec',
  'test_tar',
  'title',
  'assign_title',
];

function pickSafeFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/date|time|dt|title|id|subj|assign|due|pub|creat|cont|msg|class|sec|tar|typ/i.test(k)) {
      if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (Array.isArray(v)) {
        out[k] = v.slice(0, 20);
      } else if (typeof v === 'object') {
        const nested: Record<string, unknown> = {};
        for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
          if (nv == null || typeof nv === 'string' || typeof nv === 'number' || typeof nv === 'boolean') {
            nested[nk] = nv;
          } else if (Array.isArray(nv)) {
            nested[nk] = `array(${nv.length})`;
          }
        }
        out[k] = nested;
      }
    }
  }
  return out;
}

function targetingSnapshot(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TARGETING_KEYS) {
    if (key in raw) out[key] = raw[key];
  }
  return out;
}

function isTargetDate(...candidates: Array<string | null | undefined>): boolean {
  for (const c of candidates) {
    const n = normalizeDate(c ?? null);
    if (n && TARGET_DATES.has(n)) return true;
  }
  return false;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('=== NeverSkip Sep 10–14 diagnostic ===');
  console.log('Collecting from authenticated browser session…');

  const collected = await collectNeverSkipData({
    headless: process.env.NEVERSKIP_HEADLESS !== 'false',
    requireAuthenticatedSession: true,
  });

  const hwIds = collected.homework.map((raw) => {
    const r = raw as Record<string, unknown>;
    return String(r.assign_id ?? r.refid ?? '');
  });
  const uniqueHwIds = new Set(hwIds.filter(Boolean));
  const hwMeta = {
    pagesFetched: collected.homeworkPagesFetched,
    incomplete: collected.homeworkFetchIncomplete,
    records: collected.homework.length,
    uniqueIds: uniqueHwIds.size,
    errors: collected.homeworkFetchErrors ?? [],
  };
  console.log('Homework fetch:', JSON.stringify(hwMeta));
  const ntMeta = {
    pagesFetched: collected.noticePagesFetched,
    incomplete: collected.noticeFetchIncomplete,
    records: collected.notices.length,
    errors: collected.noticeFetchErrors ?? [],
  };
  console.log('Notice fetch:', JSON.stringify(ntMeta));

  if (collected.homework[0]) {
    console.log('First homework keys:', Object.keys(collected.homework[0] as object).join(','));
  }

  const sepHwRaw = collected.homework.filter((raw) => {
    const r = raw as Record<string, unknown>;
    return isTargetDate(
      String(r.ass_dt ?? ''),
      String(r.assign_dt ?? ''),
      String(r.due_dt ?? ''),
      String(r.submission_dt ?? ''),
    );
  });

  console.log(`Source homework matching Sep 10–14 (by date fields): ${sepHwRaw.length}`);
  const sourceByDay: Record<string, number> = {};
  for (const d of TARGET_DATES) sourceByDay[d] = 0;
  for (const raw of sepHwRaw) {
    const r = raw as Record<string, unknown>;
    const classified = classifyAssignment(raw);
    const normalized = classified === 'homework' ? normalizeHomework(raw) : null;
    const day = normalized?.homeworkDate || normalizeDate(String(r.ass_dt ?? r.assign_dt ?? '')) || 'unknown';
    if (day in sourceByDay) sourceByDay[day] += 1;
    console.log(
      JSON.stringify({
        classify: classified,
        targeting: targetingSnapshot(r),
        fields: pickSafeFields(r),
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
  console.log('Source Sep homework by day:', JSON.stringify(sourceByDay));

  const byDate = new Map<string, number>();
  const sectionHist = new Map<string, number>();
  let untargetedDefaulted = 0;
  for (const raw of collected.homework) {
    const n = classifyAssignment(raw) === 'homework' ? normalizeHomework(raw) : null;
    const d = n?.homeworkDate || (n ? '(blank-date)' : '(unparseable/skipped)');
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
    if (n) {
      for (const sec of n.sections) {
        sectionHist.set(sec, (sectionHist.get(sec) ?? 0) + 1);
      }
      const r = raw as Record<string, unknown>;
      const hasTarget =
        Boolean(r.class_sec) || Boolean(r.section) || Boolean(r.sections) || Boolean(r.class_name);
      if (!hasTarget) untargetedDefaulted += 1;
    }
  }
  const dateHist = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 15);
  console.log('Source homework date histogram (newest 15):', JSON.stringify(dateHist));
  console.log('Source homework section histogram:', JSON.stringify(Object.fromEntries(sectionHist)));
  console.log('Source homework with no targeting fields:', untargetedDefaulted);
  console.log('Newest source homework date:', dateHist[0]?.[0] ?? null);

  console.log(`Source notices fetched: ${collected.notices.length}`);
  if (collected.notices[0]) {
    console.log('First notice keys:', Object.keys(collected.notices[0] as object).join(','));
  }
  for (const raw of collected.notices.slice(0, 8)) {
    const r = raw as Record<string, unknown>;
    const normalized = normalizeNotice(raw);
    console.log(
      JSON.stringify({
        targeting: targetingSnapshot(r),
        fields: pickSafeFields(r),
        normalized: normalized
          ? {
              sourceId: normalized.sourceId,
              title: normalized.title.slice(0, 80),
              publishedDate: normalized.publishedDate,
              publishedTime: normalized.publishedTime,
              classes: normalized.classes,
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
  console.log(`Source notices matching Sep 10–14: ${sepNotices.length}`);
  const noticeDates = collected.notices
    .map((raw) => normalizeNotice(raw)?.publishedDate || '')
    .filter(Boolean)
    .sort()
    .reverse();
  console.log('Newest source notice date:', noticeDates[0] ?? null);
  console.log('Source notice date histogram (newest 10):', JSON.stringify(
    Object.entries(
      noticeDates.reduce<Record<string, number>>((acc, d) => {
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10),
  ));

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
      select: { sourceId: true, title: true, publishedDate: true, publishedTime: true, classesJson: true },
    });
    const newestHw = await prisma.importedHomework.findFirst({
      orderBy: [{ homeworkDate: 'desc' }],
      select: { homeworkDate: true, title: true, createdAt: true, updatedAt: true },
    });
    const newestNt = await prisma.importedNotice.findFirst({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      select: { publishedDate: true, publishedTime: true, title: true },
    });
    const totals = {
      dbHomeworkTotal: await prisma.importedHomework.count(),
      dbNoticeTotal: await prisma.importedNotice.count(),
      dbSepHomework: dbHw.length,
      dbSepNotices: dbNt.length,
      dbNewestHomeworkDate: newestHw?.homeworkDate ?? null,
      dbNewestNoticeDate: newestNt?.publishedDate ?? null,
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

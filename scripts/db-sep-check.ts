#!/usr/bin/env tsx
/**
 * Read-only Postgres snapshot for homework/notices freshness.
 * Does NOT print DATABASE_URL or secrets.
 */
import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';

const SEP_DATES = [
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
  '2026-09-14',
  '2026-09-15',
];
const CLASS1_SECTIONS = ['I-A', 'I-B', 'I-C', 'I-D', 'I-E', 'I-F', 'I-G', 'I-H', 'I-I', 'I-J', 'I-K'];

function parseSections(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log('DB_UNAVAILABLE');
    return;
  }
  const prisma = new PrismaClient();
  try {
    const homeworkTotal = await prisma.importedHomework.count();
    const noticeTotal = await prisma.importedNotice.count();

    const newestHwByDate = await prisma.importedHomework.findFirst({
      orderBy: [{ homeworkDate: 'desc' }],
      select: { homeworkDate: true, dueDate: true, createdAt: true, updatedAt: true, title: true, subjectName: true },
    });
    const newestHwByCreated = await prisma.importedHomework.findFirst({
      orderBy: [{ createdAt: 'desc' }],
      select: { homeworkDate: true, createdAt: true, updatedAt: true, title: true },
    });
    const newestHwByUpdated = await prisma.importedHomework.findFirst({
      orderBy: [{ updatedAt: 'desc' }],
      select: { homeworkDate: true, createdAt: true, updatedAt: true, title: true },
    });
    const newestNotice = await prisma.importedNotice.findFirst({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      select: { publishedDate: true, publishedTime: true, title: true, createdAt: true },
    });

    const julyCount = await prisma.importedHomework.count({
      where: { homeworkDate: { startsWith: '2026-07' } },
    });
    const sepMonthCount = await prisma.importedHomework.count({
      where: { homeworkDate: { startsWith: '2026-09' } },
    });

    const perDay: Record<string, { homework: number; homeworkDue: number; notices: number }> = {};
    for (const d of SEP_DATES) {
      perDay[d] = {
        homework: await prisma.importedHomework.count({ where: { homeworkDate: d } }),
        homeworkDue: await prisma.importedHomework.count({ where: { dueDate: d } }),
        notices: await prisma.importedNotice.count({ where: { publishedDate: d } }),
      };
    }

    const allHw = await prisma.importedHomework.findMany({
      select: { homeworkDate: true, sectionsJson: true },
    });
    const sectionCounts: Record<string, number> = { empty: 0, other: 0 };
    for (const sec of CLASS1_SECTIONS) sectionCounts[sec] = 0;
    let idTagged = 0;
    for (const row of allHw) {
      const sections = parseSections(row.sectionsJson);
      if (sections.length === 0) {
        sectionCounts.empty += 1;
        continue;
      }
      if (sections.includes('I-D')) idTagged += 1;
      let matched = false;
      for (const sec of sections) {
        if (sec in sectionCounts) {
          sectionCounts[sec] += 1;
          matched = true;
        }
      }
      if (!matched) sectionCounts.other += 1;
    }

    const sepHw = await prisma.importedHomework.findMany({
      where: {
        OR: [{ homeworkDate: { in: SEP_DATES } }, { dueDate: { in: SEP_DATES } }],
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

    const latestNotices = await prisma.importedNotice.findMany({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      take: 8,
      select: { sourceId: true, title: true, publishedDate: true, publishedTime: true, classesJson: true },
    });

    const dateHist = new Map<string, number>();
    for (const row of allHw) {
      const d = row.homeworkDate || '(blank)';
      dateHist.set(d, (dateHist.get(d) ?? 0) + 1);
    }
    const newestDates = [...dateHist.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 15);

    console.log('DB_TOTALS', JSON.stringify({ homework: homeworkTotal, notices: noticeTotal, julyHomework: julyCount, sepHomework: sepMonthCount, iDTagged: idTagged }));
    console.log('NEWEST_HOMEWORK_DATE', JSON.stringify(newestHwByDate));
    console.log('NEWEST_HOMEWORK_CREATED', JSON.stringify(newestHwByCreated));
    console.log('NEWEST_HOMEWORK_UPDATED', JSON.stringify(newestHwByUpdated));
    console.log('NEWEST_NOTICE', JSON.stringify(newestNotice));
    console.log('SEP_PER_DAY', JSON.stringify(perDay));
    console.log('SECTION_HISTOGRAM', JSON.stringify(sectionCounts));
    console.log('DATE_HISTOGRAM_NEWEST_15', JSON.stringify(newestDates));
    console.log('SEP_HW', JSON.stringify(sepHw));
    console.log('LATEST_NOTICES', JSON.stringify(latestNotices));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

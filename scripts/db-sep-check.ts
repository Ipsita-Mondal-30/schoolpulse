#!/usr/bin/env tsx
import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log('DB_UNAVAILABLE');
    return;
  }
  const prisma = new PrismaClient();
  const dates = ['2026-09-10', '2026-09-11'];
  try {
    const hw = await prisma.importedHomework.findMany({
      where: { OR: [{ homeworkDate: { in: dates } }, { dueDate: { in: dates } }] },
      select: { sourceId: true, subjectName: true, title: true, homeworkDate: true, dueDate: true },
      orderBy: { homeworkDate: 'asc' },
    });
    const nt = await prisma.importedNotice.findMany({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
      take: 5,
      select: { sourceId: true, title: true, publishedDate: true, publishedTime: true },
    });
    const totals = {
      homework: await prisma.importedHomework.count(),
      notices: await prisma.importedNotice.count(),
      sep10_11_homework: hw.length,
      sep10_11_notices: await prisma.importedNotice.count({
        where: { publishedDate: { in: dates } },
      }),
    };
    console.log('DB_TOTALS', JSON.stringify(totals));
    console.log('SEP_HW', JSON.stringify(hw));
    console.log('LATEST_NOTICES', JSON.stringify(nt));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

import path from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * Resolve SQLite file: URLs to absolute paths so Next.js server actions
 * and CLI sync always hit the same database file regardless of cwd quirks.
 */
export function resolveDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (!url.startsWith('file:')) return url;

  let filePath = url.slice('file:'.length);
  // file:///Users/... or file://localhost/Users/...
  if (filePath.startsWith('///')) {
    filePath = filePath.slice(2); // -> /Users/...
  } else if (filePath.startsWith('//')) {
    filePath = filePath.replace(/^\/\/[^/]*/, '') || filePath;
  }

  if (path.isAbsolute(filePath)) {
    return `file:${filePath}`;
  }

  return `file:${path.resolve(process.cwd(), filePath)}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaUrl: string | undefined;
};

type ScheduleAwareClient = PrismaClient & {
  importedScheduleEvent?: { findMany?: unknown };
  importedJolItem?: { findMany?: unknown };
  importedJolSchedule?: { findFirst?: unknown };
  syncRun?: { findFirst?: unknown };
};

/** True when this PrismaClient instance includes post-timetable-sync models. */
function prismaHasScheduleModels(client: PrismaClient): boolean {
  const c = client as ScheduleAwareClient;
  return (
    typeof c.importedScheduleEvent?.findMany === 'function' &&
    typeof c.importedJolItem?.findMany === 'function' &&
    typeof c.importedJolSchedule?.findFirst === 'function' &&
    typeof c.syncRun?.findFirst === 'function'
  );
}

function createPrismaClient(url: string | undefined): PrismaClient {
  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
  });
}

/** Drop the cached Prisma singleton (e.g. after prisma generate during hot reload). */
export function resetPrismaClient(): void {
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaUrl = undefined;
}

export function getPrisma(): PrismaClient {
  const url = resolveDatabaseUrl(process.env.DATABASE_URL);
  if (url && process.env.DATABASE_URL !== url) {
    process.env.DATABASE_URL = url;
  }

  const stale =
    globalForPrisma.prisma &&
    (globalForPrisma.prismaUrl !== url || !prismaHasScheduleModels(globalForPrisma.prisma));

  if (!globalForPrisma.prisma || stale) {
    if (stale && globalForPrisma.prisma) {
      void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    }
    globalForPrisma.prisma = createPrismaClient(url);
    globalForPrisma.prismaUrl = url;
  }

  // Belt-and-suspenders: never return a client missing schedule delegates.
  if (!prismaHasScheduleModels(globalForPrisma.prisma)) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = createPrismaClient(url);
    globalForPrisma.prismaUrl = url;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrisma();

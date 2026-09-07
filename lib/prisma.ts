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

export function getPrisma(): PrismaClient {
  const url = resolveDatabaseUrl(process.env.DATABASE_URL);
  if (url && process.env.DATABASE_URL !== url) {
    process.env.DATABASE_URL = url;
  }

  if (!globalForPrisma.prisma || globalForPrisma.prismaUrl !== url) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: url ? { db: { url } } : undefined,
    });
    globalForPrisma.prismaUrl = url;
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrisma();

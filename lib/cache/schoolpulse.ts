/**
 * SchoolPulse cache keys + invalidation after NeverSkip sync.
 * Correctness: Neon is source of truth; Redis is a short-TTL acceleration layer.
 */

import {
  cacheDel,
  cacheDelByPattern,
  cacheGet,
  cacheSet,
  isRedisConfigured,
} from '@/lib/cache/redis';

export const CACHE_TTL_SECONDS = 90;
export const DATA_VERSION_KEY = 'schoolpulse:data-version';

const globalVersion = globalThis as unknown as { schoolPulseDataVersion?: string };

/** Deterministic keys — childKey is synced student id or section label. */
export function spCacheKey(
  childKey: string,
  surface: 'homework' | 'notices' | 'updates' | 'jol' | 'timetable' | 'this-week',
): string {
  const child = (childKey || 'default').trim() || 'default';
  return `schoolpulse:${child}:${surface}`;
}

async function latestSyncRunVersion(): Promise<string | null> {
  try {
    if (!process.env.DATABASE_URL) return null;
    const { getPrisma } = await import('@/lib/prisma');
    const latest = await getPrisma().syncRun.findFirst({
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true, id: true },
    });
    return latest?.finishedAt ? `sync:${latest.id}:${latest.finishedAt.getTime()}` : null;
  } catch {
    return null;
  }
}

/** Combine both signals: a worker without REDIS_URL can only advance the SyncRun part. */
export function composeDataVersion(cacheVersion: string | null, syncVersion: string | null): string {
  const parts = [cacheVersion, syncVersion].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join('|') : '0';
}

export async function getDataVersion(): Promise<string> {
  const fromRedis = await cacheGet(DATA_VERSION_KEY);
  const cacheVersion = fromRedis || globalVersion.schoolPulseDataVersion || null;
  return composeDataVersion(cacheVersion, await latestSyncRunVersion());
}

export async function bumpDataVersion(reason = 'sync'): Promise<string> {
  const version = `${Date.now()}:${reason}`;
  globalVersion.schoolPulseDataVersion = version;
  await cacheSet(DATA_VERSION_KEY, version, 60 * 60 * 24 * 7);
  return version;
}

export async function cachedJsonGet<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cachedJsonSet(key: string, value: unknown, ttl = CACHE_TTL_SECONDS): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttl);
}

/**
 * Invalidate all SchoolPulse surface caches after a successful NeverSkip sync.
 * Also bumps data-version so clients can drop stale TanStack payloads.
 */
export async function invalidateSchoolPulseCaches(reason = 'neverskip-sync'): Promise<{
  redisConfigured: boolean;
  deleted: number;
  version: string;
}> {
  const version = await bumpDataVersion(reason);
  if (!isRedisConfigured()) {
    return { redisConfigured: false, deleted: 0, version };
  }
  const patterns = [
    'schoolpulse:*:homework',
    'schoolpulse:*:notices',
    'schoolpulse:*:updates',
    'schoolpulse:*:jol',
    'schoolpulse:*:timetable',
    'schoolpulse:*:this-week',
  ];
  let deleted = 0;
  for (const pattern of patterns) {
    deleted += await cacheDelByPattern(pattern);
  }
  await cacheDel(DATA_VERSION_KEY);
  await cacheSet(DATA_VERSION_KEY, version, 60 * 60 * 24 * 7);
  return { redisConfigured: true, deleted, version };
}

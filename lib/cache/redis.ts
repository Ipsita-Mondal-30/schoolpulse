/**
 * Optional Redis cache for SchoolPulse server reads.
 * When REDIS_URL is unset, all ops are no-ops (Neon remains source of truth).
 */

import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  schoolPulseRedis: Redis | null | undefined;
  schoolPulseRedisUrl: string | undefined;
};

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || '';
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl());
}

export function getRedis(): Redis | null {
  const url = redisUrl();
  if (!url) return null;

  if (globalForRedis.schoolPulseRedis && globalForRedis.schoolPulseRedisUrl === url) {
    return globalForRedis.schoolPulseRedis;
  }

  if (globalForRedis.schoolPulseRedis) {
    void globalForRedis.schoolPulseRedis.quit().catch(() => undefined);
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  client.on('error', (err) => {
    console.warn('[SchoolPulse] Redis error:', err.message);
  });
  globalForRedis.schoolPulseRedis = client;
  globalForRedis.schoolPulseRedisUrl = url;
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    if (client.status !== 'ready') await client.connect().catch(() => undefined);
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    if (client.status !== 'ready') await client.connect().catch(() => undefined);
    await client.set(key, value, 'EX', Math.max(1, ttlSeconds));
  } catch {
    /* ignore — Neon remains authoritative */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const client = getRedis();
  if (!client || keys.length === 0) return;
  try {
    if (client.status !== 'ready') await client.connect().catch(() => undefined);
    await client.del(...keys);
  } catch {
    /* ignore */
  }
}

export async function cacheDelByPattern(pattern: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;
  let deleted = 0;
  try {
    if (client.status !== 'ready') await client.connect().catch(() => undefined);
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        deleted += await client.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    return deleted;
  }
  return deleted;
}

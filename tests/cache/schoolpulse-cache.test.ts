import { describe, expect, it } from 'vitest';
import {
  bumpDataVersion,
  getDataVersion,
  invalidateSchoolPulseCaches,
  spCacheKey,
} from '@/lib/cache/schoolpulse';
import { isRedisConfigured } from '@/lib/cache/redis';
import { isJolTimetableSourceCandidate } from '@/lib/neverskip/jol-timetable-resolve';

describe('SchoolPulse cache keys', () => {
  it('builds deterministic child surface keys', () => {
    expect(spCacheKey('neverskip-synced-primary', 'homework')).toBe(
      'schoolpulse:neverskip-synced-primary:homework',
    );
    expect(spCacheKey('', 'notices')).toBe('schoolpulse:default:notices');
  });
});

describe('data version + invalidation', () => {
  it('bumps an in-memory version even when Redis is unset', async () => {
    const before = await getDataVersion();
    const bumped = await bumpDataVersion('unit-test');
    expect(bumped).toContain('unit-test');
    expect(await getDataVersion()).toBe(bumped);
    expect(bumped).not.toBe(before === '0' ? 'keep' : before);
  });

  it('invalidateSchoolPulseCaches returns version and redis flag', async () => {
    const result = await invalidateSchoolPulseCaches('unit-test-inv');
    expect(result.version).toContain('unit-test-inv');
    expect(result.redisConfigured).toBe(isRedisConfigured());
  });
});

describe('JOL timetable source candidates', () => {
  it('rejects practice papers that are not newsletters', () => {
    expect(
      isJolTimetableSourceCandidate({
        title: 'Joy of learning, WS -II, Hindi practice paper and answer key.',
        downloadUrl: 'https://example.com/practice.pdf',
      }),
    ).toBe(false);
  });

  it('accepts newsletter / timetable titled documents', () => {
    expect(
      isJolTimetableSourceCandidate({
        title: 'Grade 1 September 2026 newsletter',
        sourceId: 'cl-nl-sep-2026',
      }),
    ).toBe(true);
  });
});

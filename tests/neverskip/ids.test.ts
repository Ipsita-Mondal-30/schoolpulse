import { describe, expect, it } from 'vitest';
import { homeworkSourceId, noticeSourceId } from '@/lib/neverskip/ids';

describe('homeworkSourceId', () => {
  it('is stable across syncs when assign_id is present', () => {
    expect(homeworkSourceId(12345, 999)).toBe('12345');
    expect(homeworkSourceId('12345', '999')).toBe('12345');
    expect(homeworkSourceId(12345, null)).toBe('12345');
  });

  it('falls back to refid when assign_id missing', () => {
    expect(homeworkSourceId(null, 888)).toBe('888');
    expect(homeworkSourceId('', '888')).toBe('888');
  });

  it('returns null when both missing', () => {
    expect(homeworkSourceId(null, null)).toBeNull();
    expect(homeworkSourceId('', '')).toBeNull();
  });
});

describe('noticeSourceId', () => {
  it('prefers explicit id', () => {
    expect(noticeSourceId({ id: 42, title: 'A', content: 'B' })).toBe('42');
  });

  it('hashes title+content stably when id missing', () => {
    const a = noticeSourceId({ title: 'Sports day', content: 'Bring kit' });
    const b = noticeSourceId({ title: 'Sports day', content: 'Bring kit' });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
});

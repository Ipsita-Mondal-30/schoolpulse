import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { parsePrefixedSourceId } from '@/lib/acknowledgement-ids';
import { uiHomeworkId, uiNoticeId } from '@/lib/neverskip/ids';

describe('parsePrefixedSourceId', () => {
  it('parses neverskip UI homework ids', () => {
    expect(parsePrefixedSourceId('neverskip:abc123')).toEqual({
      source: 'neverskip',
      sourceId: 'abc123',
    });
  });

  it('returns null for bare cuids without prefix', () => {
    expect(parsePrefixedSourceId('clxyz123')).toBeNull();
  });

  it('returns null for empty', () => {
    expect(parsePrefixedSourceId('')).toBeNull();
  });
});

describe('ui id helpers', () => {
  it('round-trips with parse', () => {
    const ui = uiHomeworkId('42');
    expect(parsePrefixedSourceId(ui)).toEqual({
      source: 'neverskip',
      sourceId: '42',
    });
    const nui = uiNoticeId('n9');
    expect(parsePrefixedSourceId(nui)?.sourceId).toBe('n9');
  });
});

describe('password hashing', () => {
  it('bcrypt verifies hashed password and rejects wrong password', async () => {
    const hash = await bcrypt.hash('correct-horse-battery', 10);
    expect(await bcrypt.compare('correct-horse-battery', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
    expect(hash).not.toContain('correct-horse');
  });
});

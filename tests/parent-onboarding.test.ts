import { describe, expect, it } from 'vitest';
import { validateRegisterParentInput } from '@/lib/auth-register';
import {
  acknowledgeAccessError,
  classLabelFromParts,
  ERR_NO_LINKED_CHILD,
  ERR_NOT_FOR_LINKED_CLASS,
  itemTargetsIntersect,
  normalizeClassLabel,
  parentHasApprovedLink,
} from '@/lib/parent-access';

describe('validateRegisterParentInput', () => {
  const base = {
    name: 'Pat Parent',
    email: 'pat@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('accepts valid input and normalizes email', () => {
    const result = validateRegisterParentInput({
      ...base,
      email: '  Pat@Example.COM ',
      name: '  Pat Parent  ',
    });
    expect(result).toEqual({
      ok: true,
      name: 'Pat Parent',
      email: 'pat@example.com',
      password: 'password123',
    });
  });

  it('rejects invalid email', () => {
    const result = validateRegisterParentInput({ ...base, email: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email/i);
  });

  it('rejects short password', () => {
    const result = validateRegisterParentInput({
      ...base,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/8 characters/i);
  });

  it('rejects password mismatch', () => {
    const result = validateRegisterParentInput({
      ...base,
      confirmPassword: 'different-password',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/match/i);
  });

  it('rejects empty name', () => {
    const result = validateRegisterParentInput({ ...base, name: '   ' });
    expect(result.ok).toBe(false);
  });
});

describe('parent access helpers', () => {
  it('normalizes class labels', () => {
    expect(normalizeClassLabel(' i-a ')).toBe('I-A');
    expect(normalizeClassLabel('Class I-A')).toBe('I-A');
    expect(classLabelFromParts('Grade 1', 'I-A')).toBe('I-A');
    expect(classLabelFromParts('I-B', null)).toBe('I-B');
  });

  it('requires approved labels for intersection', () => {
    expect(itemTargetsIntersect(['I-A'], [])).toBe(false);
    expect(parentHasApprovedLink([])).toBe(false);
    expect(parentHasApprovedLink(['I-A'])).toBe(true);
  });

  it('allows I-A homework for I-A parent only', () => {
    expect(itemTargetsIntersect(['I-A'], ['I-A'])).toBe(true);
    expect(itemTargetsIntersect(['I-B'], ['I-A'])).toBe(false);
    expect(itemTargetsIntersect(['I-A', 'I-B'], ['I-A'])).toBe(true);
  });

  it('treats empty targets as I-A (product default)', () => {
    expect(itemTargetsIntersect([], ['I-A'])).toBe(true);
    expect(itemTargetsIntersect([], ['I-B'])).toBe(false);
  });

  it('ALL targets require any approved link', () => {
    expect(itemTargetsIntersect(['ALL'], ['I-A'])).toBe(true);
    expect(itemTargetsIntersect(['ALL'], [])).toBe(false);
  });

  it('acknowledgeAccessError messages', () => {
    expect(acknowledgeAccessError([], ['I-A'])).toBe(ERR_NO_LINKED_CHILD);
    expect(acknowledgeAccessError(['I-A'], ['I-B'])).toBe(ERR_NOT_FOR_LINKED_CLASS);
    expect(acknowledgeAccessError(['I-A'], ['I-A'])).toBeNull();
  });
});

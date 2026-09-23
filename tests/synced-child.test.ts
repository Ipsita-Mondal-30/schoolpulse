import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEVERSKIP_STUDENT_ID,
  resolveConfiguredChildName,
  resolveConfiguredNeverSkipStudentId,
  resolveConfiguredSection,
} from '@/lib/synced-child';
import { acknowledgeAccessError, ERR_NO_LINKED_CHILD } from '@/lib/parent-access';
import { filterUpdatesBySection, type UpdateFeedItem } from '@/lib/updates-feed';

describe('synced child identity', () => {
  it('uses a stable NeverSkip student id by default', () => {
    expect(resolveConfiguredNeverSkipStudentId()).toBe(DEFAULT_NEVERSKIP_STUDENT_ID);
  });

  it('defaults child display name without inventing a person', () => {
    expect(resolveConfiguredChildName()).toBe('Your child');
  });

  it('does not invent a section from empty env', () => {
    expect(resolveConfiguredSection()).toBeNull();
  });

  it('reports Child not synced only when no approved link', () => {
    expect(acknowledgeAccessError([], ['I-A'])).toBe(ERR_NO_LINKED_CHILD);
    expect(ERR_NO_LINKED_CHILD).toBe('Child not synced');
    expect(acknowledgeAccessError(['I-A'], ['I-A'])).toBeNull();
  });
});

describe('parent UI has no class/section picker dependency', () => {
  it('filters updates by synced section without requiring a picker', () => {
    const items = [
      {
        id: '1',
        sections: ['I-A'],
        section: 'recent',
      },
      {
        id: '2',
        sections: ['I-B'],
        section: 'recent',
      },
    ] as UpdateFeedItem[];

    expect(filterUpdatesBySection(items, 'I-A').map((i) => i.id)).toEqual(['1']);
  });
});

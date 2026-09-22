import { describe, expect, it } from 'vitest';
import noticesFile from '@/data/notices.json';
import libraryFile from '@/data/content-library.json';
import {
  getLibraryResourceById,
  normalizeLibraryText,
  resolveNoticeLibraryLink,
  type LibraryResourceRef,
} from '@/lib/notice-library-link';

const notices = noticesFile.notices as Array<{
  id: string;
  date: string;
  summary: string;
  message: string;
}>;
const resources = (libraryFile.resources as LibraryResourceRef[]).map((r) => ({
  id: r.id,
  title: r.title,
  date: r.date,
}));

describe('notice Content Library linking', () => {
  it('links a notice with a unique same-date title match to that library item', () => {
    const notice = notices.find((n) => /hindi revision paper 4/i.test(`${n.summary} ${n.message}`));
    expect(notice).toBeTruthy();
    const link = resolveNoticeLibraryLink(notice!, resources);
    expect(link?.kind).toBe('item');
    if (link?.kind !== 'item') return;

    const matched = resources.find((r) => r.id === link.resourceId);
    expect(matched).toBeTruthy();
    expect(matched?.date).toBe(notice!.date);
    expect(normalizeLibraryText(`${notice!.summary} ${notice!.message}`)).toContain(
      normalizeLibraryText(matched!.title),
    );
    expect(link.href).toBe(`/class-diary?resource=${encodeURIComponent(link.resourceId)}`);
    expect(getLibraryResourceById(link.resourceId, resources)?.id).toBe(link.resourceId);
  });

  it('does not invent a specific item when the Content Library mention is generic', () => {
    const notice = notices.find((n) => /all revision papers/i.test(n.message));
    expect(notice).toBeTruthy();
    const link = resolveNoticeLibraryLink(notice!, resources);
    expect(link).toEqual({ kind: 'library', href: '/class-diary' });
    expect(link && 'resourceId' in link ? link.resourceId : undefined).toBeUndefined();
  });

  it('does not show a library action when the notice does not mention Content Library', () => {
    const notice = notices.find(
      (n) =>
        /english textbook/i.test(`${n.summary} ${n.message}`) &&
        !/content library/i.test(`${n.summary} ${n.message}`),
    );
    expect(notice).toBeTruthy();
    expect(resolveNoticeLibraryLink(notice!, resources)).toBeNull();
  });

  it('falls back to the library landing when more than one title could match', () => {
    const link = resolveNoticeLibraryLink(
      {
        date: '2026-01-02',
        summary: 'Notes uploaded in the Content Library',
        message: 'Please see the shared notes',
      },
      [
        { id: 'one', title: 'Notes', date: '2026-01-02' },
        { id: 'two', title: 'shared notes', date: '2026-01-02' },
      ],
    );
    expect(link).toEqual({ kind: 'library', href: '/class-diary' });
  });

  it('does not invent a library card for an unknown resource id', () => {
    expect(getLibraryResourceById('not-a-real-resource', resources)).toBeNull();
    expect(getLibraryResourceById(null, resources)).toBeNull();
  });
});

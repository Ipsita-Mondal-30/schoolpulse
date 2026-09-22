/**
 * Conservative notice → Content Library linking.
 * Never invents a specific item: unique same-date title match, else landing, else none.
 */

export const CONTENT_LIBRARY_PATH = '/class-diary';

export interface LibraryResourceRef {
  id: string;
  title: string;
  date: string;
}

export interface NoticeLibraryText {
  summary?: string;
  message?: string;
  date?: string;
}

export type NoticeLibraryLink =
  | { kind: 'item'; href: string; resourceId: string }
  | { kind: 'library'; href: string };

const LIBRARY_PHRASE_RE = /content\s*library/i;

export function mentionsContentLibrary(text: string): boolean {
  return LIBRARY_PHRASE_RE.test(text || '');
}

export function normalizeLibraryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getLibraryResourceById(
  id: string | null | undefined,
  resources: LibraryResourceRef[],
): LibraryResourceRef | null {
  if (!id) return null;
  return resources.find((r) => r.id === id) ?? null;
}

function noticeHaystack(notice: NoticeLibraryText): string {
  return normalizeLibraryText(`${notice.summary || ''} ${notice.message || ''}`);
}

function matchingResources(
  notice: NoticeLibraryText,
  resources: LibraryResourceRef[],
): LibraryResourceRef[] {
  const date = notice.date || '';
  if (!date) return [];
  const haystack = noticeHaystack(notice);
  if (!haystack) return [];
  return resources.filter((resource) => {
    if (resource.date !== date) return false;
    const title = normalizeLibraryText(resource.title);
    if (!title) return false;
    return haystack.includes(title);
  });
}

export function resolveNoticeLibraryLink(
  notice: NoticeLibraryText,
  resources: LibraryResourceRef[],
): NoticeLibraryLink | null {
  const raw = `${notice.summary || ''} ${notice.message || ''}`;
  if (!mentionsContentLibrary(raw)) return null;

  const matches = matchingResources(notice, resources);
  if (matches.length === 1) {
    const resourceId = matches[0].id;
    return {
      kind: 'item',
      resourceId,
      href: `${CONTENT_LIBRARY_PATH}?resource=${encodeURIComponent(resourceId)}`,
    };
  }

  return { kind: 'library', href: CONTENT_LIBRARY_PATH };
}

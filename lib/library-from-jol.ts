/**
 * Map Neon Content Library / JOL rows into the Library page card shape.
 */

import type { UiJolItem } from '@/app/actions';
import type { LibraryResourceRef } from '@/lib/notice-library-link';

export type LibraryMedia = { type: string; file: string; url?: string };

export type LibraryResource = {
  id: string;
  subject: string;
  title: string;
  description: string;
  date: string;
  time: string;
  section: string;
  category?: string;
  grade?: string;
  monthLabel?: string;
  media: LibraryMedia[];
};

function mediaTypeFromJol(mediaType: string, url: string | null): string {
  if (mediaType === 'I' || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url || '')) return 'I';
  return 'P';
}

export function jolItemToLibraryResource(item: UiJolItem): LibraryResource {
  const subject = (item.subjectName || item.resourceType || 'GENERAL').toUpperCase();
  const category =
    /newsletter/i.test(item.title) || /newsletter/i.test(item.resourceType)
      ? 'NEWSLETTER'
      : subject === 'NEWSLETTER'
        ? 'NEWSLETTER'
        : undefined;

  const media: LibraryMedia[] = [];
  if (item.media.length > 0) {
    for (const m of item.media) {
      const url = m.downloadUrl || m.mediaUrl;
      if (!url) continue;
      media.push({
        type: mediaTypeFromJol(m.mediaType, url),
        file: url.split('/').pop() || 'file',
        url,
      });
    }
  } else {
    const url = item.downloadUrl || item.resourceUrl;
    if (url) {
      media.push({
        type: mediaTypeFromJol(item.resourceType, url),
        file: url.split('/').pop() || 'file',
        url,
      });
    }
  }

  return {
    id: item.id,
    subject: category === 'NEWSLETTER' ? 'NEWSLETTER' : subject,
    title: item.title,
    description: item.description || item.content.slice(0, 280),
    date: item.publishedDate || item.activityDate || '',
    time: item.publishedTime || '00:00',
    section: item.sections.join(', '),
    category,
    media,
  };
}

export function jolItemsToLibraryResources(items: UiJolItem[]): LibraryResource[] {
  return items.map(jolItemToLibraryResource);
}

export function jolItemsToLibraryRefs(items: UiJolItem[]): LibraryResourceRef[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    date: item.publishedDate || item.activityDate || '',
  }));
}

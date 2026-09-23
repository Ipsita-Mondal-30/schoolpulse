import { createHash } from 'crypto';

function collapse(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function deadlineContentHash(parts: {
  entityType: string;
  sourceId: string;
  title: string;
  body: string;
  sourceDate: string;
  structuredDue?: string | null;
  related?: Array<{ sourceId: string; title: string; body: string }>;
}): string {
  const related = (parts.related ?? [])
    .map((r) => `${r.sourceId}|${collapse(r.title)}|${collapse(r.body)}`)
    .sort();
  const payload = JSON.stringify({
    entityType: parts.entityType,
    sourceId: parts.sourceId,
    title: collapse(parts.title),
    body: collapse(parts.body).slice(0, 4000),
    sourceDate: parts.sourceDate || '',
    structuredDue: parts.structuredDue || '',
    extractor: 2,
    related,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * The portal sometimes returns the same Daily Notice with different whitespace
 * (collapsed vs. line breaks), and older scrapes dropped line breaks entirely
 * ("GurudevNamaste"). Two rows with the same publication date/time and the same text
 * ignoring all whitespace are one notice.
 */

export function normalizeNoticeText(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function compactNoticeText(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, '');
}

export function noticeDedupeKey(n: {
  publishedDate?: string | null;
  publishedTime?: string | null;
  content?: string | null;
}): string {
  return `${n.publishedDate ?? ''}|${n.publishedTime ?? ''}|${compactNoticeText(n.content)}`;
}

function hasPortalMessageId(row: { sourceId?: string | null }): boolean {
  return Boolean(row.sourceId?.startsWith('msid:'));
}

/**
 * One row per dedupe key, in the caller's order. A row keyed by portal message id wins
 * over a legacy content-hash row; otherwise the first row (newest import) wins.
 */
export function dedupeNoticeRows<
  T extends {
    publishedDate?: string | null;
    publishedTime?: string | null;
    content?: string | null;
    sourceId?: string | null;
  },
>(rows: T[]): T[] {
  const chosen = new Map<string, T>();
  for (const row of rows) {
    if (!compactNoticeText(row.content)) continue;
    const key = noticeDedupeKey(row);
    const current = chosen.get(key);
    if (!current || (!hasPortalMessageId(current) && hasPortalMessageId(row))) chosen.set(key, row);
  }
  return rows.filter((row) => !compactNoticeText(row.content) || chosen.get(noticeDedupeKey(row)) === row);
}

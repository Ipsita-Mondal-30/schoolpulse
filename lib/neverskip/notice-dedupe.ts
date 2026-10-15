/**
 * The portal sometimes returns the same Daily Notice with different whitespace
 * (collapsed vs. line breaks), which changes the content-hash sourceId. Two rows with
 * the same publication date/time and the same whitespace-normalized text are one notice.
 */

export function normalizeNoticeText(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function noticeDedupeKey(n: {
  publishedDate?: string | null;
  publishedTime?: string | null;
  content?: string | null;
}): string {
  return `${n.publishedDate ?? ''}|${n.publishedTime ?? ''}|${normalizeNoticeText(n.content)}`;
}

/** Keep the first row per dedupe key (callers order newest-imported first). */
export function dedupeNoticeRows<
  T extends { publishedDate?: string | null; publishedTime?: string | null; content?: string | null },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = noticeDedupeKey(row);
    if (!normalizeNoticeText(row.content) || !seen.has(key)) out.push(row);
    seen.add(key);
  }
  return out;
}

/**
 * Source attachments (homework files, notice images/documents) preserved as-is.
 * Only URLs present in the NeverSkip payload are kept — nothing is synthesized.
 */

export interface SourceAttachment {
  url: string;
  name?: string;
}

const URL_RE = /^(https?:\/\/|\/)|^[\w\-./%]+\.[a-z0-9]{2,5}(\?.*)?$/i;

const NOTICE_ATTACHMENT_KEYS = [
  'image',
  'attachment',
  'attachments',
  'files',
  'file',
  'file_url',
  'doc_url',
  'download_url',
  'ntc_files',
] as const;

function addUrl(out: SourceAttachment[], seen: Set<string>, rawUrl: unknown, rawName?: unknown): void {
  const url = String(rawUrl ?? '').trim();
  if (!url || !URL_RE.test(url) || seen.has(url)) return;
  seen.add(url);
  const name = String(rawName ?? '').trim();
  out.push(name ? { url, name } : { url });
}

function collect(out: SourceAttachment[], seen: Set<string>, value: unknown): void {
  if (value == null) return;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return;
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        collect(out, seen, JSON.parse(s));
        return;
      } catch {
        /* fall through to plain string handling */
      }
    }
    const parts = (s.match(/https?:\/\//gi)?.length ?? 0) > 1 ? s.split(/[,|\s]+(?=https?:\/\/)/i) : [s];
    for (const part of parts) addUrl(out, seen, part.replace(/[,|]\s*$/, ''));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collect(out, seen, v);
    return;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const url = o.url ?? o.file_url ?? o.download_url ?? o.dwn_url ?? o.path;
    addUrl(out, seen, url, o.name ?? o.file_name ?? o.title);
  }
}

export function extractHomeworkAttachments(raw: {
  download_url?: unknown;
  ass_files?: unknown;
}): SourceAttachment[] {
  const out: SourceAttachment[] = [];
  const seen = new Set<string>();
  collect(out, seen, raw.download_url);
  collect(out, seen, raw.ass_files);
  return out;
}

export function extractNoticeAttachments(raw: Record<string, unknown>): SourceAttachment[] {
  const out: SourceAttachment[] = [];
  const seen = new Set<string>();
  for (const key of NOTICE_ATTACHMENT_KEYS) collect(out, seen, raw[key]);
  return out;
}

export function parseAttachmentsJson(raw: string | null | undefined): SourceAttachment[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: SourceAttachment[] = [];
    const seen = new Set<string>();
    for (const item of v) collect(out, seen, item);
    return out;
  } catch {
    return [];
  }
}

/** Stable comparison key (order-insensitive, URL only). */
export function attachmentsKey(list: SourceAttachment[] | undefined): string[] {
  return (list ?? []).map((a) => a.url).sort();
}

export function isImageAttachmentUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(url);
}

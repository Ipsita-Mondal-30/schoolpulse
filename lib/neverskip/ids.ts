import { createHash } from 'crypto';
import { NEVERSKIP_SOURCE } from './types';

export function homeworkSourceId(assignId?: string | number | null, refId?: string | number | null): string | null {
  const assign = assignId != null && String(assignId).trim() !== '' ? String(assignId).trim() : null;
  if (assign) return assign;
  const ref = refId != null && String(refId).trim() !== '' ? String(refId).trim() : null;
  return ref;
}

/** Prefer explicit notice id; else stable hash of date|time|title|content. */
export function noticeSourceId(input: {
  id?: string | number | null;
  noticeId?: string | number | null;
  date?: string | null;
  time?: string | null;
  title?: string | null;
  content?: string | null;
}): string {
  const explicit =
    input.id != null && String(input.id).trim() !== ''
      ? String(input.id).trim()
      : input.noticeId != null && String(input.noticeId).trim() !== ''
        ? String(input.noticeId).trim()
        : null;
  if (explicit) return explicit;

  const payload = [
    (input.date ?? '').trim(),
    (input.time ?? '').trim(),
    (input.title ?? '').trim(),
    (input.content ?? '').trim(),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function uiHomeworkId(sourceId: string, source: string = NEVERSKIP_SOURCE): string {
  return `${source}:${sourceId}`;
}

export function uiNoticeId(sourceId: string, source: string = NEVERSKIP_SOURCE): string {
  return `${source}:${sourceId}`;
}

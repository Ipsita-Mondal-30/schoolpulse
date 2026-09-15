/** Bumped so visits to the old change-only Updates page don't hide newly imported items. */
export const UPDATES_LAST_SEEN_KEY = 'schoolpulse_updates_feed_last_seen';
export const READ_NOTICES_KEY = 'schoolpulse_read_notices';

export function readLastSeenIso(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(UPDATES_LAST_SEEN_KEY);
}

export function writeLastSeenNow(): string {
  const iso = new Date().toISOString();
  localStorage.setItem(UPDATES_LAST_SEEN_KEY, iso);
  return iso;
}

export function readNoticeIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(READ_NOTICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markNoticeRead(id: string): string[] {
  const next = Array.from(new Set([...readNoticeIds(), id]));
  localStorage.setItem(READ_NOTICES_KEY, JSON.stringify(next));
  return next;
}

export function isNewerThan(iso: string, lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  const t = new Date(iso).getTime();
  const seen = new Date(lastSeen).getTime();
  if (Number.isNaN(t) || Number.isNaN(seen)) return true;
  return t > seen;
}

export function noticePublishedIso(date: string, time?: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const hhmm = time && /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00';
  return `${date}T${hhmm}:00+05:30`;
}

/**
 * Read-only summaries of NeverSkip portal API responses for module discovery.
 * Output is limited to key names, counts and dates — never record values, tokens or bodies.
 */

/** Parent-portal modules listed by getppschmenupermission for this school. */
export const PORTAL_MODULES = [
  'dashboard',
  'academic',
  'attendance',
  'feedetails',
  'assignments',
  'lounge',
  'class-diary',
  'dailynotice',
  'content-library',
  'calendar',
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number];

/** Modules SchoolPulse currently extracts and stores. */
export const SYNCED_MODULES: Partial<Record<PortalModule, string>> = {
  assignments: 'ImportedHomework (getassignmentsapi)',
  dailynotice: 'ImportedNotice (fetchdailynoticeinfo)',
  'content-library': 'ImportedJolItem (fetchcontentlib)',
  calendar: 'ImportedScheduleEvent (fetchcalenderapi)',
};

export type ResponseSummary = {
  largestListLength: number;
  itemKeys: string[];
  newestDate: string | null;
  oldestDate: string | null;
  pdfLinks: number;
  newsletterMentions: number;
  paginationKeys: string[];
};

const PAGINATION_KEY = /^(page|page_?no|pg_?key|page_?count|total_?count|limit|limt|offset|sfile_limit|start|next)$/i;

/** Normalise common portal date formats to YYYY-MM-DD; null when not a plausible date. */
export function normalizePortalDate(value: string): string | null {
  const s = value.trim();
  let y: number;
  let m: number;
  let d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{2})[-/](\d{2})[-/](\d{4})\b/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function summarizePortalResponse(json: unknown): ResponseSummary {
  let largest: unknown[] = [];
  const dates: string[] = [];
  const paginationKeys = new Set<string>();
  let pdfLinks = 0;
  let newsletterMentions = 0;

  const walk = (node: unknown, depth: number) => {
    if (depth > 6 || node == null) return;
    if (typeof node === 'string') {
      const date = normalizePortalDate(node);
      if (date) dates.push(date);
      if (/\.pdf(\?|$)/i.test(node)) pdfLinks += 1;
      if (/news\s*letter/i.test(node)) newsletterMentions += 1;
      return;
    }
    if (Array.isArray(node)) {
      if (node.length > largest.length) largest = node;
      for (const item of node.slice(0, 500)) walk(item, depth + 1);
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (PAGINATION_KEY.test(k)) paginationKeys.add(k);
        walk(v, depth + 1);
      }
    }
  };
  walk(json, 0);

  const first = largest.find((x) => x && typeof x === 'object' && !Array.isArray(x)) as
    | Record<string, unknown>
    | undefined;
  dates.sort();
  return {
    largestListLength: largest.length,
    itemKeys: first ? Object.keys(first).slice(0, 40) : [],
    newestDate: dates.length ? dates[dates.length - 1] : null,
    oldestDate: dates.length ? dates[0] : null,
    pdfLinks,
    newsletterMentions,
    paginationKeys: [...paginationKeys].sort(),
  };
}

/** Request body key names only (pagination/filter discovery). */
export function requestBodyKeys(postData: string | null): string[] {
  if (!postData) return [];
  try {
    const parsed = JSON.parse(postData) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).sort() : [];
  } catch {
    return [];
  }
}

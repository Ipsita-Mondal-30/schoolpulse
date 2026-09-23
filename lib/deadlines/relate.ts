/**
 * Conservative homework ↔ notice pairing.
 * Sharing a subject word like "EVS" is not enough.
 */

import { addDaysYmd } from '@/lib/daily-brief';
import { isValidSchoolYmd } from '@/lib/homework-dates';

const SUBJECT_ALIASES: Record<string, string> = {
  evs: 'evs',
  'e.v.s': 'evs',
  'environmental science': 'evs',
  hindi: 'hindi',
  mathematics: 'maths',
  maths: 'maths',
  math: 'maths',
  english: 'english',
  kannada: 'kannada',
  'computer science': 'computers',
  computers: 'computers',
};

const STOP = new Set([
  'the',
  'and',
  'for',
  'homework',
  'today',
  'todays',
  'dear',
  'parents',
  'students',
  'children',
  'kindly',
  'please',
  'notes',
  'jai',
  'shri',
  'gurudev',
  'namaste',
  'thank',
  'you',
  'complete',
  'completion',
  'chapter',
  'page',
  'pg',
]);

const DISTINCTIVE = [
  'revision',
  'completion',
  'submit',
  'submission',
  'workbook',
  'sulekh',
  'sulekha',
  'matra',
  'caterpillar',
  'shapes',
  'patterns',
  'bitiya',
];

export type RelatableHomework = {
  sourceId: string;
  subjectName: string;
  title: string;
  description: string;
  homeworkDate: string;
  sections: string[];
};

export type RelatableNotice = {
  sourceId: string;
  title: string;
  summary: string;
  content: string;
  publishedDate: string;
  classes: string[];
};

function collapse(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalSubject(raw: string): string {
  const s = collapse(raw);
  if (!s) return '';
  for (const [alias, canon] of Object.entries(SUBJECT_ALIASES)) {
    if (s === alias || s.includes(alias)) return canon;
  }
  return s.split(' ')[0] || '';
}

function subjectOfNotice(n: RelatableNotice): string {
  return canonicalSubject(`${n.title} ${n.summary} ${n.content}`.slice(0, 400));
}

function tokens(raw: string): Set<string> {
  return new Set(
    collapse(raw)
      .split(' ')
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

function dateProximity(hwDate: string, noticeDate: string): boolean {
  if (!isValidSchoolYmd(hwDate) || !isValidSchoolYmd(noticeDate)) return false;
  const lo = addDaysYmd(hwDate, -7);
  const hi = addDaysYmd(hwDate, 21);
  return Boolean(lo && hi && noticeDate >= lo && noticeDate <= hi);
}

function sectionsOverlap(hw: string[], notice: string[]): boolean {
  if (!hw.length || !notice.length) return true;
  const want = new Set(hw.map((s) => s.trim().toUpperCase()));
  return notice.some((c) => {
    const u = c.trim().toUpperCase();
    if (!u || u === 'ALL' || u === 'ALLCLASSES') return true;
    if (want.has(u)) return true;
    if (u === 'I' && [...want].some((s) => s.startsWith('I-'))) return true;
    return false;
  });
}

function isRevisionOrCompletionActivity(text: string): boolean {
  return /\b(revision|completion|complete by|complete on|submit|submission)\b/i.test(text);
}

const TOPIC_NOUNS = [
  'workbook',
  'sulekh',
  'sulekha',
  'matra',
  'caterpillar',
  'shapes',
  'patterns',
  'bitiya',
  'paper',
] as const;

function topicKeys(text: string): Set<string> {
  const s = collapse(text);
  const keys = new Set<string>();
  for (const m of s.matchAll(/\b(?:ch|chapter)\s*(\d+)\b/g)) {
    keys.add(`ch:${m[1]}`);
  }
  for (const word of TOPIC_NOUNS) {
    if (s.includes(word)) keys.add(word);
  }
  return keys;
}

/** True when both sides name different chapters or different artifacts (workbook vs paper). */
export function topicsConflict(hwText: string, noticeText: string): boolean {
  const a = topicKeys(hwText);
  const b = topicKeys(noticeText);
  if (a.size === 0 || b.size === 0) return false;
  const aCh = [...a].filter((k) => k.startsWith('ch:'));
  const bCh = [...b].filter((k) => k.startsWith('ch:'));
  if (aCh.length && bCh.length && !aCh.some((k) => b.has(k))) return true;
  const aNoun = [...a].filter((k) => !k.startsWith('ch:'));
  const bNoun = [...b].filter((k) => !k.startsWith('ch:'));
  if (aNoun.length && bNoun.length && !aNoun.some((k) => b.has(k))) return true;
  return false;
}

function distinctiveOverlap(hwText: string, noticeText: string): boolean {
  if (topicsConflict(hwText, noticeText)) return false;
  const a = collapse(hwText);
  const b = collapse(noticeText);
  const hwKeys = topicKeys(hwText);
  const nKeys = topicKeys(noticeText);
  const keysOverlap = [...hwKeys].some((k) => nKeys.has(k));
  for (const word of DISTINCTIVE) {
    if (a.includes(word) && b.includes(word)) return true;
  }
  if (isRevisionOrCompletionActivity(hwText) && isRevisionOrCompletionActivity(noticeText)) {
    if (hwKeys.size === 0 && nKeys.size === 0) return true;
    return keysOverlap;
  }
  const ta = tokens(hwText);
  const tb = tokens(noticeText);
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared += 1;
  }
  return shared >= 2;
}

export function homeworkNoticeRelated(hw: RelatableHomework, notice: RelatableNotice): boolean {
  const hwSub = canonicalSubject(hw.subjectName || hw.title);
  const nSub = subjectOfNotice(notice);
  if (!hwSub || !nSub || hwSub !== nSub) return false;
  if (!dateProximity(hw.homeworkDate, notice.publishedDate)) return false;
  if (!sectionsOverlap(hw.sections, notice.classes)) return false;
  const hwText = `${hw.title} ${hw.description}`;
  const nText = `${notice.title} ${notice.summary} ${notice.content}`;
  if (!distinctiveOverlap(hwText, nText) && !collapse(nText).includes(collapse(hw.title).slice(0, 24))) {
    return false;
  }
  return true;
}

export function relatedNoticesForHomework(
  hw: RelatableHomework,
  notices: RelatableNotice[],
): RelatableNotice[] {
  return notices.filter((n) => homeworkNoticeRelated(hw, n)).slice(0, 3);
}

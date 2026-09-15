/**
 * Topic extraction for Today's Recap — no LLM, no invented topics.
 */

import {
  normalizeLibraryText,
  type LibraryResourceRef,
} from '@/lib/notice-library-link';

export const INSUFFICIENT_TOPIC_REASON =
  'Insufficient information to identify learning topic';

export interface HomeworkTopicSource {
  title: string;
  description: string;
  subject: string;
  /** YYYY-MM-DD homework sent date when known */
  date?: string;
}

export interface LibraryResourceDetail extends LibraryResourceRef {
  description?: string;
  subject?: string;
}

export type TopicExtractionResult =
  | {
      eligible: true;
      topic: string;
      subject: string;
      grade: string;
      sourceSnippets: string[];
      libraryResourceId?: string;
    }
  | {
      eligible: false;
      reason: string;
    };

/** Page / logistics-only homework — not a learning topic. */
const INELIGIBLE_PATTERNS: RegExp[] = [
  /\bcomplete\s+page\b/i,
  /\bdo\s+page\b/i,
  /\bpg\.?\s*\d+/i,
  /\bpage\s*\d+\b/i,
  /\bsend\s+(the\s+)?(notebook|textbook|workbook|diary)\b/i,
  /\breturn\s+(the\s+)?(notebook|textbook|workbook)\b/i,
  /\bsubmit\s+(the\s+)?(notebook|textbook|workbook)\b/i,
  /^\s*worksheet\s*\d+\s*$/i,
  /^\s*exercise\s*\d+(\.\d+)?\s*$/i,
];

const LEARNING_HINT =
  /\b(learn|practice|revise|revision|opposite|opposites|addition|subtraction|multiply|division|words?|numbers?|shapes?|phonics|grammar|reading|writing|spell|maths?|english|hindi|kannada|evs|science|matra|sulekh|chapter|unit)\b/i;

/** Explicit school learning markers (Devanagari मात्रा, matra, chapter titles, etc.). */
const EXPLICIT_TOPIC_HINT =
  /मात्रा|\bmatra\b|\bopposites?\b|\bshapes?\b|\bpatterns?\b|\bphonics\b|\bgrammar\b|\bchapter\b|\bunit\b/i;

function cleanSnippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function looksLikePageOnly(topic: string): boolean {
  const t = cleanSnippet(topic);
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^(page|pg\.?)\s*\d+$/i.test(t)) return true;
  if (/^do\s+page\s*\d+/i.test(t)) return true;
  if (/^complete\s+page\s*\d+/i.test(t)) return true;
  return false;
}

/**
 * Prefer Content Library when exactly one same-date title match exists
 * in homework title/description (no invented IDs).
 */
export function findHomeworkLibraryResource(
  homework: HomeworkTopicSource,
  resources: LibraryResourceDetail[],
): LibraryResourceDetail | null {
  const date = homework.date || '';
  if (!date) return null;
  const haystack = normalizeLibraryText(`${homework.title} ${homework.description}`);
  if (!haystack) return null;
  const matches = resources.filter((resource) => {
    if (resource.date !== date) return false;
    const title = normalizeLibraryText(resource.title);
    if (!title || title.length < 4) return false;
    return haystack.includes(title) || title.includes(haystack.slice(0, 40));
  });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Pull an explicit learning topic from school text when present.
 * Examples: "(उ की मात्रा)", "ए ki Matra", "Chapter-10 Shapes and Patterns".
 * Never invents a topic for bare "Complete page 42".
 */
export function extractExplicitTopic(text: string): string | null {
  const cleaned = cleanSnippet(text);
  if (!cleaned) return null;

  // Parenthetical topic: Do Page No 12 (उ की मात्रा)
  const parenMatches = cleaned.matchAll(/\(\s*([^)]{2,60})\s*\)/g);
  for (const match of parenMatches) {
    const inner = cleanSnippet(match[1] ?? '');
    if (!inner || looksLikePageOnly(inner)) continue;
    if (EXPLICIT_TOPIC_HINT.test(inner) || /[\u0900-\u097F]{2,}/.test(inner)) {
      return inner;
    }
  }

  // Devanagari: उ की मात्रा / ए की मात्रा
  const matraHi = cleaned.match(/([\u0900-\u097F]+(?:\s+[\u0900-\u097F]+)*\s*की\s*मात्रा)/);
  if (matraHi?.[1]) return cleanSnippet(matraHi[1]);

  // Latin/mixed: ए ki Matra / AA ki matra
  const matraEn = cleaned.match(
    /((?:[\u0900-\u097F]+|[A-Za-z]{1,8})(?:\s+(?:[\u0900-\u097F]+|[A-Za-z]{1,8})){0,2}\s+ki\s+matra)/i,
  );
  if (matraEn?.[1]) return cleanSnippet(matraEn[1]);

  // Chapter / Unit titles when they include a real topic phrase
  const chapter = cleaned.match(
    /\b((?:chapter|unit)\s*[-–]?\s*\d+(?:\s*(?:worksheet\s*\d+(\s+of)?)?)?\s*[:.\-]?\s*[A-Za-z\u0900-\u097F][\w\u0900-\u097F\s&'-]{2,50})/i,
  );
  if (chapter?.[1]) {
    const topic = cleanSnippet(chapter[1]).replace(/\s+/g, ' ');
    if (!looksLikePageOnly(topic) && topic.length <= 80) return topic;
  }

  // Opposite words / shapes-style short titles
  if (/\bopposite\s+words?\b/i.test(cleaned)) {
    const m = cleaned.match(/\b(opposite\s+words?)\b/i);
    if (m?.[1]) return cleanSnippet(m[1]);
  }

  return null;
}

function deriveTopicFromText(text: string): string | null {
  const cleaned = cleanSnippet(text);
  if (!cleaned || cleaned.length < 8) return null;

  const explicit = extractExplicitTopic(cleaned);
  if (explicit) return explicit;

  const learnMatch = cleaned.match(
    /\b(?:learn|practice|revise)\s+(.+?)(?:\.|$)/i,
  );
  if (learnMatch?.[1]) {
    const topic = cleanSnippet(learnMatch[1]).replace(/[.!]+$/, '');
    if (topic.length >= 3 && !looksLikePageOnly(topic)) {
      return topic.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  if (LEARNING_HINT.test(cleaned) && !INELIGIBLE_PATTERNS.some((re) => re.test(cleaned))) {
    // Use a short title-cased phrase from the start of the sentence
    const short = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
    if (short.length >= 8 && short.length <= 80) {
      return short.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return null;
}

export function extractLearningTopic(
  homework: HomeworkTopicSource,
  resources: LibraryResourceDetail[] = [],
): TopicExtractionResult {
  const library = findHomeworkLibraryResource(homework, resources);
  const snippets: string[] = [];

  const title = cleanSnippet(homework.title);
  const description = cleanSnippet(homework.description);
  if (title) snippets.push(title);
  if (description) snippets.push(description);
  if (library) {
    const libTitle = cleanSnippet(library.title);
    const libDesc = cleanSnippet(library.description || '');
    if (libTitle) snippets.unshift(libTitle);
    if (libDesc) snippets.unshift(libDesc);
  }

  const combined = snippets.join(' ');
  if (!combined.trim()) {
    return { eligible: false, reason: INSUFFICIENT_TOPIC_REASON };
  }

  const schoolText = [title, description].filter(Boolean).join(' ');

  // Prefer parenthetical / explicit topics from notes before the short title.
  // Example: title "ए ki Matra sulekh…" + notes "(ए की मात्रा)" → use the paren topic.
  let topic: string | null =
    extractExplicitTopic(description) ||
    extractExplicitTopic(title) ||
    extractExplicitTopic(schoolText);

  if (
    !topic &&
    schoolText &&
    INELIGIBLE_PATTERNS.some((re) => re.test(schoolText)) &&
    !LEARNING_HINT.test(schoolText) &&
    !EXPLICIT_TOPIC_HINT.test(schoolText)
  ) {
    return { eligible: false, reason: INSUFFICIENT_TOPIC_REASON };
  }

  // Library material preferred when present and no explicit school topic yet
  if (!topic && library) {
    topic =
      extractExplicitTopic(library.title) ||
      extractExplicitTopic(library.description || '') ||
      deriveTopicFromText(library.title) ||
      deriveTopicFromText(library.description || '') ||
      cleanSnippet(library.title) ||
      null;
  }
  if (!topic) {
    topic = deriveTopicFromText(title) || deriveTopicFromText(description);
  }

  if (!topic || looksLikePageOnly(topic)) {
    return { eligible: false, reason: INSUFFICIENT_TOPIC_REASON };
  }

  // Final guard: pure page instructions without a learning hint
  if (
    INELIGIBLE_PATTERNS.some((re) => re.test(topic!)) &&
    !LEARNING_HINT.test(topic!) &&
    !EXPLICIT_TOPIC_HINT.test(topic!)
  ) {
    return { eligible: false, reason: INSUFFICIENT_TOPIC_REASON };
  }

  return {
    eligible: true,
    topic,
    subject: homework.subject || library?.subject || 'General',
    grade: '1',
    sourceSnippets: snippets,
    libraryResourceId: library?.id,
  };
}

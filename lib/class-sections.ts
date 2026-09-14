/** Class 1 section codes used by SchoolPulse targeting and UI filters. */
export const CLASS1_SECTIONS = [
  'I-A',
  'I-B',
  'I-C',
  'I-D',
  'I-E',
  'I-F',
  'I-G',
  'I-H',
  'I-I',
  'I-J',
  'I-K',
] as const;

export type Class1Section = (typeof CLASS1_SECTIONS)[number];

const CLASS1_SET = new Set<string>(CLASS1_SECTIONS);
const CLASS1_CODE_RE = /\bI-[A-K]\b/gi;

export function isClass1Section(value: string): value is Class1Section {
  return CLASS1_SET.has(value);
}

export function defaultClass1Audience(): string[] {
  return [...CLASS1_SECTIONS];
}

/** Historical ingest default when NeverSkip omitted targeting. */
export function isLegacyDefaultHomeworkAudience(sections: string[]): boolean {
  return sections.length === 1 && sections[0] === 'I-A';
}

/** Keep only Class 1 section codes, de-duplicated, stable order. */
export function uniqueClass1Sections(values: string[]): string[] {
  const found = new Set<string>();
  for (const raw of values) {
    const v = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    if (isClass1Section(v)) found.add(v);
  }
  return CLASS1_SECTIONS.filter((sec) => found.has(sec));
}

/** Pull I-A…I-K codes from free text (including "Classes: I-A, I-B"). */
export function parseClass1SectionsFromText(...parts: string[]): string[] {
  const found: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const re = new RegExp(CLASS1_CODE_RE.source, CLASS1_CODE_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(part)) !== null) {
      found.push(m[0].toUpperCase());
    }
  }
  return uniqueClass1Sections(found);
}

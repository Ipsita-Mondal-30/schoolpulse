import type { UiHomeworkItem } from '@/lib/ui-merge';
import { homeworkNoticeRelated, type RelatableHomework, type RelatableNotice } from '@/lib/deadlines/relate';

function collapse(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function combineTitle(a: string, b: string): string {
  const ca = collapse(a);
  const cb = collapse(b);
  if (!cb || ca.includes(cb)) return a;
  if (!ca || cb.includes(ca)) return b;
  if (/revision/i.test(a) && /complet/i.test(b)) return `${a.replace(/\s*\/\s*$/, '')} / completion`;
  if (/complet/i.test(a) && /revision/i.test(b)) return `${b.replace(/\s*\/\s*$/, '')} / completion`;
  return `${a} / ${b}`;
}

export function mergeDeadlineItems(
  homework: UiHomeworkItem[],
  noticeItems: UiHomeworkItem[],
  relatedPairs?: Array<{ homeworkId: string; noticeId: string }>,
): UiHomeworkItem[] {
  const usedNotices = new Set<string>();
  const pairSet = new Set((relatedPairs ?? []).map((p) => `${p.homeworkId}::${p.noticeId}`));
  const out: UiHomeworkItem[] = [];

  for (const hw of homework) {
    const match = noticeItems.find((n) => {
      if (usedNotices.has(n.id)) return false;
      if (pairSet.size > 0) return pairSet.has(`${hw.id}::${n.id}`);
      return (
        Boolean(hw.submissionDate) &&
        hw.submissionDate === n.submissionDate &&
        collapse(hw.subject) === collapse(n.subject)
      );
    });
    if (match) {
      usedNotices.add(match.id);
      out.push({
        ...hw,
        title: combineTitle(hw.title, match.title),
        description: hw.description || match.description,
      });
    } else {
      out.push(hw);
    }
  }

  for (const n of noticeItems) {
    if (!usedNotices.has(n.id)) out.push(n);
  }
  return out;
}

export function mergePairsFromRelation(
  homework: RelatableHomework[],
  notices: RelatableNotice[],
  homeworkUiId: (sourceId: string) => string,
  noticeUiId: (sourceId: string) => string,
): Array<{ homeworkId: string; noticeId: string }> {
  const pairs: Array<{ homeworkId: string; noticeId: string }> = [];
  for (const hw of homework) {
    for (const n of notices) {
      if (homeworkNoticeRelated(hw, n)) {
        pairs.push({ homeworkId: homeworkUiId(hw.sourceId), noticeId: noticeUiId(n.sourceId) });
      }
    }
  }
  return pairs;
}

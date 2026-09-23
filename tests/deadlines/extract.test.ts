import { describe, expect, it, vi } from 'vitest';
import { buildThisWeekView } from '@/lib/this-week';
import { canonicalDueDate } from '@/lib/deadlines/canonical';
import { deadlineContentHash } from '@/lib/deadlines/hash';
import { mergeDeadlineItems } from '@/lib/deadlines/merge';
import { extractDeadlineWithGemini } from '@/lib/deadlines/gemini';
import { homeworkNoticeRelated } from '@/lib/deadlines/relate';
import { extractRelativeDeadline } from '@/lib/deadlines/relative';
import { DETERMINISTIC_EXTRACTOR, shouldReuseCachedExtraction } from '@/lib/deadlines/run';
import { noneExtraction, type DeadlineExtractionResult } from '@/lib/deadlines/schema';
import { deterministicFromText, validateAgainstSource } from '@/lib/deadlines/validate';
import type { UiHomeworkItem } from '@/lib/ui-merge';

function hw(partial: Partial<UiHomeworkItem> & Pick<UiHomeworkItem, 'id' | 'title'>): UiHomeworkItem {
  return {
    subject: 'EVS',
    sections: ['I-A'],
    description: '',
    sentDate: '2026-09-23',
    ...partial,
  };
}

describe('explicit date extraction', () => {
  it('CASE 1: EVS completion on 25 September → 2026-09-25 HIGH', () => {
    const result = deterministicFromText(
      'EVS completion on 25 September',
      '2026-09-23',
      'HOMEWORK_TEXT',
      'evs-1',
    );
    expect(result.hasDueDate).toBe(true);
    expect(result.dueDate).toBe('2026-09-25');
    expect(result.confidence).toBe('HIGH');
  });

  it('CASE 5: Submit on 27/09/2026 → 2026-09-27 HIGH', () => {
    const result = deterministicFromText(
      'Submit on 27/09/2026',
      '2026-09-23',
      'HOMEWORK_TEXT',
      'x',
    );
    expect(result.dueDate).toBe('2026-09-27');
    expect(result.confidence).toBe('HIGH');
  });
});

describe('relative date extraction', () => {
  it('CASE 2: Complete by Friday with source 23 Sep 2026 → 2026-09-25', () => {
    const rel = extractRelativeDeadline('Complete by Friday', '2026-09-23');
    expect(rel?.ymd).toBe('2026-09-25');
    const result = deterministicFromText('Complete by Friday', '2026-09-23', 'HOMEWORK_TEXT', 'x');
    expect(result.dueDate).toBe('2026-09-25');
    expect(result.confidence).toBe('HIGH');
  });

  it('resolves due tomorrow from source date', () => {
    const result = deterministicFromText('Please submit tomorrow', '2026-09-23', 'HOMEWORK_TEXT', 'x');
    expect(result.dueDate).toBe('2026-09-24');
  });
});

describe('no-deadline behavior', () => {
  it('CASE 3: Revise EVS → no due date', () => {
    const result = deterministicFromText('Revise EVS', '2026-09-23', 'HOMEWORK_TEXT', 'x');
    expect(result.hasDueDate).toBe(false);
    expect(result.confidence).toBe('NONE');
  });

  it('CASE 4: Complete page 42 → no due date', () => {
    const result = deterministicFromText('Complete page 42', '2026-09-23', 'HOMEWORK_TEXT', 'x');
    expect(result.hasDueDate).toBe(false);
  });

  it('CASE 6: assigned 23 Sep with no deadline → no due date', () => {
    const result = deterministicFromText(
      "Today's homework (23/09/26) Learn the poem.",
      '2026-09-23',
      'HOMEWORK_TEXT',
      'x',
    );
    expect(result.hasDueDate).toBe(false);
  });
});

describe('ambiguous / invented dates rejected', () => {
  it('rejects Gemini output whose evidence is not in the source', () => {
    const raw: DeadlineExtractionResult = {
      hasDueDate: true,
      dueDate: '2026-09-25',
      confidence: 'HIGH',
      evidence: 'complete by 25 September',
      sourceType: 'HOMEWORK_TEXT',
      sourceId: 'x',
    };
    const checked = validateAgainstSource(raw, 'Revise EVS chapter 9', '2026-09-23');
    expect(checked.hasDueDate).toBe(false);
    expect(checked.confidence).toBe('NONE');
  });

  it('rejects an activity date that is not a completion/submission deadline', () => {
    const raw: DeadlineExtractionResult = {
      hasDueDate: true,
      dueDate: '2026-09-07',
      confidence: 'HIGH',
      evidence: 'Date - 07-09-26',
      sourceType: 'HOMEWORK_TEXT',
      sourceId: 'x',
    };
    const checked = validateAgainstSource(
      raw,
      'Activity - Talk Time Topic - My School Date - 07-09-26 Day - Monday Students to prepare 4 to 5 lines.',
      '2026-09-04',
    );
    expect(checked.hasDueDate).toBe(false);
  });

  it('MEDIUM confidence is not a canonical This Week due date', () => {
    expect(
      canonicalDueDate({
        structuredDue: null,
        extraction: {
          hasDueDate: true,
          dueDate: '2026-09-25',
          confidence: 'MEDIUM',
          evidence: 'maybe Friday',
          sourceType: 'HOMEWORK_TEXT',
          sourceId: 'x',
        },
      }),
    ).toBe('');
  });
});

describe('homework + notice matching', () => {
  it('relates EVS Revision homework to EVS completion notice', () => {
    expect(
      homeworkNoticeRelated(
        {
          sourceId: 'h1',
          subjectName: 'EVS',
          title: 'EVS Revision',
          description: 'Revise EVS',
          homeworkDate: '2026-09-23',
          sections: ['I-A'],
        },
        {
          sourceId: 'n1',
          title: 'EVS completion on 25 September',
          summary: 'EVS completion on 25 September',
          content: 'Kindly complete EVS chapter revision by 25 September.',
          publishedDate: '2026-09-23',
          classes: ['I-A'],
        },
      ),
    ).toBe(true);
  });

  it('does not attach EVS revision-paper notices to workbook-completion homework', () => {
    expect(
      homeworkNoticeRelated(
        {
          sourceId: '1309',
          subjectName: 'ENVIRONMENTAL SCIENCE',
          title: 'Workbook Completion',
          description: 'Complete all the pending pages from page no 15 to page no 38.',
          homeworkDate: '2026-09-11',
          sections: ['I-A'],
        },
        {
          sourceId: 'n-rev',
          title: 'EVS Revision paper of Ch8',
          summary: 'EVS Revision paper of Ch8 with answer key has been shared in content library.',
          content: 'Kindly note, 1. EVS Revision paper of Ch8 with answer key has been shared.',
          publishedDate: '2026-09-23',
          classes: ['I-A'],
        },
      ),
    ).toBe(false);
  });

  it('CASE 7: does not attach an unrelated EVS notice to different homework', () => {
    expect(
      homeworkNoticeRelated(
        {
          sourceId: 'h2',
          subjectName: 'EVS',
          title: 'Chapter 9. Our School',
          description: 'Read chapter 9.',
          homeworkDate: '2026-09-09',
          sections: ['I-A'],
        },
        {
          sourceId: 'n2',
          title: 'Sports day',
          summary: 'Annual sports on 25 September. Bring EVS textbook if you like.',
          content: 'Unrelated sports notice.',
          publishedDate: '2026-09-23',
          classes: ['I-A'],
        },
      ),
    ).toBe(false);
  });
});

describe('duplicate merging', () => {
  it('merges homework and notice for the same due date and subject', () => {
    const merged = mergeDeadlineItems(
      [hw({ id: 'neverskip:1', title: 'EVS Revision', submissionDate: '2026-09-25' })],
      [hw({ id: 'neverskip:n1', title: 'EVS completion', submissionDate: '2026-09-25' })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('neverskip:1');
    expect(merged[0].title.toLowerCase()).toMatch(/revision/);
    expect(merged[0].title.toLowerCase()).toMatch(/completion/);
  });
});

describe('source precedence', () => {
  it('prefers structured NeverSkip dueDate over extraction', () => {
    expect(
      canonicalDueDate({
        structuredDue: '2026-09-22',
        extraction: {
          hasDueDate: true,
          dueDate: '2026-09-25',
          confidence: 'HIGH',
          evidence: 'completion on 25 September',
          sourceType: 'HOMEWORK_TEXT',
          sourceId: 'x',
        },
      }),
    ).toBe('2026-09-22');
  });

  it('uses HIGH extraction when structured due is absent', () => {
    expect(
      canonicalDueDate({
        structuredDue: null,
        extraction: {
          hasDueDate: true,
          dueDate: '2026-09-25',
          confidence: 'HIGH',
          evidence: 'completion on 25 September',
          sourceType: 'HOMEWORK_TEXT',
          sourceId: 'x',
        },
      }),
    ).toBe('2026-09-25');
  });
});

describe('extraction caching', () => {
  it('reuses HIGH extraction when hash is unchanged', () => {
    expect(
      shouldReuseCachedExtraction(
        {
          contentHash: 'abc',
          hasDueDate: true,
          confidence: 'HIGH',
          model: DETERMINISTIC_EXTRACTOR,
        },
        'abc',
        { generate: async () => noneExtraction() },
      ),
    ).toBe(true);
  });

  it('does not reuse deterministic NONE when Gemini is available', () => {
    expect(
      shouldReuseCachedExtraction(
        {
          contentHash: 'abc',
          hasDueDate: false,
          confidence: 'NONE',
          model: DETERMINISTIC_EXTRACTOR,
        },
        'abc',
        { generate: async () => noneExtraction() },
      ),
    ).toBe(false);
  });

  it('reuses Gemini NONE when hash is unchanged', () => {
    expect(
      shouldReuseCachedExtraction(
        {
          contentHash: 'abc',
          hasDueDate: false,
          confidence: 'NONE',
          model: 'gemini-2.5-flash',
        },
        'abc',
        { generate: async () => noneExtraction() },
      ),
    ).toBe(true);
  });

  it('retries when the previous Gemini call failed', () => {
    expect(
      shouldReuseCachedExtraction(
        {
          contentHash: 'abc',
          hasDueDate: false,
          confidence: 'NONE',
          model: 'gemini-2.5-flash',
          reason: 'gemini_failed',
        },
        'abc',
        { generate: async () => noneExtraction() },
      ),
    ).toBe(false);
  });

  it('hash is stable when title, details, and related notices are unchanged', () => {
    const a = deadlineContentHash({
      entityType: 'homework',
      sourceId: '1309',
      title: 'Workbook Completion',
      body: 'Complete pending pages',
      sourceDate: '2026-09-11',
      related: [{ sourceId: 'n1', title: 'EVS', body: 'completion on 25 September' }],
    });
    const b = deadlineContentHash({
      entityType: 'homework',
      sourceId: '1309',
      title: 'Workbook Completion',
      body: 'Complete pending pages',
      sourceDate: '2026-09-11',
      related: [{ sourceId: 'n1', title: 'EVS', body: 'completion on 25 September' }],
    });
    expect(a).toBe(b);
  });

  it('hash changes when related notice content changes', () => {
    const a = deadlineContentHash({
      entityType: 'homework',
      sourceId: '1309',
      title: 'Workbook Completion',
      body: 'Complete pending pages',
      sourceDate: '2026-09-11',
    });
    const b = deadlineContentHash({
      entityType: 'homework',
      sourceId: '1309',
      title: 'Workbook Completion',
      body: 'Complete pending pages',
      sourceDate: '2026-09-11',
      related: [{ sourceId: 'n1', title: 'EVS', body: 'completion on 25 September' }],
    });
    expect(a).not.toBe(b);
  });
});

describe('This Week grouping', () => {
  it('places HIGH canonical due on Friday 25, not assigned 23 Sep', () => {
    const view = buildThisWeekView({
      today: '2026-09-23',
      section: 'I-A',
      homework: [
        hw({
          id: 'evs',
          title: 'Completion',
          sentDate: '2026-09-23',
          submissionDate: '2026-09-25',
        }),
      ],
    });
    expect(view.days.find((d) => d.date === '2026-09-23')?.count ?? 0).toBe(0);
    expect(view.days.find((d) => d.date === '2026-09-25')?.items[0].title).toBe('Completion');
    expect(view.nothingDueThisWeek).toBe(false);
  });
});

describe('timezone handling', () => {
  it('does not shift Friday 25 Sep 2026 via UTC parse', () => {
    const rel = extractRelativeDeadline('Complete by Friday', '2026-09-23');
    expect(rel?.ymd).toBe('2026-09-25');
  });
});

describe('Gemini failure fallback', () => {
  it('returns no due date when Gemini throws', async () => {
    const result = await extractDeadlineWithGemini(
      {
        entityType: 'homework',
        sourceId: 'x',
        subject: 'EVS',
        title: 'Revision',
        body: 'EVS completion on 25 September',
        sourceDate: '2026-09-23',
      },
      async () => {
        throw new Error('gemini down');
      },
    );
    expect(result).toEqual(noneExtraction('gemini_failed'));
  });

  it('accepts mocked Gemini HIGH only after source validation', async () => {
    const generate = vi.fn(async () => ({
      hasDueDate: true,
      dueDate: '2026-09-25',
      confidence: 'HIGH' as const,
      evidence: 'EVS completion on 25 September',
      sourceType: 'HOMEWORK_TEXT' as const,
      sourceId: 'x',
      reason: 'Explicit completion date stated in source',
    }));
    const result = await extractDeadlineWithGemini(
      {
        entityType: 'homework',
        sourceId: 'x',
        subject: 'EVS',
        title: 'Revision / Completion',
        body: 'EVS completion on 25 September',
        sourceDate: '2026-09-23',
      },
      generate,
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(result.dueDate).toBe('2026-09-25');
    expect(result.confidence).toBe('HIGH');
  });
});

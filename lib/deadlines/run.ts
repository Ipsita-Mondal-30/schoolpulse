/**
 * Background deadline extraction. Never called from This Week render.
 */

import { getPrisma } from '@/lib/prisma';
import { addDaysYmd, getIndiaToday } from '@/lib/daily-brief';
import { NEVERSKIP_SOURCE } from '@/lib/neverskip/types';
import { getGeminiModelId } from '@/lib/recap/ai';
import { deadlineContentHash } from '@/lib/deadlines/hash';
import {
  extractDeadlineWithGemini,
  defaultGenerateDeadline,
  type GenerateDeadlineFn,
} from '@/lib/deadlines/gemini';
import { relatedNoticesForHomework, type RelatableHomework, type RelatableNotice } from '@/lib/deadlines/relate';
import {
  highExtraction,
  noneExtraction,
  type DeadlineExtractionResult,
} from '@/lib/deadlines/schema';
import { deterministicFromText } from '@/lib/deadlines/validate';
import { isValidSchoolYmd } from '@/lib/homework-dates';
import { nsLog, nsWarn } from '@/lib/neverskip/log';

export const DETERMINISTIC_EXTRACTOR = 'deterministic';

function geminiQueuePriority(entity: 'homework' | 'notice', text: string): number {
  const hasDateCue =
    /complet(?:e|ion)\s+(on|by)|submi(?:t|ssion)|deadline|\bdue\b|friday|tomorrow|next monday|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)|[./-]\d{1,2}[./-]\d{2,4}/i.test(
      text,
    );
  if (hasDateCue) return entity === 'homework' ? 0 : 1;
  if (/complet(?:e|ion)/i.test(text)) return entity === 'homework' ? 2 : 3;
  return entity === 'homework' ? 4 : 5;
}

const GEMINI_CALL_GAP_MS = 13_000;
let lastGeminiCallAt = 0;

async function paceGeminiCall(): Promise<void> {
  const wait = lastGeminiCallAt + GEMINI_CALL_GAP_MS - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastGeminiCallAt = Date.now();
}

export function shouldReuseCachedExtraction(
  existing: {
    contentHash: string;
    hasDueDate: boolean;
    confidence: string;
    model: string | null;
    reason?: string | null;
  } | null,
  hash: string,
  options: { skipGemini?: boolean; generate?: unknown },
): boolean {
  if (!existing || existing.contentHash !== hash) return false;
  if (existing.hasDueDate && existing.confidence === 'HIGH') return true;
  if (options.skipGemini || !options.generate) return true;
  if (existing.reason === 'gemini_failed') return false;
  const geminiAlreadyRan = Boolean(existing.model && existing.model !== DETERMINISTIC_EXTRACTOR);
  return geminiAlreadyRan;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function structuredDueOf(dueDate: string | null, title: string, description: string, assigned: string): string {
  if (!dueDate || !isValidSchoolYmd(dueDate)) return '';
  const ymd = dueDate.slice(0, 10);
  const derived = deterministicFromText(`${title}\n${description}`, assigned, 'HOMEWORK_TEXT', '');
  if (derived.hasDueDate && derived.dueDate === ymd) {
    return '';
  }
  return ymd;
}

export type ExtractDeadlinesSummary = {
  processed: number;
  reused: number;
  geminiCalls: number;
  stored: number;
  errors: number;
};

export type ExtractDeadlinesOptions = {
  sinceYmd?: string;
  generate?: GenerateDeadlineFn;
  skipGemini?: boolean;
  maxGeminiCalls?: number;
};

async function upsertExtraction(input: {
  entityType: 'homework' | 'notice';
  sourceId: string;
  entityId: string;
  contentHash: string;
  result: DeadlineExtractionResult;
  sourceText: string;
  model: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const data = {
    entityId: input.entityId,
    contentHash: input.contentHash,
    hasDueDate: input.result.hasDueDate,
    dueDate: input.result.hasDueDate ? input.result.dueDate : null,
    confidence: input.result.confidence,
    evidence: input.result.evidence,
    sourceType: input.result.sourceType,
    relatedSourceId: input.result.sourceType === 'NOTICE' ? input.result.sourceId : null,
    relatedEntityType: input.result.sourceType === 'NOTICE' ? 'notice' : null,
    sourceText: input.sourceText.slice(0, 2000),
    reason: input.result.reason ?? null,
    model: input.model,
    extractedAt: new Date(),
  };
  await prisma.homeworkDeadlineExtraction.upsert({
    where: {
      entityType_source_sourceId: {
        entityType: input.entityType,
        source: NEVERSKIP_SOURCE,
        sourceId: input.sourceId,
      },
    },
    create: {
      entityType: input.entityType,
      source: NEVERSKIP_SOURCE,
      sourceId: input.sourceId,
      ...data,
    },
    update: data,
  });
}

async function extractOneHomework(
  hw: RelatableHomework & { id: string; dueDate: string | null },
  notices: RelatableNotice[],
  options: ExtractDeadlinesOptions,
  stats: ExtractDeadlinesSummary,
): Promise<void> {
  const related = relatedNoticesForHomework(hw, notices);
  const structured = structuredDueOf(hw.dueDate, hw.title, hw.description, hw.homeworkDate);
  const hash = deadlineContentHash({
    entityType: 'homework',
    sourceId: hw.sourceId,
    title: hw.title,
    body: hw.description,
    sourceDate: hw.homeworkDate,
    structuredDue: structured,
    related: related.map((n) => ({
      sourceId: n.sourceId,
      title: n.title,
      body: `${n.summary}\n${n.content}`,
    })),
  });

  const prisma = getPrisma();
  const existing = await prisma.homeworkDeadlineExtraction.findUnique({
    where: {
      entityType_source_sourceId: {
        entityType: 'homework',
        source: NEVERSKIP_SOURCE,
        sourceId: hw.sourceId,
      },
    },
  });
  if (shouldReuseCachedExtraction(existing, hash, options)) {
    stats.reused += 1;
    return;
  }

  const sourceText = [hw.title, hw.description, ...related.map((n) => `${n.title}\n${n.summary}\n${n.content}`)].join(
    '\n',
  );

  let result: DeadlineExtractionResult;
  let model: string | null = DETERMINISTIC_EXTRACTOR;

  if (structured) {
    result = highExtraction({
      dueDate: structured,
      evidence: structured,
      sourceType: 'STRUCTURED_FIELD',
      sourceId: hw.sourceId,
      reason: 'NeverSkip structured due date',
    });
  } else {
    result = deterministicFromText(
      `${hw.title}\n${hw.description}`,
      hw.homeworkDate,
      'HOMEWORK_TEXT',
      hw.sourceId,
    );
    if (!result.hasDueDate) {
      for (const n of related) {
        const fromNotice = deterministicFromText(
          `${n.title}\n${n.summary}\n${n.content}`,
          n.publishedDate || hw.homeworkDate,
          'NOTICE',
          n.sourceId,
        );
        if (fromNotice.hasDueDate && fromNotice.confidence === 'HIGH') {
          result = fromNotice;
          break;
        }
      }
    }
    if (
      !result.hasDueDate &&
      !options.skipGemini &&
      options.generate &&
      stats.geminiCalls < (options.maxGeminiCalls ?? 40)
    ) {
      stats.geminiCalls += 1;
      model = getGeminiModelId();
      await paceGeminiCall();
      result = await extractDeadlineWithGemini(
        {
          entityType: 'homework',
          sourceId: hw.sourceId,
          subject: hw.subjectName,
          title: hw.title,
          body: hw.description,
          sourceDate: hw.homeworkDate,
          relatedNotices: related.map((n) => ({
            sourceId: n.sourceId,
            title: n.title,
            body: `${n.summary}\n${n.content}`,
            publishedDate: n.publishedDate,
          })),
        },
        options.generate,
      );
    }
  }

  if (!result.hasDueDate) result = noneExtraction(result.reason ?? 'no_explicit_deadline');

  await upsertExtraction({
    entityType: 'homework',
    sourceId: hw.sourceId,
    entityId: hw.id,
    contentHash: hash,
    result,
    sourceText,
    model,
  });
  stats.stored += 1;
}

async function extractOneNotice(
  notice: RelatableNotice & { id: string },
  options: ExtractDeadlinesOptions,
  stats: ExtractDeadlinesSummary,
): Promise<void> {
  const body = `${notice.summary}\n${notice.content}`;
  const hash = deadlineContentHash({
    entityType: 'notice',
    sourceId: notice.sourceId,
    title: notice.title,
    body,
    sourceDate: notice.publishedDate,
  });
  const prisma = getPrisma();
  const existing = await prisma.homeworkDeadlineExtraction.findUnique({
    where: {
      entityType_source_sourceId: {
        entityType: 'notice',
        source: NEVERSKIP_SOURCE,
        sourceId: notice.sourceId,
      },
    },
  });
  if (shouldReuseCachedExtraction(existing, hash, options)) {
    stats.reused += 1;
    return;
  }

  let result = deterministicFromText(
    `${notice.title}\n${body}`,
    notice.publishedDate,
    'NOTICE',
    notice.sourceId,
  );
  let model: string | null = DETERMINISTIC_EXTRACTOR;
  if (
    !result.hasDueDate &&
    !options.skipGemini &&
    options.generate &&
    stats.geminiCalls < (options.maxGeminiCalls ?? 40)
  ) {
    stats.geminiCalls += 1;
    model = getGeminiModelId();
    await paceGeminiCall();
    result = await extractDeadlineWithGemini(
      {
        entityType: 'notice',
        sourceId: notice.sourceId,
        subject: notice.title,
        title: notice.title,
        body,
        sourceDate: notice.publishedDate,
      },
      options.generate,
    );
  }
  if (!result.hasDueDate) result = noneExtraction(result.reason ?? 'no_explicit_deadline');

  await upsertExtraction({
    entityType: 'notice',
    sourceId: notice.sourceId,
    entityId: notice.id,
    contentHash: hash,
    result,
    sourceText: `${notice.title}\n${body}`,
    model,
  });
  stats.stored += 1;
}

export async function extractAndStoreHomeworkDeadlines(
  options: ExtractDeadlinesOptions = {},
): Promise<ExtractDeadlinesSummary> {
  const stats: ExtractDeadlinesSummary = {
    processed: 0,
    reused: 0,
    geminiCalls: 0,
    stored: 0,
    errors: 0,
  };
  if (!process.env.DATABASE_URL) return stats;

  const today = getIndiaToday();
  const sinceYmd = options.sinceYmd || addDaysYmd(today, -90) || today;
  const noticeSince = addDaysYmd(sinceYmd, -21) || sinceYmd;
  const prisma = getPrisma();

  const homeworkRows = await prisma.importedHomework.findMany({
    where: { homeworkDate: { gte: sinceYmd } },
    orderBy: { homeworkDate: 'desc' },
    take: 120,
  });
  const noticeRows = await prisma.importedNotice.findMany({
    where: { publishedDate: { gte: noticeSince } },
    orderBy: { publishedDate: 'desc' },
    take: 80,
  });

  const notices: Array<RelatableNotice & { id: string }> = noticeRows.map((n) => ({
    id: n.id,
    sourceId: n.sourceId,
    title: n.title,
    summary: n.summary,
    content: n.content,
    publishedDate: n.publishedDate,
    classes: parseJsonArray(n.classesJson),
  }));

  const generate = options.skipGemini
    ? undefined
    : options.generate ??
      (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ? defaultGenerateDeadline : undefined);

  const opts = { ...options, generate };
  type Job =
    | {
        kind: 'homework';
        priority: number;
        hw: RelatableHomework & { id: string; dueDate: string | null };
      }
    | { kind: 'notice'; priority: number; notice: RelatableNotice & { id: string } };

  const jobs: Job[] = [
    ...homeworkRows.map((row) => {
      const hw: RelatableHomework & { id: string; dueDate: string | null } = {
        id: row.id,
        sourceId: row.sourceId,
        subjectName: row.subjectName,
        title: row.title,
        description: row.description,
        homeworkDate: row.homeworkDate,
        sections: parseJsonArray(row.sectionsJson),
        dueDate: row.dueDate,
      };
      return {
        kind: 'homework' as const,
        priority: geminiQueuePriority('homework', `${hw.title}\n${hw.description}`),
        hw,
      };
    }),
    ...notices.map((notice) => ({
      kind: 'notice' as const,
      priority: geminiQueuePriority('notice', `${notice.title}\n${notice.summary}\n${notice.content}`),
      notice,
    })),
  ];
  jobs.sort((a, b) => a.priority - b.priority);

  for (const job of jobs) {
    stats.processed += 1;
    try {
      if (job.kind === 'homework') {
        await extractOneHomework(job.hw, notices, opts, stats);
      } else {
        await extractOneNotice(job.notice, opts, stats);
      }
    } catch (err) {
      stats.errors += 1;
      const id = job.kind === 'homework' ? job.hw.sourceId : job.notice.sourceId;
      nsWarn(`Deadline extract ${job.kind} ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  nsLog(
    `Deadline extraction: processed=${stats.processed} reused=${stats.reused} stored=${stats.stored} gemini=${stats.geminiCalls} errors=${stats.errors}`,
  );
  return stats;
}

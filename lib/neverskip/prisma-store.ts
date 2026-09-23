import { getPrisma } from '@/lib/prisma';
import {
  defaultClass1Audience,
  isLegacyDefaultHomeworkAudience,
} from '@/lib/class-sections';
import {
  getMeaningfulHomeworkChanges,
  getMeaningfulNoticeChanges,
  homeworkSnapshot,
  isNoiseChangeEvent,
  noticeSnapshot,
  parentRelevantChanges,
  serializeFieldChanges,
} from './changes';
import {
  homeworkContentKey,
  jolContentKey,
  noticeContentKey,
  scheduleEventContentKey,
  type NeverSkipStore,
} from './store';
import type {
  NormalizedHomework,
  NormalizedJolItem,
  NormalizedNotice,
  NormalizedScheduleEvent,
  UpsertResult,
} from './types';
import { NEVERSKIP_SOURCE } from './types';

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function isLegacyHomeworkAudienceExpansion(previous: string[], next: string[]): boolean {
  if (!isLegacyDefaultHomeworkAudience(previous)) return false;
  const expected = defaultClass1Audience();
  if (next.length !== expected.length) return false;
  return next.every((sec, i) => sec === expected[i]);
}

export class PrismaNeverSkipStore implements NeverSkipStore {
  async upsertHomework(item: NormalizedHomework): Promise<UpsertResult> {
    const prisma = getPrisma();
    const existing = await prisma.importedHomework.findUnique({
      where: {
        source_sourceId: { source: item.source, sourceId: item.sourceId },
      },
    });

    const sectionsJson = JSON.stringify(item.sections);

    if (!existing) {
      await prisma.importedHomework.create({
        data: {
          source: item.source,
          sourceId: item.sourceId,
          refId: item.refId,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          title: item.title,
          description: item.description,
          sectionsJson,
          homeworkDate: item.homeworkDate,
          dueDate: item.dueDate,
          attachmentUrl: item.attachmentUrl,
        },
      });
      return 'inserted';
    }

    const existingNorm: NormalizedHomework = {
      source: existing.source as NormalizedHomework['source'],
      sourceId: existing.sourceId,
      refId: existing.refId,
      subjectId: existing.subjectId,
      subjectName: existing.subjectName,
      title: existing.title,
      description: existing.description,
      sections: parseJsonArray(existing.sectionsJson),
      homeworkDate: existing.homeworkDate,
      dueDate: existing.dueDate,
      attachmentUrl: existing.attachmentUrl,
    };

    if (homeworkContentKey(existingNorm) === homeworkContentKey(item)) {
      return 'unchanged';
    }

    const diffs = getMeaningfulHomeworkChanges(existingNorm, item);
    const parentDiffs = parentRelevantChanges('homework', diffs);
    const skipAudienceNoise =
      diffs.length === 1 &&
      diffs[0].field === 'sections' &&
      isLegacyHomeworkAudienceExpansion(existingNorm.sections, item.sections);
    if (
      parentDiffs.length > 0 &&
      !skipAudienceNoise &&
      !isNoiseChangeEvent('homework', diffs)
    ) {
      await prisma.contentChangeEvent.create({
        data: {
          entityType: 'homework',
          source: item.source,
          sourceId: item.sourceId,
          entityId: existing.id,
          changedFieldsJson: serializeFieldChanges(parentDiffs),
          previousSnapshotJson: JSON.stringify(homeworkSnapshot(existingNorm)),
          currentSnapshotJson: JSON.stringify(homeworkSnapshot(item)),
        },
      });
    }

    await prisma.importedHomework.update({
      where: { id: existing.id },
      data: {
        refId: item.refId,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        title: item.title,
        description: item.description,
        sectionsJson,
        homeworkDate: item.homeworkDate,
        dueDate: item.dueDate,
        attachmentUrl: item.attachmentUrl,
      },
    });
    return 'updated';
  }

  async listHomework(): Promise<NormalizedHomework[]> {
    const rows = await getPrisma().importedHomework.findMany({
      orderBy: [{ homeworkDate: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => ({
      source: r.source as NormalizedHomework['source'],
      sourceId: r.sourceId,
      refId: r.refId,
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      title: r.title,
      description: r.description,
      sections: parseJsonArray(r.sectionsJson),
      homeworkDate: r.homeworkDate,
      dueDate: r.dueDate,
      attachmentUrl: r.attachmentUrl,
    }));
  }

  async hasHomework(source: string, sourceId: string): Promise<boolean> {
    const row = await getPrisma().importedHomework.findUnique({
      where: { source_sourceId: { source, sourceId } },
      select: { id: true },
    });
    return !!row;
  }

  async upsertNotice(item: NormalizedNotice): Promise<UpsertResult> {
    const prisma = getPrisma();
    let existing = await prisma.importedNotice.findUnique({
      where: {
        source_sourceId: { source: item.source, sourceId: item.sourceId },
      },
    });

    // Legacy rows hashed date|time|title|content with blank dates — match by content to update in place.
    if (!existing && item.content.trim()) {
      const candidates = await prisma.importedNotice.findMany({
        where: { source: item.source, content: item.content },
        take: 5,
      });
      if (candidates.length === 1) {
        existing = candidates[0];
      } else if (candidates.length > 1) {
        existing =
          candidates.find((c) => !c.publishedDate?.trim()) ??
          candidates.find((c) => c.title === item.title) ??
          candidates[0];
      }
    }

    const classesJson = JSON.stringify(item.classes);

    if (!existing) {
      await prisma.importedNotice.create({
        data: {
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          summary: item.summary,
          content: item.content,
          publishedDate: item.publishedDate,
          publishedTime: item.publishedTime,
          classesJson,
          imageUrl: item.imageUrl,
        },
      });
      return 'inserted';
    }

    const existingNorm: NormalizedNotice = {
      source: existing.source as NormalizedNotice['source'],
      sourceId: existing.sourceId,
      title: existing.title,
      summary: existing.summary,
      content: existing.content,
      publishedDate: existing.publishedDate,
      publishedTime: existing.publishedTime,
      classes: parseJsonArray(existing.classesJson),
      imageUrl: existing.imageUrl,
    };

    if (
      noticeContentKey(existingNorm) === noticeContentKey(item) &&
      existing.sourceId === item.sourceId
    ) {
      return 'unchanged';
    }

    const diffs = getMeaningfulNoticeChanges(existingNorm, item);
    const parentDiffs = parentRelevantChanges('notice', diffs);
    if (parentDiffs.length > 0 && !isNoiseChangeEvent('notice', diffs)) {
      await prisma.contentChangeEvent.create({
        data: {
          entityType: 'notice',
          source: item.source,
          sourceId: item.sourceId,
          entityId: existing.id,
          changedFieldsJson: serializeFieldChanges(parentDiffs),
          previousSnapshotJson: JSON.stringify(noticeSnapshot(existingNorm)),
          currentSnapshotJson: JSON.stringify(noticeSnapshot(item)),
        },
      });
    }

    await prisma.importedNotice.update({
      where: { id: existing.id },
      data: {
        sourceId: item.sourceId,
        title: item.title,
        summary: item.summary,
        content: item.content,
        publishedDate: item.publishedDate,
        publishedTime: item.publishedTime,
        classesJson,
        imageUrl: item.imageUrl,
      },
    });
    return 'updated';
  }

  async listNotices(): Promise<NormalizedNotice[]> {
    const rows = await getPrisma().importedNotice.findMany({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
    });
    return rows.map((r) => ({
      source: r.source as NormalizedNotice['source'],
      sourceId: r.sourceId,
      title: r.title,
      summary: r.summary,
      content: r.content,
      publishedDate: r.publishedDate,
      publishedTime: r.publishedTime,
      classes: parseJsonArray(r.classesJson),
      imageUrl: r.imageUrl,
    }));
  }

  async hasNotice(source: string, sourceId: string): Promise<boolean> {
    const row = await getPrisma().importedNotice.findUnique({
      where: { source_sourceId: { source, sourceId } },
      select: { id: true },
    });
    return !!row;
  }

  async upsertJolItem(item: NormalizedJolItem): Promise<UpsertResult> {
    const prisma = getPrisma();
    const existing = await prisma.importedJolItem.findUnique({
      where: {
        source_sourceId: { source: item.source, sourceId: item.sourceId },
      },
    });
    const sectionsJson = JSON.stringify(item.sections);

    if (!existing) {
      await prisma.importedJolItem.create({
        data: {
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          description: item.description,
          content: item.content,
          activityDate: item.activityDate,
          publishedDate: item.publishedDate,
          publishedTime: item.publishedTime,
          resourceType: item.resourceType,
          resourceUrl: item.resourceUrl,
          downloadUrl: item.downloadUrl,
          thumbnailUrl: item.thumbnailUrl,
          subjectName: item.subjectName,
          sectionsJson,
          jolRelated: item.jolRelated,
          scheduleDocument: item.scheduleDocument,
          metadataJson: item.metadataJson,
        },
      });
      return 'inserted';
    }

    const existingNorm: NormalizedJolItem = {
      source: existing.source as NormalizedJolItem['source'],
      sourceId: existing.sourceId,
      title: existing.title,
      description: existing.description,
      content: existing.content,
      activityDate: existing.activityDate,
      publishedDate: existing.publishedDate,
      publishedTime: existing.publishedTime,
      resourceType: existing.resourceType,
      resourceUrl: existing.resourceUrl,
      downloadUrl: existing.downloadUrl,
      thumbnailUrl: existing.thumbnailUrl,
      subjectName: existing.subjectName,
      sections: parseJsonArray(existing.sectionsJson),
      jolRelated: existing.jolRelated,
      scheduleDocument: existing.scheduleDocument,
      metadataJson: existing.metadataJson,
    };

    if (jolContentKey(existingNorm) === jolContentKey(item)) {
      return 'unchanged';
    }

    await prisma.contentChangeEvent.create({
      data: {
        entityType: 'jol',
        source: item.source,
        sourceId: item.sourceId,
        entityId: existing.id,
        changedFieldsJson: JSON.stringify([
          { field: 'content', label: 'Content library item', previous: existing.title, current: item.title, reliable: true },
        ]),
        previousSnapshotJson: JSON.stringify(existingNorm),
        currentSnapshotJson: JSON.stringify(item),
      },
    });

    await prisma.importedJolItem.update({
      where: { id: existing.id },
      data: {
        title: item.title,
        description: item.description,
        content: item.content,
        activityDate: item.activityDate,
        publishedDate: item.publishedDate,
        publishedTime: item.publishedTime,
        resourceType: item.resourceType,
        resourceUrl: item.resourceUrl,
        downloadUrl: item.downloadUrl,
        thumbnailUrl: item.thumbnailUrl,
        subjectName: item.subjectName,
        sectionsJson,
        jolRelated: item.jolRelated,
        scheduleDocument: item.scheduleDocument,
        metadataJson: item.metadataJson,
      },
    });
    return 'updated';
  }

  async listJolItems(): Promise<NormalizedJolItem[]> {
    const rows = await getPrisma().importedJolItem.findMany({
      orderBy: [{ publishedDate: 'desc' }, { publishedTime: 'desc' }],
    });
    return rows.map((r) => ({
      source: r.source as NormalizedJolItem['source'],
      sourceId: r.sourceId,
      title: r.title,
      description: r.description,
      content: r.content,
      activityDate: r.activityDate,
      publishedDate: r.publishedDate,
      publishedTime: r.publishedTime,
      resourceType: r.resourceType,
      resourceUrl: r.resourceUrl,
      downloadUrl: r.downloadUrl,
      thumbnailUrl: r.thumbnailUrl,
      subjectName: r.subjectName,
      sections: parseJsonArray(r.sectionsJson),
      jolRelated: r.jolRelated,
      scheduleDocument: r.scheduleDocument,
      metadataJson: r.metadataJson,
    }));
  }

  async replaceScheduleEvents(
    events: NormalizedScheduleEvent[],
  ): Promise<{ inserted: number; updated: number; removed: number }> {
    const prisma = getPrisma();
    const existing = await prisma.importedScheduleEvent.findMany({
      where: { source: NEVERSKIP_SOURCE },
    });
    const existingById = new Map(existing.map((e) => [e.sourceId, e]));
    const incomingIds = new Set(events.map((e) => e.sourceId));
    let inserted = 0;
    let updated = 0;
    let removed = 0;

    for (const item of events) {
      const prev = existingById.get(item.sourceId);
      if (!prev) {
        await prisma.importedScheduleEvent.create({
          data: {
            source: item.source,
            sourceId: item.sourceId,
            title: item.title,
            description: item.description,
            eventDate: item.eventDate,
            startTime: item.startTime,
            endTime: item.endTime,
            weekday: item.weekday,
            subjectName: item.subjectName,
            periodLabel: item.periodLabel,
            classSection: item.classSection,
            resourceUrl: item.resourceUrl,
            metadataJson: item.metadataJson,
          },
        });
        inserted += 1;
        continue;
      }
      const prevNorm: NormalizedScheduleEvent = {
        source: prev.source as NormalizedScheduleEvent['source'],
        sourceId: prev.sourceId,
        title: prev.title,
        description: prev.description,
        eventDate: prev.eventDate,
        startTime: prev.startTime,
        endTime: prev.endTime,
        weekday: prev.weekday,
        subjectName: prev.subjectName,
        periodLabel: prev.periodLabel,
        classSection: prev.classSection,
        resourceUrl: prev.resourceUrl,
        metadataJson: prev.metadataJson,
      };
      if (scheduleEventContentKey(prevNorm) === scheduleEventContentKey(item)) continue;
      await prisma.importedScheduleEvent.update({
        where: { id: prev.id },
        data: {
          title: item.title,
          description: item.description,
          eventDate: item.eventDate,
          startTime: item.startTime,
          endTime: item.endTime,
          weekday: item.weekday,
          subjectName: item.subjectName,
          periodLabel: item.periodLabel,
          classSection: item.classSection,
          resourceUrl: item.resourceUrl,
          metadataJson: item.metadataJson,
        },
      });
      updated += 1;
    }

    for (const row of existing) {
      if (incomingIds.has(row.sourceId)) continue;
      await prisma.importedScheduleEvent.delete({ where: { id: row.id } });
      removed += 1;
    }

    return { inserted, updated, removed };
  }

  async listScheduleEvents(): Promise<NormalizedScheduleEvent[]> {
    const rows = await getPrisma().importedScheduleEvent.findMany({
      orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((r) => ({
      source: r.source as NormalizedScheduleEvent['source'],
      sourceId: r.sourceId,
      title: r.title,
      description: r.description,
      eventDate: r.eventDate,
      startTime: r.startTime,
      endTime: r.endTime,
      weekday: r.weekday,
      subjectName: r.subjectName,
      periodLabel: r.periodLabel,
      classSection: r.classSection,
      resourceUrl: r.resourceUrl,
      metadataJson: r.metadataJson,
    }));
  }

  async recordSyncRun(run: {
    status: string;
    startedAt: Date;
    finishedAt: Date;
    homeworkExpected?: number | null;
    homeworkFetched?: number;
    noticeFetched?: number;
    jolFetched?: number;
    scheduleFetched?: number;
    errorSummary?: string;
    reportJson?: string;
  }): Promise<void> {
    await getPrisma().syncRun.create({
      data: {
        source: NEVERSKIP_SOURCE,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        homeworkExpected: run.homeworkExpected ?? null,
        homeworkFetched: run.homeworkFetched ?? null,
        noticeFetched: run.noticeFetched ?? null,
        jolFetched: run.jolFetched ?? null,
        scheduleFetched: run.scheduleFetched ?? null,
        errorSummary: (run.errorSummary ?? '').slice(0, 2000),
        reportJson: run.reportJson ?? '{}',
      },
    });
  }
}

import { getPrisma } from '@/lib/prisma';
import {
  getMeaningfulHomeworkChanges,
  getMeaningfulNoticeChanges,
  homeworkSnapshot,
  noticeSnapshot,
  serializeFieldChanges,
} from './changes';
import {
  homeworkContentKey,
  noticeContentKey,
  type NeverSkipStore,
} from './store';
import type { NormalizedHomework, NormalizedNotice, UpsertResult } from './types';

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
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
    if (diffs.length > 0) {
      await prisma.contentChangeEvent.create({
        data: {
          entityType: 'homework',
          source: item.source,
          sourceId: item.sourceId,
          entityId: existing.id,
          changedFieldsJson: serializeFieldChanges(diffs),
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
    const existing = await prisma.importedNotice.findUnique({
      where: {
        source_sourceId: { source: item.source, sourceId: item.sourceId },
      },
    });

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

    if (noticeContentKey(existingNorm) === noticeContentKey(item)) {
      return 'unchanged';
    }

    const diffs = getMeaningfulNoticeChanges(existingNorm, item);
    if (diffs.length > 0) {
      await prisma.contentChangeEvent.create({
        data: {
          entityType: 'notice',
          source: item.source,
          sourceId: item.sourceId,
          entityId: existing.id,
          changedFieldsJson: serializeFieldChanges(diffs),
          previousSnapshotJson: JSON.stringify(noticeSnapshot(existingNorm)),
          currentSnapshotJson: JSON.stringify(noticeSnapshot(item)),
        },
      });
    }

    await prisma.importedNotice.update({
      where: { id: existing.id },
      data: {
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
}

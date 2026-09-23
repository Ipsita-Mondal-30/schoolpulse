import type {
  NormalizedHomework,
  NormalizedJolItem,
  NormalizedNotice,
  NormalizedScheduleEvent,
  UpsertResult,
} from './types';
import { collapseText, normalizeAttachmentUrlForCompare } from './changes';

export interface NeverSkipStore {
  upsertHomework(item: NormalizedHomework): Promise<UpsertResult>;
  listHomework(): Promise<NormalizedHomework[]>;
  hasHomework(source: string, sourceId: string): Promise<boolean>;

  upsertNotice(item: NormalizedNotice): Promise<UpsertResult>;
  listNotices(): Promise<NormalizedNotice[]>;
  hasNotice(source: string, sourceId: string): Promise<boolean>;

  upsertJolItem(item: NormalizedJolItem): Promise<UpsertResult>;
  listJolItems(): Promise<NormalizedJolItem[]>;

  /**
   * Replace all NeverSkip schedule events with the provided set.
   * Call ONLY when calendar fetch completed successfully (including empty).
   */
  replaceScheduleEvents(events: NormalizedScheduleEvent[]): Promise<{
    inserted: number;
    updated: number;
    removed: number;
  }>;
  listScheduleEvents(): Promise<NormalizedScheduleEvent[]>;

  recordSyncRun(run: {
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
  }): Promise<void>;
}

export function homeworkContentKey(item: NormalizedHomework): string {
  return JSON.stringify({
    refId: item.refId,
    subjectId: item.subjectId,
    subjectName: collapseText(item.subjectName).toLowerCase(),
    title: collapseText(item.title).toLowerCase(),
    description: collapseText(item.description).toLowerCase(),
    sections: [...item.sections].map(String).sort(),
    homeworkDate: item.homeworkDate,
    dueDate: item.dueDate,
    attachmentUrl: normalizeAttachmentUrlForCompare(item.attachmentUrl),
  });
}

export function noticeContentKey(item: NormalizedNotice): string {
  return JSON.stringify({
    title: item.title,
    summary: item.summary,
    content: item.content,
    publishedDate: item.publishedDate,
    publishedTime: item.publishedTime,
    classes: [...item.classes].map(String).sort(),
    imageUrl: item.imageUrl,
  });
}

export function jolContentKey(item: NormalizedJolItem): string {
  return JSON.stringify({
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
    sections: item.sections,
    jolRelated: item.jolRelated,
    scheduleDocument: item.scheduleDocument,
    metadataJson: item.metadataJson,
  });
}

export function scheduleEventContentKey(item: NormalizedScheduleEvent): string {
  return JSON.stringify({
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
  });
}

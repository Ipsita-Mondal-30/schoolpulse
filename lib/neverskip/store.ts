import type { NormalizedHomework, NormalizedNotice, UpsertResult } from './types';

export interface NeverSkipStore {
  upsertHomework(item: NormalizedHomework): Promise<UpsertResult>;
  listHomework(): Promise<NormalizedHomework[]>;
  hasHomework(source: string, sourceId: string): Promise<boolean>;

  upsertNotice(item: NormalizedNotice): Promise<UpsertResult>;
  listNotices(): Promise<NormalizedNotice[]>;
  hasNotice(source: string, sourceId: string): Promise<boolean>;
}

export function homeworkContentKey(item: NormalizedHomework): string {
  return JSON.stringify({
    refId: item.refId,
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    title: item.title,
    description: item.description,
    sections: item.sections,
    homeworkDate: item.homeworkDate,
    dueDate: item.dueDate,
    attachmentUrl: item.attachmentUrl,
  });
}

export function noticeContentKey(item: NormalizedNotice): string {
  return JSON.stringify({
    title: item.title,
    summary: item.summary,
    content: item.content,
    publishedDate: item.publishedDate,
    publishedTime: item.publishedTime,
    classes: item.classes,
    imageUrl: item.imageUrl,
  });
}

import {
  homeworkContentKey,
  noticeContentKey,
  type NeverSkipStore,
} from './store';
import type { NormalizedHomework, NormalizedNotice, UpsertResult } from './types';

export class InMemoryNeverSkipStore implements NeverSkipStore {
  private homework = new Map<string, NormalizedHomework>();
  private notices = new Map<string, NormalizedNotice>();

  private hwKey(source: string, sourceId: string) {
    return `${source}::${sourceId}`;
  }

  async upsertHomework(item: NormalizedHomework): Promise<UpsertResult> {
    const key = this.hwKey(item.source, item.sourceId);
    const existing = this.homework.get(key);
    if (!existing) {
      this.homework.set(key, { ...item, sections: [...item.sections] });
      return 'inserted';
    }
    if (homeworkContentKey(existing) === homeworkContentKey(item)) {
      return 'unchanged';
    }
    this.homework.set(key, { ...item, sections: [...item.sections] });
    return 'updated';
  }

  async listHomework(): Promise<NormalizedHomework[]> {
    return Array.from(this.homework.values()).map((h) => ({
      ...h,
      sections: [...h.sections],
    }));
  }

  async hasHomework(source: string, sourceId: string): Promise<boolean> {
    return this.homework.has(this.hwKey(source, sourceId));
  }

  async upsertNotice(item: NormalizedNotice): Promise<UpsertResult> {
    const key = this.hwKey(item.source, item.sourceId);
    const existing = this.notices.get(key);
    if (!existing) {
      this.notices.set(key, { ...item, classes: [...item.classes] });
      return 'inserted';
    }
    if (noticeContentKey(existing) === noticeContentKey(item)) {
      return 'unchanged';
    }
    this.notices.set(key, { ...item, classes: [...item.classes] });
    return 'updated';
  }

  async listNotices(): Promise<NormalizedNotice[]> {
    return Array.from(this.notices.values()).map((n) => ({
      ...n,
      classes: [...n.classes],
    }));
  }

  async hasNotice(source: string, sourceId: string): Promise<boolean> {
    return this.notices.has(this.hwKey(source, sourceId));
  }
}

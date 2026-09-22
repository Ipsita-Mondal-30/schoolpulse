import {
  getMeaningfulHomeworkChanges,
  getMeaningfulNoticeChanges,
  homeworkSnapshot,
  noticeSnapshot,
  serializeFieldChanges,
  type ChangeEntityType,
  type FieldChange,
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

export interface InMemoryChangeEvent {
  id: string;
  entityType: ChangeEntityType;
  source: string;
  sourceId: string;
  entityId: string;
  changedFields: FieldChange[];
  previousSnapshotJson: string;
  currentSnapshotJson: string;
  detectedAt: Date;
}

export class InMemoryNeverSkipStore implements NeverSkipStore {
  private homework = new Map<string, NormalizedHomework & { _id: string }>();
  private notices = new Map<string, NormalizedNotice & { _id: string }>();
  private jolItems = new Map<string, NormalizedJolItem & { _id: string }>();
  private scheduleEvents = new Map<string, NormalizedScheduleEvent & { _id: string }>();
  private syncRuns: Array<Record<string, unknown>> = [];
  private changes: InMemoryChangeEvent[] = [];
  private seq = 0;

  private hwKey(source: string, sourceId: string) {
    return `${source}::${sourceId}`;
  }

  private nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  /** Test helper: recorded change events (newest last). */
  listChangeEvents(): InMemoryChangeEvent[] {
    return [...this.changes];
  }

  clearChangeEvents() {
    this.changes = [];
  }

  async upsertHomework(item: NormalizedHomework): Promise<UpsertResult> {
    const key = this.hwKey(item.source, item.sourceId);
    const existing = this.homework.get(key);
    if (!existing) {
      this.homework.set(key, {
        ...item,
        sections: [...item.sections],
        _id: this.nextId('hw'),
      });
      return 'inserted';
    }
    if (homeworkContentKey(existing) === homeworkContentKey(item)) {
      return 'unchanged';
    }

    const diffs = getMeaningfulHomeworkChanges(existing, item);
    if (diffs.length > 0) {
      this.changes.push({
        id: this.nextId('chg'),
        entityType: 'homework',
        source: item.source,
        sourceId: item.sourceId,
        entityId: existing._id,
        changedFields: diffs,
        previousSnapshotJson: JSON.stringify(homeworkSnapshot(existing)),
        currentSnapshotJson: JSON.stringify(homeworkSnapshot(item)),
        detectedAt: new Date(),
      });
    }

    this.homework.set(key, {
      ...item,
      sections: [...item.sections],
      _id: existing._id,
    });
    return 'updated';
  }

  async listHomework(): Promise<NormalizedHomework[]> {
    return Array.from(this.homework.values()).map((h) => {
      const { _id: _, ...rest } = h;
      return { ...rest, sections: [...rest.sections] };
    });
  }

  async hasHomework(source: string, sourceId: string): Promise<boolean> {
    return this.homework.has(this.hwKey(source, sourceId));
  }

  async upsertNotice(item: NormalizedNotice): Promise<UpsertResult> {
    const key = this.hwKey(item.source, item.sourceId);
    const existing = this.notices.get(key);
    if (!existing) {
      this.notices.set(key, {
        ...item,
        classes: [...item.classes],
        _id: this.nextId('nt'),
      });
      return 'inserted';
    }
    if (noticeContentKey(existing) === noticeContentKey(item)) {
      return 'unchanged';
    }

    const diffs = getMeaningfulNoticeChanges(existing, item);
    if (diffs.length > 0) {
      this.changes.push({
        id: this.nextId('chg'),
        entityType: 'notice',
        source: item.source,
        sourceId: item.sourceId,
        entityId: existing._id,
        changedFields: diffs,
        previousSnapshotJson: JSON.stringify(noticeSnapshot(existing)),
        currentSnapshotJson: JSON.stringify(noticeSnapshot(item)),
        detectedAt: new Date(),
      });
    }

    this.notices.set(key, {
      ...item,
      classes: [...item.classes],
      _id: existing._id,
    });
    return 'updated';
  }

  async listNotices(): Promise<NormalizedNotice[]> {
    return Array.from(this.notices.values()).map((n) => {
      const { _id: _, ...rest } = n;
      return { ...rest, classes: [...rest.classes] };
    });
  }

  async hasNotice(source: string, sourceId: string): Promise<boolean> {
    return this.notices.has(this.hwKey(source, sourceId));
  }

  async upsertJolItem(item: NormalizedJolItem): Promise<UpsertResult> {
    const key = this.hwKey(item.source, item.sourceId);
    const existing = this.jolItems.get(key);
    if (!existing) {
      this.jolItems.set(key, {
        ...item,
        sections: [...item.sections],
        _id: this.nextId('jol'),
      });
      return 'inserted';
    }
    if (jolContentKey(existing) === jolContentKey(item)) {
      return 'unchanged';
    }
    this.jolItems.set(key, {
      ...item,
      sections: [...item.sections],
      _id: existing._id,
    });
    return 'updated';
  }

  async listJolItems(): Promise<NormalizedJolItem[]> {
    return Array.from(this.jolItems.values()).map((j) => {
      const { _id: _, ...rest } = j;
      return { ...rest, sections: [...rest.sections] };
    });
  }

  async replaceScheduleEvents(
    events: NormalizedScheduleEvent[],
  ): Promise<{ inserted: number; updated: number; removed: number }> {
    const incoming = new Set(events.map((e) => this.hwKey(e.source, e.sourceId)));
    let inserted = 0;
    let updated = 0;
    let removed = 0;
    for (const [key, prev] of this.scheduleEvents) {
      if (!incoming.has(key)) {
        this.scheduleEvents.delete(key);
        removed += 1;
      } else {
        void prev;
      }
    }
    for (const item of events) {
      const key = this.hwKey(item.source, item.sourceId);
      const existing = this.scheduleEvents.get(key);
      if (!existing) {
        this.scheduleEvents.set(key, { ...item, _id: this.nextId('sched') });
        inserted += 1;
        continue;
      }
      if (scheduleEventContentKey(existing) === scheduleEventContentKey(item)) continue;
      this.scheduleEvents.set(key, { ...item, _id: existing._id });
      updated += 1;
    }
    return { inserted, updated, removed };
  }

  async listScheduleEvents(): Promise<NormalizedScheduleEvent[]> {
    return Array.from(this.scheduleEvents.values()).map((e) => {
      const { _id: _, ...rest } = e;
      return { ...rest };
    });
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
    this.syncRuns.push({ ...run });
  }

  getSyncRuns() {
    return [...this.syncRuns];
  }
}

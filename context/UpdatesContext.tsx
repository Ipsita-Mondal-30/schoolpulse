'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { filterHomeworkBySection } from '@/lib/ui-merge';
import { getIndiaToday, hasReliableDueDate, isOverdue, isDueToday } from '@/lib/daily-brief';
import { useHomeworkQuery } from '@/lib/queries/homework';
import { useChangesQuery } from '@/lib/queries/changes';
import { useNoticesQuery } from '@/lib/queries/notices';
import {
  isNewerThan,
  noticePublishedIso,
  readLastSeenIso,
  readNoticeIds,
} from '@/lib/updates-unread';

const PINNED_SECTION_KEY = 'schoolpulse_pinned_section';
const DEFAULT_SECTION = 'I-A';

interface UpdatesContextType {
  homeworkCount: number;
  updatesCount: number;
  loading: boolean;
  updates: never[];
  refreshUpdates: () => Promise<void>;
}

const UpdatesContext = createContext<UpdatesContextType | undefined>(undefined);

export function UpdatesProvider({ children }: { children: ReactNode }) {
  const { data: homeworkData, isPending: hwPending } = useHomeworkQuery();
  const { data: changesData, isPending: chPending } = useChangesQuery();
  const { data: noticesData, isPending: ntPending } = useNoticesQuery();
  const [section, setSection] = useState(DEFAULT_SECTION);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [today, setToday] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(PINNED_SECTION_KEY);
    if (saved) setSection(saved);
    setLastSeen(readLastSeenIso());
    setReadIds(readNoticeIds());
    setToday(getIndiaToday());
  }, []);

  const homeworkCount = useMemo(() => {
    if (!today) return 0;
    const items = filterHomeworkBySection(homeworkData?.items ?? [], section);
    return items.filter((hw) => {
      if (!hasReliableDueDate(hw.submissionDate)) return false;
      return isDueToday(hw.submissionDate, today) || isOverdue(hw.submissionDate, today);
    }).length;
  }, [homeworkData, section, today]);

  const updatesCount = useMemo(() => {
    const changes = (changesData ?? []).filter((item) => isNewerThan(item.detectedAt, lastSeen));
    const notices = (noticesData ?? []).filter((n) => {
      if (readIds.includes(n.id)) return false;
      const published = noticePublishedIso(n.date, n.time);
      return published ? isNewerThan(published, lastSeen) : false;
    });
    return changes.length + notices.length;
  }, [changesData, noticesData, lastSeen, readIds]);

  const value = useMemo(
    () => ({
      homeworkCount,
      updatesCount,
      loading: hwPending || chPending || ntPending,
      updates: [],
      refreshUpdates: async () => undefined,
    }),
    [homeworkCount, updatesCount, hwPending, chPending, ntPending],
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates() {
  const ctx = useContext(UpdatesContext);
  if (!ctx) {
    throw new Error('useUpdates must be used within UpdatesProvider');
  }
  return ctx;
}

'use client';

import { useMemo } from 'react';
import { getIndiaToday } from '@/lib/daily-brief';
import { buildThisWeekView, type ThisWeekView } from '@/lib/this-week';
import { useHomeworkQuery } from '@/lib/queries/homework';

/** Logical key for docs/tests. UI composes from ['homework'] cache. */
export const thisWeekQueryKey = ['homework', 'week'] as const;

export type UseThisWeekQueryOptions = {
  section?: string;
  today?: string;
};

/**
 * Reuses ['homework'] so Dashboard ↔ This Week ↔ Homework share cache.
 */
export function useThisWeekQuery(options: UseThisWeekQueryOptions = {}) {
  const section = options.section || 'I-A';
  const today = options.today || getIndiaToday();
  const homeworkQuery = useHomeworkQuery();

  const data: ThisWeekView | undefined = useMemo(() => {
    if (!homeworkQuery.data) return undefined;
    return buildThisWeekView({
      homework: homeworkQuery.data.items,
      today,
      section,
    });
  }, [homeworkQuery.data, today, section]);

  return {
    data,
    isPending: homeworkQuery.isPending,
    isError: homeworkQuery.isError,
    error: homeworkQuery.error,
    refetch: homeworkQuery.refetch,
    queryKey: [...thisWeekQueryKey, section, today] as const,
  };
}

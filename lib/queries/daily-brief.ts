'use client';

import { useMemo } from 'react';
import {
  addDaysYmd,
  buildDailyBrief,
  getIndiaToday,
  type DailyBrief,
} from '@/lib/daily-brief';
import { loadDailyBriefForUi } from '@/app/actions';
import { useHomeworkQuery } from '@/lib/queries/homework';
import { useNoticesQuery } from '@/lib/queries/notices';
import { getAllImportantDates } from '@/lib/data';

/** Logical dashboard key (docs/tests). UI composes from homework + notices cache. */
export const dailyBriefQueryKey = ['dashboard', 'today'] as const;

export async function fetchDailyBriefForUi(options?: {
  today?: string;
  section?: string;
}): Promise<DailyBrief> {
  return loadDailyBriefForUi(options);
}

export type UseDailyBriefQueryOptions = {
  section?: string;
  today?: string;
};

/**
 * Reuses ['homework'] and ['notices'] so navigating home ↔ homework ↔ notices
 * does not refetch the same datasets within staleTime.
 */
export function useDailyBriefQuery(options: UseDailyBriefQueryOptions = {}) {
  const section = options.section || 'I-A';
  const today = options.today || getIndiaToday();
  const homeworkQuery = useHomeworkQuery();
  const noticesQuery = useNoticesQuery();

  const data = useMemo(() => {
    if (!homeworkQuery.data || !noticesQuery.data) return undefined;

    const tomorrow = addDaysYmd(today, 1);
    const calendarItems = getAllImportantDates()
      .filter((e) => e.date === today || e.date === tomorrow)
      .map((e) => ({
        date: e.date,
        event: e.event,
        description: e.description,
      }));

    return buildDailyBrief({
      homework: homeworkQuery.data.items,
      notices: noticesQuery.data,
      today,
      section,
      calendarItems,
    });
  }, [homeworkQuery.data, noticesQuery.data, today, section]);

  return {
    data,
    isPending: homeworkQuery.isPending || noticesQuery.isPending,
    isError: homeworkQuery.isError || noticesQuery.isError,
    error: homeworkQuery.error || noticesQuery.error,
    refetch: async () => {
      await Promise.all([homeworkQuery.refetch(), noticesQuery.refetch()]);
    },
    queryKey: [...dailyBriefQueryKey, section, today] as const,
  };
}

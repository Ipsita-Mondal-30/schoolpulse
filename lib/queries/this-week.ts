'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadThisWeekNoticeDeadlines } from '@/app/actions';
import { getIndiaToday } from '@/lib/daily-brief';
import { mergeDeadlineItems } from '@/lib/deadlines/merge';
import { buildThisWeekView, type ThisWeekView } from '@/lib/this-week';
import { useHomeworkQuery } from '@/lib/queries/homework';

/** Logical key for docs/tests. UI composes from ['homework'] cache plus notice deadlines. */
export const thisWeekQueryKey = ['homework', 'week'] as const;

export type UseThisWeekQueryOptions = {
  section?: string;
  today?: string;
};

/**
 * Reuses ['homework'] so Dashboard ↔ This Week ↔ Homework share cache.
 * Notice deadlines are a tiny extra DB read — never a Gemini call.
 */
export function useThisWeekQuery(options: UseThisWeekQueryOptions = {}) {
  const section = options.section || 'I-A';
  const today = options.today || getIndiaToday();
  const homeworkQuery = useHomeworkQuery();
  const noticeDeadlinesQuery = useQuery({
    queryKey: ['this-week', 'notice-deadlines'] as const,
    queryFn: loadThisWeekNoticeDeadlines,
  });

  const data: ThisWeekView | undefined = useMemo(() => {
    if (!homeworkQuery.data) return undefined;
    const merged = mergeDeadlineItems(
      homeworkQuery.data.items,
      noticeDeadlinesQuery.data || [],
    );
    return buildThisWeekView({
      homework: merged,
      today,
      section,
    });
  }, [homeworkQuery.data, noticeDeadlinesQuery.data, today, section]);

  return {
    data,
    isPending: homeworkQuery.isPending || noticeDeadlinesQuery.isPending,
    isError: homeworkQuery.isError,
    error: homeworkQuery.error,
    refetch: homeworkQuery.refetch,
    queryKey: [...thisWeekQueryKey, section, today] as const,
  };
}

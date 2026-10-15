'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadPlannerMonth, loadThisWeekNoticeDeadlines } from '@/app/actions';
import { getIndiaToday } from '@/lib/daily-brief';
import { mergeDeadlineItems } from '@/lib/deadlines/merge';
import { buildThisWeekView, type ThisWeekView } from '@/lib/this-week';
import { getEndOfWeekIndia, getStartOfWeekIndia } from '@/lib/week-range';
import { useHomeworkQuery } from '@/lib/queries/homework';
import { useNoticesQuery } from '@/lib/queries/notices';

/** Logical key for docs/tests. UI composes from ['homework'] cache plus notice deadlines. */
export const thisWeekQueryKey = ['homework', 'week'] as const;

export type UseThisWeekQueryOptions = {
  section?: string;
  today?: string;
};

/** Newsletter important dates for the month(s) a Mon–Sun week touches. */
async function loadWeekEvents(weekStart: string, weekEnd: string) {
  const keys = Array.from(new Set([weekStart.slice(0, 7), weekEnd.slice(0, 7)]));
  const views = await Promise.all(keys.map((key) => loadPlannerMonth(key)));
  return views.flatMap((v) =>
    v.selected && keys.includes(v.selected.key) ? v.selected.importantDates : [],
  );
}

/**
 * Reuses ['homework'] so Dashboard ↔ This Week ↔ Homework share cache.
 * Notice deadlines are a tiny extra DB read — never a Gemini call.
 */
export function useThisWeekQuery(options: UseThisWeekQueryOptions = {}) {
  const section = options.section || 'I-A';
  const today = options.today || getIndiaToday();
  const weekStart = getStartOfWeekIndia(today);
  const weekEnd = getEndOfWeekIndia(today);
  const homeworkQuery = useHomeworkQuery();
  const noticesQuery = useNoticesQuery();
  const noticeDeadlinesQuery = useQuery({
    queryKey: ['this-week', 'notice-deadlines'] as const,
    queryFn: loadThisWeekNoticeDeadlines,
  });
  const eventsQuery = useQuery({
    queryKey: ['this-week', 'events', weekStart, weekEnd] as const,
    queryFn: () => loadWeekEvents(weekStart, weekEnd),
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
      notices: noticesQuery.data ?? [],
      events: eventsQuery.data ?? [],
    });
  }, [homeworkQuery.data, noticeDeadlinesQuery.data, noticesQuery.data, eventsQuery.data, today, section]);

  return {
    data,
    isPending: homeworkQuery.isPending || noticeDeadlinesQuery.isPending,
    isError: homeworkQuery.isError,
    error: homeworkQuery.error,
    refetch: homeworkQuery.refetch,
    queryKey: [...thisWeekQueryKey, section, today] as const,
  };
}
